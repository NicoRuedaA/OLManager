//! Server-side data loading + world assembly.
//!
//! Mirrors the essential parts of the Tauri `select_team` command but reads
//! from a configurable data directory (env `OLM_DATA_DIR`, default `data/`)
//! instead of resolving paths through a `tauri::AppHandle`. The parsing and
//! world-building logic itself comes straight from the pure crates.

use std::path::{Path, PathBuf};

use chrono::{Datelike, TimeZone, Utc};
use domain::player::Player;
use domain::team::Team;
use ofm_core::game::Game;
use ofm_core::generator::definitions::ScheduleConfig;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Manifest {
    pub id: String,
    pub name: String,
    pub teams_file: Option<String>,
    pub players_file: Option<String>,
    pub schedule: ScheduleConfig,
}

#[derive(Debug, Deserialize)]
struct TeamsFile {
    teams: Vec<Team>,
}

#[derive(Debug, Deserialize)]
struct PlayersFile {
    players: Vec<Player>,
}

/// Resolve the data directory: `OLM_DATA_DIR` env var, else `data/` under cwd.
pub fn data_dir() -> PathBuf {
    std::env::var("OLM_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("data"))
}

/// Extract the competition prefix from a team id (`lck-team-x` → `lck`).
pub fn competition_id_from_team_id(team_id: &str) -> Option<&str> {
    let dash = team_id.find('-')?;
    let prefix = &team_id[..dash];
    if prefix.is_empty() {
        None
    } else {
        Some(prefix)
    }
}

fn scan_manifests(base: &Path) -> Vec<Manifest> {
    let comp_dir = base.join("competitions");
    let Ok(entries) = std::fs::read_dir(&comp_dir) else {
        return vec![];
    };
    let mut out = Vec::new();
    for entry in entries.flatten() {
        let manifest_path = entry.path().join("manifest.json");
        if !manifest_path.is_file() {
            continue;
        }
        if let Ok(contents) = std::fs::read_to_string(&manifest_path) {
            match serde_json::from_str::<Manifest>(&contents) {
                Ok(m) => out.push(m),
                Err(e) => tracing::warn!("bad manifest {:?}: {e}", manifest_path),
            }
        }
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    out
}

fn load_teams(base: &Path, manifest: &Manifest) -> Vec<Team> {
    let Some(file) = &manifest.teams_file else {
        return vec![];
    };
    let path = base.join(file);
    let Ok(contents) = std::fs::read_to_string(&path) else {
        return vec![];
    };
    match serde_json::from_str::<TeamsFile>(&contents) {
        Ok(tf) => tf.teams,
        Err(e) => {
            tracing::warn!("teams parse failed for {}: {e}", manifest.id);
            vec![]
        }
    }
}

fn load_players(base: &Path, manifest: &Manifest) -> Vec<Player> {
    let Some(file) = &manifest.players_file else {
        return vec![];
    };
    let path = base.join(file);
    let Ok(contents) = std::fs::read_to_string(&path) else {
        return vec![];
    };
    match serde_json::from_str::<PlayersFile>(&contents) {
        Ok(pf) => pf.players,
        Err(e) => {
            tracing::warn!("players parse failed for {}: {e}", manifest.id);
            vec![]
        }
    }
}

/// Assemble the full world (all loadable competitions), assign the manager to
/// the chosen team, generate schedules, and bootstrap derived state.
///
/// Returns an error string if the team id is invalid or its competition can't
/// be loaded — mirroring the Tauri command's contract.
pub fn select_team(game: &mut Game, team_id: &str) -> Result<(), String> {
    let base = data_dir();
    let manifests = scan_manifests(&base);
    if manifests.is_empty() {
        return Err(format!(
            "no competitions found under {:?} (set OLM_DATA_DIR)",
            base
        ));
    }

    let mut all_teams: Vec<Team> = Vec::new();
    let mut all_players: Vec<Player> = Vec::new();

    for manifest in &manifests {
        let prefix = format!("{}-", manifest.id);
        for mut team in load_teams(&base, manifest) {
            if !team.id.starts_with(&prefix) {
                team.id = format!("{}{}", prefix, team.id);
            }
            team.competition_id = Some(manifest.id.clone());
            all_teams.push(team);
        }
        for mut player in load_players(&base, manifest) {
            if let Some(tid) = player.team_id.clone() {
                if tid != "fa" && tid != "freeagent" && !tid.starts_with(&prefix) {
                    player.team_id = Some(format!("{}-{}", manifest.id, tid));
                }
            }
            if player.morale == 0 {
                player.morale = 68;
            }
            if player.condition == 0 {
                player.condition = 100;
            }
            all_players.push(player);
        }
    }

    if !all_teams.iter().any(|t| t.id == team_id) {
        return Err(format!("team '{}' not found in assembled world", team_id));
    }

    game.teams = all_teams;
    game.players = all_players;

    // Assign manager to the chosen team.
    game.manager.hire(team_id.to_string());
    if let Some(team) = game.teams.iter_mut().find(|t| t.id == team_id) {
        team.manager_id = Some(game.manager.id.clone());
    }

    // Generate league schedules for every competition with enough teams and a
    // non-empty split config (the engine guard skips the rest gracefully).
    let season_year = game.clock.current_date.year() as u32;
    let user_cid = competition_id_from_team_id(team_id);
    let mut leagues = Vec::new();
    for manifest in &manifests {
        let prefix = format!("{}-", manifest.id);
        let team_ids: Vec<String> = game
            .teams
            .iter()
            .filter(|t| t.id.starts_with(&prefix))
            .map(|t| t.id.clone())
            .collect();
        if team_ids.len() < 2 || manifest.schedule.splits.is_empty() {
            continue;
        }
        let mut league = ofm_core::schedule::generate_schedule_from_config(
            &manifest.id,
            &manifest.name,
            season_year,
            &team_ids,
            &manifest.schedule,
            0,
        );

        // Preseason friendlies for the user's competition only.
        if user_cid == Some(manifest.id.as_str()) {
            let split = &manifest.schedule.splits[0];
            let opponents: Vec<String> =
                team_ids.iter().filter(|t| t.as_str() != team_id).cloned().collect();
            if !opponents.is_empty() {
                let season_start = Utc
                    .with_ymd_and_hms(
                        season_year as i32,
                        split.season_start.month,
                        split.season_start.day,
                        0,
                        0,
                        0,
                    )
                    .unwrap();
                let today = game.clock.current_date.format("%Y-%m-%d").to_string();
                let mut friendlies = ofm_core::schedule::generate_preseason_friendlies(
                    team_id,
                    &opponents,
                    season_start,
                    manifest.schedule.preseason_friendlies as usize,
                );
                friendlies.retain(|f| f.date >= today);
                ofm_core::schedule::append_fixtures(&mut league, friendlies);
            }
        }

        league.competition_id = Some(manifest.id.clone());
        leagues.push(league);
    }
    game.leagues = leagues;

    ofm_core::champions::bootstrap_champion_state(game);
    ofm_core::season_context::refresh_game_context(game);

    Ok(())
}
