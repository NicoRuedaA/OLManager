//! Server command dispatch — thin wrapper around olm_core::dispatch.
//!
//! Most commands delegate to `olm_core::dispatch`. Server-specific commands
//! (world assembly, data loading) stay here.

use axum::http::StatusCode;
use chrono::Datelike;
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
        "get_scrim_context" => {
                let tid = game.manager.team_id.clone().ok_or_else(|| CommandError::bad_request("No team assigned"))?;
            let team = game.teams.iter().find(|t| t.id == tid)
                .ok_or_else(|| CommandError::bad_request("Team not found"))?;
            let week_key = format!("{}-W{}", game.clock.current_date.iso_week().year(), game.clock.current_date.iso_week().week());
            let capacity = olm_core::training::effective_scrim_slots_u8(team.scrim_weekly_slots, &team.training_schedule);
            let weekdays = olm_core::training::scrim_slot_weekdays_u8(capacity);
            let current_weekday = game.clock.current_date.weekday().num_days_from_monday() as u8;
            let slot_index = weekdays.iter().position(|w| *w == current_weekday);
            let day_phase = game.day_phase.as_id();
            let today = game.clock.current_date.format("%Y-%m-%d").to_string();
            let (setup_locked, setup_locked_reason) = olm_core::training::weekly_scrim_setup_lock_state(team, &week_key, current_weekday, game.day_phase.clone());

            let has_official_match = game.leagues.first().map(|l| l.fixtures.iter().any(|f|
                f.status == olm_core::domain::league::FixtureStatus::Scheduled
                && f.date.get(0..10).unwrap_or_default() == today
                && (f.home_team_id == tid || f.away_team_id == tid)
            )).unwrap_or(false);

            let mut today_reports: Vec<_> = team.scrim_reports.iter().filter(|r| r.date == today).cloned().collect();
            today_reports.sort_by(|a, b| a.slot_index.cmp(&b.slot_index));
            let unresolved = today_reports.iter().find(|r| r.post_decision.is_none()).cloned();
            let reviewed = today_reports.iter().find(|r| r.post_decision.is_some()).cloned();

            let today_ctx = if let Some(report) = unresolved {
                let decision_phase = day_phase == "ScrimBlock";
                json!({
                    "state": "PlayedNeedsReview", "slot_index": report.slot_index,
                    "opponent_team_id": report.opponent_team_id, "resolved_opponent_team_id": report.opponent_team_id,
                    "objective": team.scrim_weekly_objective, "report": report,
                    "can_edit_plan": false, "can_cancel": false, "can_review": decision_phase,
                    "can_view_weekly_plan": true, "has_official_match": has_official_match,
                    "primary_action": if decision_phase { "Review" } else if has_official_match { "Schedule" } else { "Training" },
                    "push_through_recommended": olm_core::training::is_push_through_recommended(
                        report.won.unwrap_or(false), report.severity, team.scrim_loss_streak,
                        team.scrim_reputation, game.teams.iter().find(|t| t.id == report.opponent_team_id).map(|t| t.scrim_reputation).unwrap_or(50)),
                })
            } else if let Some(report) = reviewed {
                json!({
                    "state": "Reviewed", "slot_index": report.slot_index,
                    "opponent_team_id": report.opponent_team_id, "resolved_opponent_team_id": report.opponent_team_id,
                    "objective": team.scrim_weekly_objective, "report": report,
                    "can_edit_plan": false, "can_cancel": false, "can_review": false,
                    "can_view_weekly_plan": true, "has_official_match": has_official_match,
                    "primary_action": if has_official_match { "Schedule" } else { "Training" },
                    "push_through_recommended": false,
                })
            } else if let Some(idx) = slot_index {
                let opponent = team.weekly_scrim_plan_team_ids.get(idx).and_then(|p| p.iter().find(|c| !c.is_empty()).cloned())
                    .or_else(|| team.weekly_scrim_opponent_ids.get(idx).filter(|c| !c.is_empty()).cloned());
                let is_planned = opponent.is_some() || day_phase == "Morning";
                json!({
                    "state": if is_planned { "Planned" } else { "Cancelled" },
                    "slot_index": idx as u8, "opponent_team_id": opponent, "resolved_opponent_team_id": Value::Null,
                    "objective": team.scrim_weekly_objective, "report": Value::Null,
                    "can_edit_plan": day_phase == "Morning", "can_cancel": is_planned && day_phase == "Morning",
                    "can_review": false, "can_view_weekly_plan": true, "has_official_match": has_official_match,
                    "primary_action": if is_planned { "OpenPlan" } else if has_official_match { "Schedule" } else { "Training" },
                    "push_through_recommended": false,
                })
            } else {
                json!({
                    "state": "NoScrimToday", "slot_index": Value::Null, "opponent_team_id": Value::Null,
                    "resolved_opponent_team_id": Value::Null, "objective": team.scrim_weekly_objective,
                    "report": Value::Null, "can_edit_plan": false, "can_cancel": false, "can_review": false,
                    "can_view_weekly_plan": true, "has_official_match": has_official_match,
                    "primary_action": if has_official_match { "Schedule" } else { "Training" },
                    "push_through_recommended": false,
                })
            };

            let slots: Vec<Value> = (0..capacity as usize).map(|idx| {
                let (label_day, label_suffix) = olm_core::training::slot_label_parts(&weekdays, idx);
                let plan = team.weekly_scrim_plan_team_ids.get(idx).cloned().unwrap_or_default();
                let opponent = team.weekly_scrim_opponent_ids.get(idx).cloned().unwrap_or_default();
                let report = team.scrim_reports.iter().find(|r| r.date == today && r.slot_index == idx as u8).cloned();
                json!({
                    "slot_index": idx as u8, "weekday": weekdays.get(idx).copied().unwrap_or(0),
                    "label": format!("{} {}", label_day, label_suffix),
                    "label_day": label_day, "label_suffix": label_suffix,
                    "plan": plan, "resolved_opponent_team_id": if opponent.is_empty() { json!(null) } else { json!(&opponent) },
                    "result_won": report.as_ref().and_then(|r| r.won), "report": report,
                    "status": if opponent.is_empty() { "Free" } else { "Planned" },
                    "can_edit": day_phase == "Morning",
                })
            }).collect();

            let planned = slots.iter().filter(|s| s.get("status").and_then(|v| v.as_str()) == Some("Planned")).count() as u8;
            let played_entries: Vec<_> = team.scrim_slot_results.iter().filter(|e| e.week_key == week_key).collect();
            let wins = played_entries.iter().filter(|e| e.won).count() as u8;
            let total = played_entries.len() as u8;
            let losses = total.saturating_sub(wins);
            let avg_q: u8 = 0; // quality not stored in ScrimSlotResult
            let top_focus: Option<olm_core::domain::team::ScrimFocus> = None; /* weekly summary TBD */
            let top_issue: Option<olm_core::domain::team::ScrimIssue> = None;

            ok(json!({
                "today": today_ctx,
                "week": {
                    "week_key": week_key, "objective": team.scrim_weekly_objective,
                    "capacity": capacity, "planned": planned,
                    "reputation": team.scrim_reputation, "cancellations": team.scrim_weekly_cancellations,
                    "played": total, "wins": wins, "losses": losses,
                    "loss_streak": team.scrim_loss_streak, "avg_quality": avg_q,
                    "top_focus": top_focus, "top_issue": top_issue,
                    "next_official_rival_team_id": Value::Null, "next_official_rival_competition": Value::Null,
                    "setup_locked": setup_locked, "setup_locked_reason": setup_locked_reason,
                    "can_finalize_setup": !setup_locked && team.weekly_scrim_opponent_ids.iter().any(|o| !o.is_empty()),
                    "slots": slots, "latest_reports": today_reports,
                }
            }), false)
        }
        "get_champions" => {
            let catalog = olm_core::champions::load_champion_catalog(&crate::data::data_dir());
            ok(json!(catalog), false)
        },
        "get_transfer_history_cmd" => ok(json!(&game.transfer_history), false),
        "make_transfer_bid" => {
            let pid = string_arg(&args, &["playerId","player_id"])?;
            let fee = args.get("fee").and_then(|v| v.as_u64()).unwrap_or(0);
            let included: Vec<String> = args.get("includedPlayerIds").and_then(|v| v.as_array())
                .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default();
            let outcome = olm_core::transfers::make_transfer_bid(game, &pid, fee, olm_core::transfers::TransferDestination::Main, &included)
                .map_err(CommandError::bad_request)?;
            ok(json!({"decision": "counter_offer", "suggested_fee": null, "is_terminal": false, "feedback": outcome, "game": game}), true)
        }
        "preview_transfer_bid_financial_impact" => {
            let pid = string_arg(&args, &["playerId","player_id"])?;
            let fee = args.get("fee").and_then(|v| v.as_u64()).unwrap_or(0);
            let projection = olm_core::transfers::project_transfer_bid_financial_impact(game, &pid, fee, olm_core::transfers::TransferDestination::Main)
                .map_err(CommandError::bad_request)?;
            ok(json!({"projection": projection}), false)
        }
        _ => Err(CommandError::bad_request(format!("Unknown command: {command}")))
    }
}







