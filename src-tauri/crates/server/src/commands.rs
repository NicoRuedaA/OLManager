//! Server command dispatch — thin wrapper around olm_core::dispatch.
//!
//! Most commands delegate to `olm_core::dispatch`. Server-specific commands
//! (world assembly, data loading) stay here.

use axum::http::StatusCode;
use olm_core::dispatch::DispatchResult;
use olm_core::game::Game;
use serde_json::{json, Value};

use crate::data;

pub struct CommandResult { pub value: Value, pub persist: bool }
pub struct CommandError { pub status: StatusCode, pub message: String }

impl CommandError {
    fn bad_request(m: impl Into<String>) -> Self { Self { status: StatusCode::BAD_REQUEST, message: m.into() } }
}

fn ok(value: Value, persist: bool) -> Result<CommandResult, CommandError> { Ok(CommandResult { value, persist }) }

fn string_arg(args: &Value, names: &[&str]) -> Result<String, CommandError> {
    for name in names {
        if let Some(v) = args.get(name).and_then(|v| v.as_str()) {
            return Ok(v.to_string());
        }
    }
    Err(CommandError::bad_request(format!("Missing argument: {}", names.join("/"))))
}

fn optional_string_arg(args: &Value, names: &[&str]) -> Option<String> {
    for name in names {
        if let Some(v) = args.get(name).and_then(|v| v.as_str()) {
            return Some(v.to_string());
        }
    }
    None
}

fn league_selection_data() -> Value {
    let data_dir = crate::data::data_dir();
    let selection = olm_core::competitions::build_league_selection(&data_dir);
    serde_json::to_value(selection).unwrap_or_default()
}

pub fn dispatch(command: &str, args: Value, game: &mut Game) -> Result<CommandResult, CommandError> {
    // Try the unified dispatch first
    match olm_core::dispatch::dispatch(command, &args, game) {
        Ok(DispatchResult::GameModified(value)) => return ok(value, true),
        Ok(DispatchResult::Query(value)) => return ok(value, false),
        Err(_) => {} // fall through to server-specific
    }

    // ── Server-specific commands ─────────────────────────────
    match command {
        "select_team" => {
            let team_id = string_arg(&args, &["teamId","team_id"])?;
            data::select_team(game, &team_id).map_err(CommandError::bad_request)?;
            ok(json!(game), true)
        }
        "get_team_selection_data" => ok(json!({
            "manager": game.manager,
            "teams": game.teams.iter().filter(|t| t.team_kind != olm_core::domain::team::TeamKind::Academy).cloned().collect::<Vec<_>>(),
            "players": game.players
        }), false),
        "get_league_selection_data" => ok(league_selection_data(), false),
        "save_game" => ok(Value::Null, true),
        "advance_to_next_season" => {
            olm_core::end_of_season::process_end_of_season(game);
            ok(json!(game), true)
        }
        "check_season_complete" => {
            let complete = olm_core::end_of_season::is_season_complete(game);
            ok(json!({"complete": complete}), false)
        }
        "reroll_player_lol_role" | "reroll_player_role" => {
            let pid = string_arg(&args, &["playerId","player_id"])?;
            olm_core::commands::reroll_player_role(game, &pid);
            ok(json!(game), true)
        }
        "get_academy_creation_options" => {
            let ptid = string_arg(&args, &["parentTeamId","parent_team_id"])?;
            let parent = game.teams.iter().find(|t| t.id == ptid).cloned()
                .ok_or_else(|| CommandError::bad_request(format!("Team '{ptid}' not found")))?;
            let options = olm_core::academy::eligible_academy_creation_options(
                &parent.country, olm_core::academy::academy_erl_catalog());
            ok(json!(options), false)
        }
        "export_bug_report" => {
            let description = string_arg(&args, &["description"]);
            let game_json = serde_json::to_string_pretty(game).unwrap_or_default();
            ok(json!({"description": description.unwrap_or_default(), "game": game_json}), false)
        }
        "upgrade_main_facility_module" => {
            let module_str = string_arg(&args, &["moduleId","module_id"])?;
            let kind = match module_str.to_lowercase().as_str() {
                "scrimsroom" | "scrims" => olm_core::domain::team::MainFacilityModuleKind::ScrimsRoom,
                "analysisroom" | "analysis" => olm_core::domain::team::MainFacilityModuleKind::AnalysisRoom,
                "bootcamparea" | "bootcamp" => olm_core::domain::team::MainFacilityModuleKind::BootcampArea,
                "recoverysuite" | "recovery" => olm_core::domain::team::MainFacilityModuleKind::RecoverySuite,
                "contentstudio" | "content" => olm_core::domain::team::MainFacilityModuleKind::ContentStudio,
                "scoutinglab" | "scouting" => olm_core::domain::team::MainFacilityModuleKind::ScoutingLab,
                _ => return Err(CommandError::bad_request(format!("unknown module: {module_str}"))),
            };
            if let Some(team_id) = &game.manager.team_id {
                if let Some(team) = game.teams.iter_mut().find(|t| &t.id == team_id) {
                    olm_core::club::upgrade_main_facility_module(team, kind)
                        .map_err(CommandError::bad_request)?;
                }
            }
            ok(json!(game), true)
        }
        "get_champions" => {
            let catalog = olm_core::champions::load_champion_catalog(&crate::data::data_dir());
            ok(json!(catalog), false)
        },
        "get_transfer_history_cmd" => ok(json!(&game.transfer_history), false),
        "make_transfer_bid" => ok(json!(game), true),   // stub
        "preview_transfer_bid_financial_impact" => ok(json!({
            "bid_amount": 0, "wage_contribution": 0, "total_impact": 0,
        }), false),
        _ => Err(CommandError::bad_request(format!("Unknown command: {command}")))
    }
}

