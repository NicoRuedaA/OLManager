use std::collections::HashMap;
use std::path::Path;

use axum::http::StatusCode;
use domain::team::{DraftStrategy, TeamKind, TrainingFocus, TrainingIntensity};
use ofm_core::game::Game;
use ofm_core::generator::definitions::{
    CompetitionManifest, CompetitionSummary, LeagueSelectionData, PlayerDataFile, TeamDataFile,
    TeamSummary,
};
use serde_json::{json, Value};

use crate::data;

pub struct CommandResult {
    pub value: Value,
    pub persist: bool,
}

pub struct CommandError {
    pub status: StatusCode,
    pub message: String,
}

impl CommandError {
    fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: message.into(),
        }
    }

    fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message: message.into(),
        }
    }
}

pub fn dispatch(
    command: &str,
    args: Value,
    game: &mut Game,
) -> Result<CommandResult, CommandError> {
    match command {
        "get_active_game" => {
            ofm_core::champions::bootstrap_champion_state(game);
            ok(json!(game), false)
        }
        "save_game" => ok(Value::Null, true),
        "advance_time" => {
            ofm_core::turn::process_day(game);
            ok(json!(game), true)
        }
        "advance_time_with_mode" => {
            let _mode =
                optional_string_arg(&args, &["mode"]).unwrap_or_else(|| "delegate".to_string());
            ofm_core::turn::process_day(game);
            ok(
                json!({
                    "action": "advanced",
                    "game": game,
                }),
                true,
            )
        }
        "select_team" => {
            let team_id = string_arg(&args, &["teamId", "team_id"])?;
            data::select_team(game, &team_id).map_err(CommandError::bad_request)?;
            ok(json!(game), true)
        }
        "set_active_lineup" | "set_starting_xi" => {
            let player_ids = string_vec_arg(&args, &["playerIds", "player_ids"])?;
            let team_id = manager_team_id(game)?;
            let team = managed_team_mut(game, &team_id)?;
            team.active_lineup_ids = player_ids;
            ok(json!(game), true)
        }
        "set_draft_strategy" => {
            let value = string_arg(&args, &["draftStrategy", "draft_strategy"])?;
            let strategy = match value.as_str() {
                "Attacking" | "HighPress" => DraftStrategy::Aggressive,
                "Defensive" => DraftStrategy::Passive,
                "Possession" => DraftStrategy::Scaling,
                "Counter" => DraftStrategy::CounterPick,
                "PriorityBans" => DraftStrategy::PriorityBans,
                _ => DraftStrategy::Balanced,
            };
            let team_id = manager_team_id(game)?;
            let team = managed_team_mut(game, &team_id)?;
            team.draft_strategy = strategy;
            ok(json!(game), true)
        }
        "set_lol_tactics" => {
            let tactics_value = get_arg(&args, &["lolTactics", "lol_tactics"])?.clone();
            let tactics = serde_json::from_value(tactics_value)
                .map_err(|e| CommandError::bad_request(format!("invalid lol_tactics: {e}")))?;
            let team_id = manager_team_id(game)?;
            let team = managed_team_mut(game, &team_id)?;
            team.lol_tactics = tactics;
            ok(json!(game), true)
        }
        "set_training" => {
            let focus = string_arg(&args, &["focus"])?;
            let intensity = string_arg(&args, &["intensity"])?;
            let training_focus = TrainingFocus::from_id(&focus).unwrap_or_default();
            let training_intensity = match intensity.as_str() {
                "Low" => TrainingIntensity::Low,
                "High" => TrainingIntensity::High,
                _ => TrainingIntensity::Medium,
            };
            let team_id = manager_team_id(game)?;
            let team = managed_team_mut(game, &team_id)?;
            team.training_focus = training_focus;
            team.training_intensity = training_intensity;
            ok(json!(game), true)
        }
        "get_team_selection_data" => ok(
            json!({
                "manager": game.manager,
                "teams": game
                    .teams
                    .iter()
                    .filter(|team| team.team_kind != TeamKind::Academy)
                    .cloned()
                    .collect::<Vec<_>>(),
                "players": game.players,
            }),
            false,
        ),
        "get_league_selection_data" => {
            let data = league_selection_data().map_err(CommandError::bad_request)?;
            ok(json!(data), false)
        }
        _ => Err(CommandError::not_found(format!(
            "unsupported command: {command}"
        ))),
    }
}

fn ok(value: Value, persist: bool) -> Result<CommandResult, CommandError> {
    Ok(CommandResult { value, persist })
}

fn get_arg<'a>(args: &'a Value, names: &[&str]) -> Result<&'a Value, CommandError> {
    names
        .iter()
        .find_map(|name| args.get(*name))
        .ok_or_else(|| CommandError::bad_request(format!("missing argument: {}", names[0])))
}

fn string_arg(args: &Value, names: &[&str]) -> Result<String, CommandError> {
    get_arg(args, names)?
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| {
            CommandError::bad_request(format!("argument must be a string: {}", names[0]))
        })
}

fn optional_string_arg(args: &Value, names: &[&str]) -> Option<String> {
    names
        .iter()
        .find_map(|name| args.get(*name))
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn string_vec_arg(args: &Value, names: &[&str]) -> Result<Vec<String>, CommandError> {
    let value = get_arg(args, names)?;
    let array = value.as_array().ok_or_else(|| {
        CommandError::bad_request(format!("argument must be an array: {}", names[0]))
    })?;
    array
        .iter()
        .map(|item| {
            item.as_str().map(str::to_string).ok_or_else(|| {
                CommandError::bad_request(format!(
                    "argument array must contain strings: {}",
                    names[0]
                ))
            })
        })
        .collect()
}

fn manager_team_id(game: &Game) -> Result<String, CommandError> {
    game.manager
        .team_id
        .clone()
        .ok_or_else(|| CommandError::bad_request("No team assigned"))
}

fn managed_team_mut<'a>(
    game: &'a mut Game,
    team_id: &str,
) -> Result<&'a mut domain::team::Team, CommandError> {
    game.teams
        .iter_mut()
        .find(|team| team.id == team_id)
        .ok_or_else(|| CommandError::bad_request("Managed team not found"))
}

fn league_selection_data() -> Result<LeagueSelectionData, String> {
    let base = data::data_dir();
    let competition_dir = base.join("competitions");
    let entries = std::fs::read_dir(&competition_dir).map_err(|e| {
        format!(
            "failed to read competitions directory {:?}: {e}",
            competition_dir
        )
    })?;

    let mut manifests = Vec::new();
    for entry in entries.flatten() {
        let manifest_path = entry.path().join("manifest.json");
        if !manifest_path.is_file() {
            continue;
        }
        let json = std::fs::read_to_string(&manifest_path)
            .map_err(|e| format!("failed to read {:?}: {e}", manifest_path))?;
        match serde_json::from_str::<CompetitionManifest>(&json) {
            Ok(manifest) => manifests.push(manifest),
            Err(e) => tracing::warn!("skipping malformed manifest {:?}: {e}", manifest_path),
        }
    }

    manifests.sort_by(|a, b| a.id.cmp(&b.id));
    let competitions = manifests
        .into_iter()
        .filter_map(|manifest| competition_summary(&base, manifest))
        .collect();

    Ok(LeagueSelectionData { competitions })
}

fn competition_summary(base: &Path, manifest: CompetitionManifest) -> Option<CompetitionSummary> {
    let teams = load_teams(base, &manifest).ok()?;
    let player_count_by_team = load_player_count_by_team(base, &manifest).unwrap_or_default();
    let prefix = format!("{}-", manifest.id);

    let team_summaries = teams
        .into_iter()
        .map(|mut team| {
            if let Some(url) = &mut team.logo_url {
                if url.starts_with("/team-logos/") {
                    *url = url.replacen("/team-logos/", "/teams-icons/", 1);
                }
            }

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
        team_count: manifest.schedule.team_count,
        teams: team_summaries,
    })
}

fn load_teams(
    base: &Path,
    manifest: &CompetitionManifest,
) -> Result<Vec<domain::team::Team>, String> {
    let path = base.join(&manifest.teams_file);
    let json = std::fs::read_to_string(&path)
        .map_err(|e| format!("failed to read teams file {:?}: {e}", path))?;
    let data: TeamDataFile =
        serde_json::from_str(&json).map_err(|e| format!("failed to parse teams file: {e}"))?;
    Ok(data.teams)
}

fn load_player_count_by_team(
    base: &Path,
    manifest: &CompetitionManifest,
) -> Result<HashMap<String, usize>, String> {
    let path = base.join(&manifest.players_file);
    let json = std::fs::read_to_string(&path)
        .map_err(|e| format!("failed to read players file {:?}: {e}", path))?;
    let data: PlayerDataFile =
        serde_json::from_str(&json).map_err(|e| format!("failed to parse players file: {e}"))?;
    let mut counts = HashMap::new();
    for player in data.players {
        if let Some(team_id) = player.team_id {
            *counts.entry(team_id).or_default() += 1;
        }
    }
    Ok(counts)
}
