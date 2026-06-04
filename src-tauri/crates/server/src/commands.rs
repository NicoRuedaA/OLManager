use std::collections::HashMap;

use axum::http::StatusCode;
use domain::team::{DraftStrategy, TeamKind, TrainingFocus, TrainingIntensity};
use ofm_core::game::Game;
use ofm_core::generator::definitions::LeagueSelectionData;
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
        "debug_log" => {
            if let Some(message) = args.get("message").and_then(|value| value.as_str()) {
                tracing::debug!("{message}");
            }
            ok(Value::Null, false)
        }
        "get_active_game" => {
            let repaired_financials = data::repair_player_financials(game);
            let repaired_active_competition = data::repair_active_competition(game);
            ofm_core::champions::bootstrap_champion_state(game);
            ok(json!(game), repaired_financials || repaired_active_competition)
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
        "get_player_match_history" | "get_team_match_history" => ok(json!([]), false),
        "get_player_stats_overview" => ok(json!(empty_player_stats_overview()), false),
        "get_team_stats_overview" => ok(json!(empty_team_stats_overview()), false),
        "get_champions" => ok(json!(champions_catalog()), false),
        "mark_message_read" => {
            let message_id = string_arg(&args, &["messageId", "message_id"])?;
            if let Some(message) = game.messages.iter_mut().find(|m| m.id == message_id) {
                message.read = true;
            }
            ok(json!(game), true)
        }
        "mark_all_messages_read" => {
            for message in game.messages.iter_mut() {
                message.read = true;
            }
            ok(json!(game), true)
        }
        "relocalize_social_feed" => {
            let language =
                optional_string_arg(&args, &["language", "locale"]).unwrap_or_else(|| "en".to_string());
            ofm_core::social::relocalize_social_posts(game, &language);
            ok(json!(game), true)
        }
        "check_blocking_actions" => {
            let blockers = crate::time_blockers::compute_blocking_actions(game);
            ok(json!(blockers), false)
        }
        "get_academy_acquisition_options" => {
            let parent_team_id = string_arg(&args, &["parentTeamId", "parent_team_id"])?;

            // Bootstrap academy seeds from ERL data
            let bootstrap_date = game.clock.current_date.format("%Y-%m-%d").to_string();
            ofm_core::game_setup::bootstrap_example_academy_pool_from_example(
                &mut game.teams,
                &mut game.players,
                &bootstrap_date,
            );

            let parent = match game.teams.iter().find(|t| t.id == parent_team_id) {
                Some(t) => t.clone(),
                None => return Err(CommandError::bad_request(format!("Team '{}' not found", parent_team_id))),
            };

            let occupied_source_ids: std::collections::HashSet<String> = game.teams
                .iter()
                .filter(|t| t.team_kind == domain::team::TeamKind::Academy && t.parent_team_id.is_some())
                .flat_map(|t| {
                    let mut ids = vec![t.id.clone()];
                    if let Some(ref meta) = t.academy {
                        ids.push(meta.source_team_id.clone());
                    }
                    ids
                })
                .collect();

            let taken_original_names: std::collections::HashSet<String> = game.teams
                .iter()
                .filter(|t| t.team_kind == domain::team::TeamKind::Academy && t.parent_team_id.is_some())
                .filter_map(|t| t.academy.as_ref().map(|m| {
                    m.original_name.to_lowercase().chars()
                        .filter(|ch| ch.is_ascii_alphanumeric())
                        .collect::<String>()
                }))
                .collect();

            let options: Vec<ofm_core::academy::AcademyAcquisitionOption> =
                ofm_core::academy::eligible_academy_acquisition_options(
                    &parent.country,
                    ofm_core::academy::academy_erl_catalog(),
                    ofm_core::academy::academy_candidate_catalog(),
                )
                .into_iter()
                .filter(|opt| {
                    !occupied_source_ids.contains(&opt.source_team_id)
                        && !taken_original_names.contains(
                            &opt.name.to_lowercase().chars()
                                .filter(|ch| ch.is_ascii_alphanumeric())
                                .collect::<String>()
                        )
                })
                .collect();

            let blocked_reason = if !parent.is_main() {
                Some("Academy can only be acquired for a main team".to_string())
            } else if parent.academy_team_id.is_some() {
                Some("Parent team already has academy".to_string())
            } else if options.is_empty() {
                Some("No free academy candidates available".to_string())
            } else if options.iter().all(|o| parent.finance < o.acquisition_cost) {
                Some("Insufficient funds for all eligible academy acquisition options".to_string())
            } else {
                None
            };

            ok(json!({
                "parent_team_id": parent_team_id,
                "acquisition_allowed": blocked_reason.is_none(),
                "blocked_reason": blocked_reason,
                "options": options,
            }), false)
        }
        _ => Err(CommandError::not_found(format!(
            "unsupported command: {command}"
        ))),
    }
}

fn ok(value: Value, persist: bool) -> Result<CommandResult, CommandError> {
    Ok(CommandResult { value, persist })
}

fn empty_metric(include_percentile: bool) -> Value {
    if include_percentile {
        json!({
            "total": 0,
            "perMatch": null,
            "percentile": null,
        })
    } else {
        json!({
            "total": 0,
            "perMatch": null,
        })
    }
}

fn empty_player_stats_overview() -> Value {
    json!({
        "percentileEligible": false,
        "matchesPlayed": 0,
        "metrics": {
            "kills": empty_metric(true),
            "deaths": empty_metric(true),
            "assists": empty_metric(true),
            "creepScore": empty_metric(true),
            "visionScore": empty_metric(true),
            "wardsPlaced": empty_metric(true),
        },
    })
}

fn empty_team_stats_overview() -> Value {
    json!({
        "matchesPlayed": 0,
        "wins": 0,
        "losses": 0,
        "metrics": {
            "kills": empty_metric(false),
            "deaths": empty_metric(false),
            "goldEarned": empty_metric(false),
            "damageToChampions": empty_metric(false),
            "objectives": empty_metric(false),
            "averageGameDurationSeconds": empty_metric(false),
        },
    })
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
    Ok(ofm_core::competitions::build_league_selection(&base))
}

/// Splits a camel/Pascal-case champion key into a display name, e.g.
/// `MissFortune` -> `Miss Fortune`, `Aatrox` -> `Aatrox`.
fn split_camel_case(key: &str) -> String {
    let mut name = String::with_capacity(key.len() + 4);
    for (index, ch) in key.chars().enumerate() {
        if index > 0 && ch.is_uppercase() {
            name.push(' ');
        }
        name.push(ch);
    }
    name
}

/// Builds the champion catalog from the embedded `champions.json`, matching the
/// shape the desktop app serves from its SQLite `champions` table (see
/// `db::champion_repo`). Parsed once and cached.
fn champions_catalog() -> &'static Vec<Value> {
    static CATALOG: std::sync::OnceLock<Vec<Value>> = std::sync::OnceLock::new();
    CATALOG.get_or_init(|| {
        let raw = include_str!("../../../../assets/simulation/champions.json");
        let json: Value = match serde_json::from_str(raw) {
            Ok(value) => value,
            Err(_) => return Vec::new(),
        };
        let data = json.get("data");
        let roles = match data.and_then(|d| d.get("roles")).and_then(|r| r.as_object()) {
            Some(map) => map,
            None => return Vec::new(),
        };
        let counterpicks = data
            .and_then(|d| d.get("counterpicks"))
            .and_then(|c| c.as_array());
        let synergies = data.and_then(|d| d.get("synergies")).and_then(|s| s.as_array());

        // display_aliases maps a display name -> champion key; invert to key -> name
        // so apostrophe names (e.g. "Kai'Sa" for "Kaisa") render correctly.
        let mut key_to_name: HashMap<String, String> = HashMap::new();
        if let Some(aliases) = data
            .and_then(|d| d.get("display_aliases"))
            .and_then(|a| a.as_object())
        {
            for (alias, value) in aliases {
                if let Some(key) = value.as_str() {
                    key_to_name.insert(key.to_string(), alias.clone());
                }
            }
        }

        let filter_relations = |array: Option<&Vec<Value>>, champion_key: &str| -> Option<String> {
            let items = array?;
            let filtered: Vec<&Value> = items
                .iter()
                .filter(|item| item.get("a").and_then(|v| v.as_str()) == Some(champion_key))
                .collect();
            if filtered.is_empty() {
                None
            } else {
                serde_json::to_string(&filtered).ok()
            }
        };

        let mut keys: Vec<&String> = roles.keys().collect();
        keys.sort();

        keys.into_iter()
            .enumerate()
            .map(|(index, key)| {
                let champion_key = key.as_str();
                let name = key_to_name
                    .get(champion_key)
                    .cloned()
                    .unwrap_or_else(|| split_camel_case(champion_key));
                let roles_json = roles
                    .get(champion_key)
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| "[]".to_string());

                json!({
                    "id": (index as i64) + 1,
                    "name": name,
                    "champion_key": champion_key,
                    "roles_json": roles_json,
                    "counterpicks_json": filter_relations(counterpicks, champion_key),
                    "synergies_json": filter_relations(synergies, champion_key),
                    "image_tile_url": format!("/champion-tiles/{champion_key}.webp"),
                    "image_splash_url": format!("/champion-splash/{champion_key}.webp"),
                })
            })
            .collect()
    })
}
