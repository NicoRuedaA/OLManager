use log::info;
use tauri::State;

use olm_core::state::StateManager;

#[tauri::command]
pub fn check_season_complete(state: State<'_, StateManager>) -> Result<bool, String> {
    log::debug!("[cmd] check_season_complete");
    let game = state
        .get_game(|g| g.clone())
        .ok_or("No active game session".to_string())?;
    Ok(olm_core::end_of_season::is_season_complete(&game))
}

/// Try to load the competition manifest from the game's league data.
/// If available, return the ScheduleConfig for manifest-driven schedule generation.
fn resolve_schedule_config(
    game: &olm_core::game::Game,
) -> Option<olm_core::generator::definitions::ScheduleConfig> {
    // Check if we have leagues data with competition_id on teams
    let competition_id = game.teams.first().and_then(|t| t.competition_id.as_deref())?;

    // Try to load the manifest — this is best-effort
    let data_dir = std::env::current_dir().ok()?;
    let manifest_path = data_dir
        .join("src-tauri")
        .join("data")
        .join("competitions")
        .join(competition_id)
        .join("manifest.json");

    let manifest_json = std::fs::read_to_string(manifest_path).ok()?;
    let manifest: olm_core::generator::definitions::CompetitionManifest =
        serde_json::from_str(&manifest_json).ok()?;

    Some(manifest.schedule)
}

#[tauri::command]
pub fn advance_to_next_season(state: State<'_, StateManager>) -> Result<serde_json::Value, String> {
    info!("[cmd] advance_to_next_season");
    let mut game = state
        .get_game(|g| g.clone())
        .ok_or("No active game session".to_string())?;

    if !olm_core::end_of_season::is_season_complete(&game) {
        return Err("Season is not yet complete".to_string());
    }

    // Try to resolve schedule config for manifest-driven flow
    let schedule_config = resolve_schedule_config(&game);

    let summary = if let Some(ref config) = schedule_config {
        info!(
            "[cmd] advance_to_next_season: using manifest-driven schedule",
        );
        olm_core::end_of_season::process_end_of_season_with_config(&mut game, Some(config))
    } else {
        info!("[cmd] advance_to_next_season: using legacy schedule");
        olm_core::end_of_season::process_end_of_season(&mut game)
    };

    // Process background league seasons
    {
        let configs = game.competition_configs.clone();
        olm_core::end_of_season::process_background_seasons(&mut game, &configs);
    }

    // End-of-season objective evaluation may have dropped satisfaction — check firing
    olm_core::firing::check_manager_firing(&mut game);

    state.set_game(game.clone());

    if game.manager.team_id.is_none() {
        return Ok(serde_json::json!({
            "action": "fired",
            "game": game,
            "summary": summary,
        }));
    }

    Ok(serde_json::json!({
        "game": game,
        "summary": summary,
    }))
}

#[tauri::command]
pub fn get_season_awards(
    state: State<'_, StateManager>,
) -> Result<olm_core::season_awards::SeasonAwards, String> {
    log::debug!("[cmd] get_season_awards");
    let game = state
        .get_game(|g| g.clone())
        .ok_or("No active game session".to_string())?;
    Ok(olm_core::season_awards::compute_season_awards(&game))
}

