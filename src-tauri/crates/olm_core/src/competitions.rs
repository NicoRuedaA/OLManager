use crate::domain::player::Player;
use crate::domain::staff::Staff;
use crate::domain::team::Team;
use log::info;
use std::collections::HashMap;
use std::path::Path;

use crate::generator::definitions::{
    CompetitionManifest, CompetitionSummary, LeagueSelectionData, PlayerDataFile, StaffDataFile,
    TeamDataFile, TeamSummary,
};

// ---------------------------------------------------------------------------
// Manifest loading
// ---------------------------------------------------------------------------

/// Scan a `competitions/` directory and return all manifests.
pub fn scan_competitions(competitions_base: &Path) -> Vec<CompetitionManifest> {
    let entries = match std::fs::read_dir(competitions_base) {
        Ok(e) => e,
        Err(err) => {
            info!("[competitions] failed to read competitions dir: {}", err);
            return vec![];
        }
    };

    let mut manifests = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let manifest_path = path.join("manifest.json");
        if !manifest_path.exists() {
            continue;
        }
        match std::fs::read_to_string(&manifest_path) {
            Ok(json) => match serde_json::from_str::<CompetitionManifest>(&json) {
                Ok(manifest) => {
                    info!(
                        "[competitions] loaded manifest: {} ({})",
                        manifest.id, manifest.name
                    );
                    manifests.push(manifest);
                }
                Err(err) => {
                    info!(
                        "[competitions] skipped malformed manifest at {:?}: {}",
                        manifest_path, err
                    );
                }
            },
            Err(err) => {
                info!(
                    "[competitions] failed to read manifest at {:?}: {}",
                    manifest_path, err
                );
            }
        }
    }

    manifests
}

/// Load a single competition manifest by ID from a competitions directory.
pub fn load_competition_manifest(
    competitions_base: &Path,
    competition_id: &str,
) -> Result<CompetitionManifest, String> {
    let manifest_path = competitions_base.join(competition_id).join("manifest.json");
    let json = std::fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read manifest for '{}': {}", competition_id, e))?;
    serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse manifest for '{}': {}", competition_id, e))
}

// ---------------------------------------------------------------------------
// Team / Player / Staff data loading
// ---------------------------------------------------------------------------

/// Load team data for a competition from its manifest's `teams_file` path.
pub fn load_teams(
    data_base: &Path,
    manifest: &CompetitionManifest,
) -> Result<Vec<Team>, String> {
    let teams_path = data_base.join(&manifest.teams_file);
    info!("[competitions] loading teams for '{}' from {:?}", manifest.id, teams_path);
    let json = std::fs::read_to_string(&teams_path).map_err(|e| {
        format!(
            "Failed to read teams file '{}' for '{}': {}",
            manifest.teams_file, manifest.id, e
        )
    })?;
    let mut data: TeamDataFile =
        serde_json::from_str(&json).map_err(|e| format!("Failed to parse teams data: {}", e))?;

    // Inject competition_id and fix logo paths
    for team in &mut data.teams {
        team.competition_id = Some(manifest.id.clone());
        if let Some(ref mut url) = team.logo_url {
            if url.starts_with("/team-logos/") {
                *url = url.replacen("/team-logos/", "/teams-icons/", 1);
            }
        }
    }
    Ok(data.teams)
}

/// Load player data for a competition from its manifest's `players_file` path.
pub fn load_players(
    data_base: &Path,
    manifest: &CompetitionManifest,
) -> Result<Vec<Player>, String> {
    let players_path = data_base.join(&manifest.players_file);
    info!("[competitions] loading players for '{}' from {:?}", manifest.id, players_path);
    let json = std::fs::read_to_string(&players_path).map_err(|e| {
        format!(
            "Failed to read players file '{}' for '{}': {}",
            manifest.players_file, manifest.id, e
        )
    })?;
    let mut data: PlayerDataFile = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse players data: {}", e))?;

    // Normalize: if natural_position is unknown, fall back to position
    for player in &mut data.players {
        if player.natural_position == crate::domain::stats::LolRole::Unknown {
            player.natural_position = player.position;
        }
    }

    Ok(data.players)
}

/// Load staff data for a competition from its manifest's `staff_file` path.
/// Returns an empty vec if no staff_file is configured.
pub fn load_staff(
    data_base: &Path,
    manifest: &CompetitionManifest,
) -> Result<Vec<Staff>, String> {
    let staff_path = match &manifest.staff_file {
        Some(path) => data_base.join(path),
        None => return Ok(Vec::new()),
    };
    info!("[competitions] loading staff for '{}' from {:?}", manifest.id, staff_path);
    let json = std::fs::read_to_string(&staff_path).map_err(|e| {
        format!(
            "Failed to read staff file '{}' for '{}': {}",
            manifest.staff_file.as_deref().unwrap_or("?"),
            manifest.id,
            e
        )
    })?;
    let data: StaffDataFile = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse staff data: {}", e))?;
    Ok(data.staff)
}

/// Load free agent staff from `data/staffs/free_agents.json`.
pub fn load_staff_free_agents(data_base: &Path) -> Result<Vec<Staff>, String> {
    let staff_path = data_base.join("staffs").join("free_agents.json");
    let json = std::fs::read_to_string(&staff_path)
        .map_err(|e| format!("Failed to read staff file: {}", e))?;
    let data: StaffDataFile = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse staff data: {}", e))?;
    Ok(data.staff)
}

/// Count players per team from the manifest's players_file.
fn load_player_count_by_team(
    data_base: &Path,
    manifest: &CompetitionManifest,
) -> Result<HashMap<String, usize>, String> {
    let players = load_players(data_base, manifest)?;
    let mut counts = HashMap::new();
    for player in &players {
        if let Some(ref tid) = player.team_id {
            *counts.entry(tid.clone()).or_default() += 1;
        }
    }
    Ok(counts)
}

// ---------------------------------------------------------------------------
// League selection data
// ---------------------------------------------------------------------------

/// Build a `CompetitionSummary` for a single manifest.
fn competition_summary(
    data_base: &Path,
    manifest: CompetitionManifest,
) -> Option<CompetitionSummary> {
    let teams = load_teams(data_base, &manifest).ok()?;
    let player_count_by_team = load_player_count_by_team(data_base, &manifest).unwrap_or_default();
    let prefix = format!("{}-", manifest.id);

    let team_summaries: Vec<TeamSummary> = teams
        .into_iter()
        .map(|team| {
            let id = if team.id.starts_with(&prefix) {
                team.id.clone()
            } else {
                format!("{}-{}", manifest.id, team.id)
            };
            let player_count = player_count_by_team.get(&team.id).copied();
            TeamSummary {
                id,
                name: team.name,
                short_name: team.short_name,
                logo_url: team.logo_url,
                country: team.country,
                city: Some(team.city),
                finance: Some(team.finance),
                reputation: Some(team.reputation),
                colors: Some(team.colors),
                ovr: None,
                player_count,
            }
        })
        .collect();

    Some(CompetitionSummary {
        id: manifest.id,
        name: manifest.name,
        region: manifest.region,
        logo: manifest.logo,
        tier: manifest.tier.unwrap_or(0),
        legacy: manifest.legacy,
        team_count: manifest.schedule.team_count,
        teams: team_summaries,
    })
}

/// Build lightweight league selection metadata from all competition manifests.
/// Filters out legacy and non-tier-1 competitions.
/// This is read-only and does not require game state.
pub fn build_league_selection(data_base: &Path) -> LeagueSelectionData {
    let competitions_base = data_base.join("competitions");
    let manifests = scan_competitions(&competitions_base);

    let competitions: Vec<CompetitionSummary> = manifests
        .into_iter()
        .filter(|m| !m.legacy && m.tier.unwrap_or(1) == 1)
        .filter_map(|manifest| competition_summary(data_base, manifest))
        .collect();

    LeagueSelectionData { competitions }
}


/// Extract competition ID from a scoped team ID like \"lec-g2\" → \"lec\".
pub fn competition_id_from_team_id(team_id: &str) -> Option<&str> {
    let dash_pos = team_id.find('-')?;
    let prefix = &team_id[..dash_pos];
    if prefix.is_empty() { None } else { Some(prefix) }
}
