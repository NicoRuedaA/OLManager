use chrono::{Datelike, TimeZone};
use olm_core::domain::player::Player;
use olm_core::domain::staff::Staff;
use olm_core::domain::team::{Team, TeamKind};
use olm_core::domain::stats::LolRole;
use log::info;
use serde::Serialize;
use std::path::PathBuf;
use tauri::Manager as TauriManager;
use tauri::State;

use olm_core::db::save_index::SaveEntry;
use olm_core::domain::manager::Manager;
use olm_core::domain::stats::StatsState;
use olm_core::clock::GameClock;
use olm_core::game::Game;
use olm_core::game_setup;
use olm_core::state::StateManager;

use crate::SaveManagerState;
use crate::application::game_setup::avatar;
use crate::error::AppError;
use validator::Validate;

#[derive(Debug, Clone, Serialize)]
pub struct TeamSelectionData {
    pub manager: Manager,
    pub teams: Vec<olm_core::domain::team::Team>,
    pub players: Vec<olm_core::domain::player::Player>,
}

// ---------------------------------------------------------------------------
// Local helpers that stay in the Tauri layer
// ---------------------------------------------------------------------------

/// Extract competition ID from a scoped team ID like "lec-g2" → "lec".
use olm_core::competitions::competition_id_from_team_id;

/// Assemble teams, players, and staff from modular competition data files.
/// Used by Flow C: the game was created lightweight (empty teams/players),
/// and now we need to load the selected competition's data.
fn assemble_world_from_modular_data(
    app_handle: &tauri::AppHandle,
    competition_id: &str,
    team_id: &str,
) -> Result<(Vec<Team>, Vec<Player>, Vec<Staff>), String> {
    info!(
        "[game] assemble_world_from_modular_data: competition={}, team_id={}",
        competition_id, team_id
    );

    // Initialize shared resource directory for static functions.
    // Use the same multi-tier resolution as the rest of the data layer so the
    // Tauri `_up_/data` install layout is handled correctly.
    olm_core::state::RESOURCE_DATA_DIR.get_or_init(|| {
        crate::commands::competitions::resolve_data_base(app_handle)
            .unwrap_or_else(|| PathBuf::from("data"))
    });

    // 1. Scan ALL competitions and load every team + player + staff
    let manifests = crate::commands::competitions::scan_competitions(app_handle);
    let mut all_teams: Vec<Team> = Vec::new();
    let mut all_players: Vec<Player> = Vec::new();
    let mut staff = crate::commands::competitions::load_staff_free_agents(app_handle)?;

    for manifest in manifests.iter().filter(|m| !m.legacy) {
        let cid = &manifest.id;
        let prefix = format!("{}-", cid);

        if let Ok(mut comp_teams) = crate::commands::competitions::load_competition_teams(app_handle, manifest) {
            for team in &mut comp_teams {
                if !team.id.starts_with(&prefix) {
                    team.id = format!("{}{}", prefix, team.id);
                }
                team.competition_id = Some(cid.to_string());
            }
            all_teams.extend(comp_teams);
        }
        let player_count_before = all_players.len();
        match crate::commands::competitions::load_competition_players(app_handle, manifest) {
            Ok(comp_players) => {
                for mut player in comp_players {
                    if let Some(ref tid) = player.team_id.clone() {
                        if tid != "fa" && tid != "freeagent" && !tid.starts_with(&prefix) {
                            player.team_id = Some(format!("{}-{}", cid, tid));
                        }
                    }
                    if player.morale == 0 { player.morale = 68; }
                    if player.condition == 0 { player.condition = 100; }
                    all_players.push(player);
                }
            }
            Err(err) => {
                info!("[game] FAILED to load players for '{}': {}", cid, err);
            }
        }
        let loaded = all_players.len() - player_count_before;
        info!("[game] loaded {} players for '{}'", loaded, cid);

        // Load competition staff
        let staff_count_before = staff.len();
        match crate::commands::competitions::load_competition_staff(app_handle, manifest) {
            Ok(comp_staff) => {
                for mut s in comp_staff {
                    if let Some(ref tid) = s.team_id.clone() {
                        if !tid.starts_with(&prefix) {
                            s.team_id = Some(format!("{}-{}", cid, tid));
                        }
                    }
                    staff.push(s);
                }
            }
            Err(err) => {
                info!("[game] FAILED to load staff for '{}': {}", cid, err);
            }
        }
        let loaded_staff = staff.len() - staff_count_before;
        info!("[game] loaded {} staff for '{}'", loaded_staff, cid);
    }

    // 2. Bootstrap academy seeds from ERL catalog (JSON or legacy .txt fallback)
    let academy_bootstrap_date = "2025-01-01".to_string();
    let pre_count = all_teams.len();
    game_setup::bootstrap_example_academy_pool_from_example(&mut all_teams, &mut all_players, &academy_bootstrap_date);
    let academy_count = all_teams.len() - pre_count;
    if academy_count > 0 {
        info!("[game] bootstrapped {} academy teams from ERL catalog", academy_count);
    }
    game_setup::remove_free_agents_shadowed_by_academy(&mut all_players, &all_teams);

    // 4. Inject free agent players from JSON
    game_setup::inject_json_free_agents(&mut all_players);

    // 5. Apply default contract ends
    game_setup::apply_default_initial_contract_end(&mut all_players);

    // DEBUG: count staff by team_id
    {
        use std::collections::HashMap;
        let mut by_team: HashMap<&str, usize> = HashMap::new();
        for s in &staff {
            match s.team_id.as_deref() {
                None => { *by_team.entry("(free agent)").or_insert(0) += 1; }
                Some(tid) => { *by_team.entry(tid).or_insert(0) += 1; }
            }
        }
        info!("[game] STAFF BREAKDOWN:");
        for (tid, count) in &by_team {
            info!("[game]   {}: {}", tid, count);
        }
    }

    info!(
        "[game] assemble_world_from_modular_data: {} teams, {} players, {} staff",
        all_teams.len(),
        all_players.len(),
        staff.len()
    );

    Ok((all_teams, all_players, staff))
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Step 1 (Flow C / lightweight): Create manager only, no world loaded.
/// Teams, players, staff are empty — they'll be assembled on select_team().
/// Used when the frontend wants to show league/team selection first.
#[tauri::command]
pub async fn start_new_game_lightweight(
    _app_handle: tauri::AppHandle,
    state: State<'_, StateManager>,
    nickname: Option<String>,
    first_name: String,
    last_name: String,
    dob: String,
    nationality: String,
) -> Result<String, String> {
    info!(
        "[cmd] start_new_game_lightweight: {} {} (nickname={:?}, nationality={})",
        first_name, last_name, nickname, nationality
    );
    // Validate inputs (same as start_new_game)
    let first_name = first_name.trim().to_string();
    let last_name = last_name.trim().to_string();
    let nickname = nickname.unwrap_or_default().trim().to_string();
    if first_name.is_empty() || last_name.is_empty() {
        return Err("First name and last name are required.".to_string());
    }
    if first_name.len() > 30 || last_name.len() > 30 {
        return Err("First name and last name must not exceed 30 characters.".to_string());
    }
    if nickname.len() > 20 {
        return Err("Nickname must not exceed 20 characters.".to_string());
    }
    let nationality = nationality.trim().to_string();
    if nationality.is_empty() {
        return Err("Nationality is required.".to_string());
    }

    let start_date = chrono::Utc.with_ymd_and_hms(2025, 1, 1, 0, 0, 0).unwrap();

    let birth_date = chrono::NaiveDate::parse_from_str(&dob, "%Y-%m-%d")
        .map_err(|_| "Invalid date of birth. Use YYYY-MM-DD format.".to_string())?;
    let age = game_setup::calculate_age_on_date(birth_date, start_date.date_naive());
    if age > 99 {
        return Err("Invalid date of birth.".to_string());
    }

    let mut manager = Manager::new(
        "mgr_user".to_string(),
        first_name,
        last_name,
        dob,
        nationality,
    );
    manager.nickname = nickname;

    let clock = GameClock::new(start_date);

    // Empty world — will be assembled on select_team()
    let new_game = Game::new(clock, manager, vec![], vec![], vec![], vec![]);

    info!(
        "[cmd] start_new_game_lightweight: manager created (no world), storing game in state"
    );
    state.set_game(new_game);
    state.set_stats_state(StatsState::default());
    info!("[cmd] start_new_game_lightweight: completed");
    Ok("ok".to_string())
}


/// Step 2: User picks a team. Assigns manager, generates welcome message, saves to DB.
/// Supports both Flow A (world pre-loaded) and Flow C (modular assembly).
#[tauri::command]
pub async fn select_team(
    state: State<'_, StateManager>,
    sm_state: State<'_, SaveManagerState>,
    app_handle: tauri::AppHandle,
    team_id: String,
    lang: Option<String>,
) -> Result<Game, String> {
    let lang = lang.unwrap_or_else(|| "en".to_string());
    info!("[cmd] select_team: team_id={}, lang={}", team_id, lang);
    let mut game = state
        .get_game(|g: &Game| g.clone())
        .ok_or("No active game session".to_string())?;

    // Detect flow: if game has no teams, this is Flow C (modular assembly)
    eprintln!("[select_team] teams.is_empty={}, staff.len={}", game.teams.is_empty(), game.staff.len());
    if game.teams.is_empty() {
        info!("[cmd] select_team: empty game state — assembling from modular data");

        // Extract competition ID from team ID (e.g. "lec-g2" → "lec")
        let competition_id = competition_id_from_team_id(&team_id)
            .ok_or_else(|| format!("Invalid team ID format '{}': missing competition prefix", team_id))?;

        // Assemble teams, players, staff from modular data
        let (assembled_teams, assembled_players, assembled_staff) =
            assemble_world_from_modular_data(&app_handle, competition_id, &team_id)?;

        game.teams = assembled_teams;
        game.players = assembled_players;
        game.staff = assembled_staff;

        // Auto-populate active lineup for the user's team
        let roles = [LolRole::Top, LolRole::Jungle, LolRole::Mid, LolRole::Adc, LolRole::Support];
        if let Some(user_team) = game.teams.iter_mut().find(|t| t.id == team_id) {
            let mut used = std::collections::HashSet::new();
            let lineup: Vec<String> = roles.iter().map(|role| {
                let candidates: Vec<&str> = game.players.iter()
                    .filter(|p| {
                        p.team_id.as_deref() == Some(&team_id)
                        && !used.contains(&p.id)
                        && (p.position == *role || p.natural_position == *role)
                    })
                    .map(|p| p.id.as_str())
                    .collect();
                candidates.first().map(|id| {
                    used.insert(id.to_string());
                    id.to_string()
                }).unwrap_or_default()
            }).collect();
            eprintln!("[select_team] auto_lineup: {:?} (roles: {:?})", lineup, roles);
            eprintln!("[select_team] roster_roles: {:?}", game.players.iter()
                .filter(|p| p.team_id.as_deref() == Some(&team_id))
                .map(|p| format!("{} pos={:?} nat={:?}", p.id, p.position, p.natural_position))
                .collect::<Vec<_>>());
            if lineup.iter().all(|id| !id.is_empty()) {
                user_team.active_lineup_ids = lineup;
                eprintln!("[select_team] active_lineup_ids set to {:?}", user_team.active_lineup_ids);
            } else {
                eprintln!("[select_team] WARNING: auto_lineup incomplete, setting empty");
                user_team.active_lineup_ids = vec![];
            }
        }
        eprintln!("[select_team] AFTER assembly: staff.len={}", game.staff.len());
    }

    // Validate team exists
    let team = game
        .teams
        .iter()
        .find(|t| t.id == team_id)
        .ok_or("Team not found".to_string())?;
    if team.team_kind == TeamKind::Academy {
        return Err("Academy teams cannot be selected as manager team".to_string());
    }
    let team_name = team.name.clone();

    // Assign manager to team
    game.manager.hire(team_id.clone());
    if let Some(t) = game.teams.iter_mut().find(|t| t.id == team_id) {
        t.manager_id = Some(game.manager.id.clone());
    }

    // Generate schedules for ALL competitions
    let season_year = game.clock.current_date.year();
    let user_cid = competition_id_from_team_id(&team_id);
    let all_manifests = crate::commands::competitions::scan_competitions(&app_handle);
    let mut all_leagues: Vec<olm_core::domain::league::League> = Vec::new();

    for manifest in all_manifests.iter().filter(|m| !m.legacy) {
        let cid = &manifest.id;
        let team_ids: Vec<String> = game.teams.iter()
            .filter(|team| team.team_kind != TeamKind::Academy && team.competition_id.as_deref() == Some(cid.as_str()))
            .map(|team| team.id.clone()).collect();

        if team_ids.len() < 2 { continue; }

        let schedule_config = &manifest.schedule;
        // Competitions whose manifest has no schedule splits (e.g. several
        // legacy/ERL leagues) cannot generate a calendar — skip them instead
        // of indexing into an empty `splits` vec and panicking.
        if schedule_config.splits.is_empty() {
            log::warn!(
                "[game] skipping schedule for '{}' — manifest has no schedule splits",
                cid
            );
            continue;
        }
        let mut league = olm_core::schedule::generate_schedule_from_config(
            cid, &manifest.name, season_year as u32, &team_ids, schedule_config, 0,
        );

        // Generate preseason friendlies for ALL competitions
        let today = game.clock.current_date.format("%Y-%m-%d").to_string();
        let split = &schedule_config.splits[0];
        let season_start = chrono::Utc
            .with_ymd_and_hms(season_year, split.season_start.month, split.season_start.day, 0, 0, 0)
            .unwrap();
        let num_friendlies = schedule_config.preseason_friendlies as usize;
        if num_friendlies > 0 {
            if user_cid == Some(cid.as_str()) {
                // User's competition: only generate friendlies for the user's team
                let opponents: Vec<String> = team_ids.iter()
                    .filter(|tid| tid.as_str() != team_id).cloned().collect();
                if !opponents.is_empty() {
                    let mut friendlies = olm_core::schedule::generate_preseason_friendlies(
                        &team_id, &opponents, season_start, num_friendlies,
                    );
                    friendlies.retain(|fixture| fixture.date >= today);
                    olm_core::schedule::append_fixtures(&mut league, friendlies);
                }
            } else {
                // Background competitions: generate friendlies for all teams
                for tid in &team_ids {
                    let opponents: Vec<String> = team_ids.iter()
                        .filter(|t| t.as_str() != tid.as_str()).cloned().collect();
                    if !opponents.is_empty() {
                        let mut friendlies = olm_core::schedule::generate_preseason_friendlies(
                            tid, &opponents, season_start, num_friendlies,
                        );
                        friendlies.retain(|fixture| fixture.date >= today);
                        olm_core::schedule::append_fixtures(&mut league, friendlies);
                    }
                }
            }
        }

        league.competition_id = Some(cid.clone());
        league.logo = manifest.logo.clone();
        all_leagues.push(league);
    }

    // Populate competition_configs from all manifests for bg season cycling
    for manifest in all_manifests.iter().filter(|m| !m.legacy) {
        game.competition_configs
            .insert(manifest.id.clone(), manifest.schedule.clone());
    }

    game.leagues = all_leagues;
    game.user_competition_id = user_cid.map(String::from);
    olm_core::champions::bootstrap_champion_state(&mut game);
    olm_core::season_context::refresh_game_context(&mut game);

    // Rich templated messages
    let date_str = game.clock.current_date.to_rfc3339();

    // Get league name for messages
    let league_display_name = user_cid
        .and_then(|cid| crate::commands::competitions::load_competition_manifest(&app_handle, cid).ok())
        .map(|m| format!("{} {}", m.name, m.schedule.splits.first().map(|s| s.name.as_str()).unwrap_or("")))
        .unwrap_or_else(|| "LEC Winter".to_string());

    // Initialize message template store
    {
        // Look for messages root directory (to find senders)
        let msg_root_candidates = vec![
            std::env::current_dir().ok().map(|d| d.join("data").join("messages")),
            std::env::current_dir().ok().map(|d| d.join("../data").join("messages")),
            std::env::current_dir().ok().map(|d| d.join("src-tauri/data").join("messages")),
        ];
        let mut messages_root = None;
        for candidate in &msg_root_candidates {
            if let Some(path) = candidate {
                if path.is_dir() {
                    messages_root = Some(path.clone());
                    break;
                }
            }
        }

        // Look for triggers/ subdirectory inside messages root
        let triggers_candidates = vec![
            messages_root.as_ref().map(|p| p.join("triggers")),
        ];
        for candidate in &triggers_candidates {
            if let Some(path) = candidate {
                if path.is_dir() {
                    let result = olm_core::messages::template_store::init_template_store(path);
                    eprintln!("[template_store] init from {:?}: {:?}", path, result);
                    break;
                }
            }
        }

        // Initialize senders store under data/messages/senders/
        if let Some(msg_dir) = &messages_root {
            let senders_dir = msg_dir.join("senders");
            if senders_dir.is_dir() {
                olm_core::messages::template_store::init_senders_store(&senders_dir);
                eprintln!("[senders_store] init from {:?}", senders_dir);
            }
        }
    }

    let welcome_msg = olm_core::messages::welcome_message(&team_name, &team_id, &date_str, &lang);
    game.messages.push(welcome_msg);

    if let Some(parent_team) = game.teams.iter().find(|team| team.id == team_id) {
        if let Some(academy_team_id) = parent_team.academy_team_id.as_deref() {
            if let Some(academy_team) = game.teams.iter().find(|team| team.id == academy_team_id) {
                let academy_roster_count = game
                    .players
                    .iter()
                    .filter(|player| player.team_id.as_deref() == Some(academy_team_id))
                    .count();
                game.messages.push(game_setup::academy_overview_message(
                    parent_team,
                    academy_team,
                    academy_roster_count,
                    &date_str,
                ));
            }
        }
    }

    // For schedule message, compute season start from user competition manifest or fallback
    let season_start_str = if let Some(cid) = user_cid {
        if let Ok(m) = crate::commands::competitions::load_competition_manifest(&app_handle, cid) {
            let split = &m.schedule.splits[0];
            format!(
                "{} {}, {}",
                chrono::Month::try_from(split.season_start.month as u8).map(|mon| mon.name()).unwrap_or("January"),
                split.season_start.day,
                season_year
            )
        } else {
            format!("January 18, {}", season_year)
        }
    } else {
        format!("January 18, {}", season_year)
    };

    let season_msg = olm_core::messages::season_schedule_message(
        &league_display_name,
        &season_start_str,
        &date_str,
    );
    game.messages.push(season_msg);

    let team_names: Vec<String> = game
        .teams
        .iter()
        .filter(|team| team.team_kind != TeamKind::Academy)
        .map(|team| team.name.clone())
        .collect();
    game.news.push(olm_core::news::season_preview_article(
        &team_names,
        &date_str,
    ));

    let staff_msg = olm_core::messages::staff_advice_message(&team_name, &team_id, &date_str);
    game.messages.push(staff_msg);

    olm_core::player_events::generate_contract_concern_messages(&mut game, false);

    // Save to new per-save DB
    let manager_name = game.manager.display_name();
    let save_name = format!("{}'s Career", manager_name);

    let mut sm = sm_state
        .0
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    let save_id = sm.create_save(&game, &save_name)?;
    state.set_save_id(save_id);

    eprintln!("[select_team] BEFORE return: staff.len={}", game.staff.len());
    state.set_game(game.clone());
    state.set_stats_state(StatsState::default());
    Ok(game)
}

#[tauri::command]
pub async fn get_saves(sm_state: State<'_, SaveManagerState>) -> Result<Vec<SaveEntry>, String> {
    log::debug!("[cmd] get_saves");
    let sm = sm_state
        .0
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    Ok(sm.list_saves().to_vec())
}

#[tauri::command]
pub async fn delete_save(
    sm_state: State<'_, SaveManagerState>,
    save_id: String,
) -> Result<bool, String> {
    info!("[cmd] delete_save: save_id={}", save_id);
    let mut sm = sm_state
        .0
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    sm.delete_save(&save_id)
}

#[tauri::command]
pub async fn load_game(
    state: State<'_, StateManager>,
    sm_state: State<'_, SaveManagerState>,
    save_id: String,
) -> Result<String, String> {
    info!("[cmd] load_game: save_id={}", save_id);

    let mut sm = sm_state
        .0
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    info!("[cmd] load_game: loading game data from save");
    let mut game = sm.load_game(&save_id)?;
    info!(
        "[cmd] load_game: game loaded, players={}, teams={}",
        game.players.len(),
        game.teams.len()
    );

    // Bootstrap champion state so the Champions tab has data
    info!("[cmd] load_game: bootstrapping champion state...");
    olm_core::champions::bootstrap_champion_state(&mut game);
    // Refresh lol_ovr for all players (it's stored as 0 in the save DB)
    for player in &mut game.players {
        player.lol_ovr = olm_core::potential::calculate_lol_ovr(player);
    }
    info!(
        "[cmd] load_game: champion_patch.hidden_meta={}, champion_masteries={}",
        game.champion_patch.hidden_meta.len(),
        game.champion_masteries.len()
    );

    info!("[cmd] load_game: setting state");
    let mgr_name = game.manager.display_name();
    state.set_save_id(save_id);
    state.set_game(game);
    state.set_stats_state(StatsState::default());
    info!("[cmd] load_game: state set, returning manager name");

    Ok(mgr_name)
}

#[tauri::command]
pub async fn get_active_game(state: State<'_, StateManager>) -> Result<Game, String> {
    log::info!("[cmd] get_active_game: start");
    let mut game = state.get_game(|g: &Game| g.clone()).ok_or_else(|| {
        log::error!("[cmd] get_active_game: no active game in state");
        "No active game session".to_string()
    })?;
    log::info!(
        "[cmd] get_active_game: found game with {} players, {} teams",
        game.players.len(),
        game.teams.len()
    );
    log::info!("[cmd] get_active_game: bootstrapping champion state...");
    olm_core::champions::bootstrap_champion_state(&mut game);
    // Refresh lol_ovr for all players (it's stored as 0 in the save DB)
    for player in &mut game.players {
        player.lol_ovr = olm_core::potential::calculate_lol_ovr(player);
    }
    log::info!(
        "[cmd] get_active_game: champion_patch.hidden_meta={}, champion_masteries={}",
        game.champion_patch.hidden_meta.len(),
        game.champion_masteries.len()
    );
    Ok(game)
}

#[tauri::command]
pub async fn get_champions() -> Result<Vec<olm_core::domain::champion::Champion>, String> {
    let raw = include_str!("../../../assets/draft/champion-list.json");
    let list: olm_core::champions::ChampionListFile = serde_json::from_str(raw)
        .map_err(|e| format!("Failed to parse champion-list.json: {e}"))?;
    let catalog: Vec<olm_core::domain::champion::Champion> = list.champions
        .into_iter()
        .enumerate()
        .map(|(i, entry)| {
            let champion_name = entry.name.clone();
            let image_splash = format!("https://ddragon.leagueoflegends.com/cdn/img/champion/splash/{}_0.jpg",
                champion_name.replace(' ', "").replace("'", ""));
            olm_core::domain::champion::Champion {
                id: (i + 1) as i64,
                name: entry.name,
                champion_key: entry.id,
                roles_json: serde_json::to_string(&entry.tags).unwrap_or_default(),
                counterpicks_json: None,
                synergies_json: None,
                image_tile_url: Some(format!("https://ddragon.leagueoflegends.com/cdn/16.10.1/img/champion/{}", entry.image)),
                image_splash_url: Some(image_splash),
            }
        })
        .collect();
    log::info!("[cmd] get_champions: embedded {} champions", catalog.len());
    Ok(catalog)
}

#[tauri::command]
pub async fn get_team_selection_data(
    state: State<'_, StateManager>,
) -> Result<TeamSelectionData, String> {
    log::debug!("[cmd] get_team_selection_data");
    state
        .get_game(|game| TeamSelectionData {
            manager: game.manager.clone(),
            teams: game
                .teams
                .iter()
                .filter(|team| team.team_kind != TeamKind::Academy)
                .cloned()
                .collect(),
            players: game.players.clone(),
        })
        .ok_or("No active game session".to_string())
}

#[tauri::command]
pub async fn save_game(
    state: State<'_, StateManager>,
    sm_state: State<'_, SaveManagerState>,
) -> Result<(), String> {
    info!("[cmd] save_game");
    let mut game = state
        .get_game(|g: &Game| g.clone())
        .ok_or("No active game session".to_string())?;

    let save_id = state
        .get_save_id()
        .ok_or("No active save session".to_string())?;

    // Sync stats_state from session back into game before saving
    let stats_state = state
        .get_stats_state(|stats| stats.clone())
        .unwrap_or_default();
    game.stats_state = stats_state;

    let mut sm = sm_state
        .0
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    sm.save_game(&game, &save_id)
}

/// Save the current game and clear the active session so the player returns to the main menu.
#[tauri::command]
pub async fn exit_to_menu(
    state: State<'_, StateManager>,
    sm_state: State<'_, SaveManagerState>,
) -> Result<(), String> {
    info!("[cmd] exit_to_menu");
    let game = state
        .get_game(|g: &Game| g.clone())
        .ok_or("No active game session")?;

    // Auto-save
    if let Some(save_id) = state.get_save_id() {
        let mut game = game;
        let stats_state = state
            .get_stats_state(|stats| stats.clone())
            .unwrap_or_default();
        game.stats_state = stats_state;

        let mut sm = sm_state
            .0
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        sm.save_game(&game, &save_id)?;
    }

    // Clear the in-memory game state
    state.clear_game();
    state.clear_save_id();

    Ok(())
}

/// Save manager avatar file to app data directory
#[tauri::command]
pub async fn save_manager_avatar(
    app_handle: tauri::AppHandle,
    filename: String,
    data: Vec<u8>,
) -> Result<String, AppError> {
    info!("[cmd] save_manager_avatar: filename={}", filename);

    let safe_name = avatar::safe_avatar_filename(&filename)?;

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(format!("Failed to get app data dir: {}", e)))?;

    let avatar_dir = app_data_dir.join("manager-avatars");
    std::fs::create_dir_all(&avatar_dir)
        .map_err(|e| AppError::Io(format!("Failed to create avatar directory: {}", e)))?;

    let file_path = avatar_dir.join(&safe_name);
    // Extra safety: verify resolved path is within the avatar directory
    let canonical = file_path
        .canonicalize()
        .map_err(|e| AppError::Io(format!("Failed to resolve avatar path: {}", e)))?;
    let canonical_dir = avatar_dir
        .canonicalize()
        .map_err(|e| AppError::Io(format!("Failed to resolve avatar directory: {}", e)))?;
    if !canonical.starts_with(&canonical_dir) {
        return Err(AppError::Validation(
            "Avatar path traversal detected".into(),
        ));
    }

    std::fs::write(&file_path, &data)
        .map_err(|e| AppError::Io(format!("Failed to write avatar file: {}", e)))?;

    info!("[cmd] save_manager_avatar: saved to {:?}", file_path);
    Ok(safe_name)
}

/// Load manager avatar as base64 data URL
#[tauri::command]
pub async fn load_manager_avatar(
    app_handle: tauri::AppHandle,
    filename: String,
) -> Result<String, AppError> {
    info!("[cmd] load_manager_avatar: filename={}", filename);

    let safe_name = avatar::safe_avatar_filename(&filename)?;

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(format!("Failed to get app data dir: {}", e)))?;

    let avatar_dir = app_data_dir.join("manager-avatars");
    let file_path = avatar_dir.join(&safe_name);
    // Extra safety: verify resolved path is within the avatar directory
    let canonical = file_path
        .canonicalize()
        .map_err(|e| AppError::Io(format!("Failed to resolve avatar path: {}", e)))?;
    let canonical_dir = avatar_dir
        .canonicalize()
        .map_err(|e| AppError::Io(format!("Failed to resolve avatar directory: {}", e)))?;
    if !canonical.starts_with(&canonical_dir) {
        return Err(AppError::Validation(
            "Avatar path traversal detected".into(),
        ));
    }

    if !file_path.exists() {
        return Err(AppError::NotFound(format!(
            "Avatar file not found: {}",
            safe_name
        )));
    }

    let data = std::fs::read(&file_path)
        .map_err(|e| AppError::Io(format!("Failed to read avatar file: {}", e)))?;

    // Determine MIME type from extension
    let mime_type = match safe_name.rsplit('.').next() {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        _ => "application/octet-stream",
    };

    // Use modern base64 API (0.22+)
    use base64::Engine;
    let base64_data = base64::engine::general_purpose::STANDARD.encode(&data);
    let data_url = format!("data:{};base64,{}", mime_type, base64_data);

    info!("[cmd] load_manager_avatar: loaded {} bytes", data.len());
    Ok(data_url)
}

/// Validated input for updating manager profile fields.
#[derive(Debug, validator::Validate)]
#[allow(dead_code)]
struct ManagerProfileInput {
    #[validate(length(max = 30))]
    nickname: Option<String>,
    #[validate(length(max = 30))]
    first_name: Option<String>,
    #[validate(length(max = 30))]
    last_name: Option<String>,
    #[validate(custom(function = "validate_date_format"))]
    dob: Option<String>,
    #[validate(length(max = 3))]
    nationality: Option<String>,
    avatar_path: Option<String>,
}

fn validate_date_format(date: &str) -> Result<(), validator::ValidationError> {
    if chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d").is_ok() {
        Ok(())
    } else {
        Err(validator::ValidationError::new("invalid_date_format"))
    }
}

/// Update manager profile fields (nickname, name, dob, nationality, avatar)
#[tauri::command]
pub async fn update_manager_profile(
    state: State<'_, StateManager>,
    nickname: Option<String>,
    first_name: Option<String>,
    last_name: Option<String>,
    dob: Option<String>,
    nationality: Option<String>,
    avatar_path: Option<String>,
) -> Result<(), AppError> {
    info!("[cmd] update_manager_profile");

    // Validate input
    let input = ManagerProfileInput {
        nickname: nickname.clone(),
        first_name: first_name.clone(),
        last_name: last_name.clone(),
        dob: dob.clone(),
        nationality: nationality.clone(),
        avatar_path: avatar_path.clone(),
    };
    input
        .validate()
        .map_err(|e| AppError::Validation(format!("Validation failed: {}", e)))?;

    let mut game = state
        .get_game(|g: &Game| g.clone())
        .ok_or(AppError::Session("No active game session".into()))?;

    // Update only the provided fields (not None)
    if let Some(nick) = nickname {
        let trimmed = nick.trim().to_string();
        if !trimmed.is_empty() {
            game.manager.nickname = trimmed;
        }
    }
    if let Some(first) = first_name {
        let trimmed = first.trim().to_string();
        if !trimmed.is_empty() {
            game.manager.first_name = trimmed;
        }
    }
    if let Some(last) = last_name {
        let trimmed = last.trim().to_string();
        if !trimmed.is_empty() {
            game.manager.last_name = trimmed;
        }
    }
    if let Some(date) = dob {
        // Already validated by validator custom function
        game.manager.date_of_birth = date;
    }
    if let Some(nat) = nationality {
        let trimmed = nat.trim().to_string();
        if !trimmed.is_empty() {
            game.manager.nationality = trimmed;
        }
    }
    if let Some(avatar) = avatar_path {
        game.manager.avatar_path = Some(avatar);
    }

    // Save the game state back
    state.set_game(game.clone());

    info!("[cmd] update_manager_profile: completed");
    Ok(())
}

/// Diagnostic: verify the current set of know.enums is consistent.
#[tauri::command]
pub fn debug_serde_test() -> Result<String, String> {
    Ok("debug ok".into())
}

