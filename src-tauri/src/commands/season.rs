use log::info;
use tauri::State;

use olm_core::generator::definitions::CompetitionManifest;
use olm_core::state::StateManager;

#[tauri::command]
pub fn check_season_complete(state: State<'_, StateManager>) -> Result<bool, String> {
    log::debug!("[cmd] check_season_complete");
    let game = state
        .get_game(|g| g.clone())
        .ok_or("No active game session".to_string())?;
    Ok(olm_core::end_of_season::is_season_complete(&game))
}

/// Try to load the competition manifest from disk.
fn resolve_competition_manifest(
    game: &olm_core::game::Game,
) -> Option<CompetitionManifest> {
    let competition_id = game.user_competition_id.as_deref()?;

    let exe_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    let relative_paths = [
        exe_dir.join("data").join("competitions").join(competition_id).join("manifest.json"),
        exe_dir.join("src-tauri").join("data").join("competitions").join(competition_id).join("manifest.json"),
    ];
    for p in &relative_paths {
        if let Ok(json) = std::fs::read_to_string(p) {
            if let Ok(manifest) = serde_json::from_str::<CompetitionManifest>(&json) {
                return Some(manifest);
            }
        }
    }

    if let Ok(cwd) = std::env::current_dir() {
        let cwd_paths = [
            cwd.join("data").join("competitions").join(competition_id).join("manifest.json"),
            cwd.join("src-tauri").join("data").join("competitions").join(competition_id).join("manifest.json"),
        ];
        for p in &cwd_paths {
            if let Ok(json) = std::fs::read_to_string(p) {
                if let Ok(manifest) = serde_json::from_str::<CompetitionManifest>(&json) {
                    return Some(manifest);
                }
            }
        }
    }

    None
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

    // Try to resolve competition manifest for manifest-driven flow
    let manifest = resolve_competition_manifest(&game);
    let mut was_season_end: bool;

    let summary = if let Some(ref manifest) = manifest {
        let is_wrapping = game
            .active_league()
            .is_some_and(|league| league.split_index + 1 >= manifest.schedule.splits.len());

        was_season_end = is_wrapping;

        if is_wrapping {
            info!(
                "[cmd] advance_to_next_season: season complete, running full end-of-season"
            );
            let summary = olm_core::end_of_season::process_end_of_season_with_config(
                &mut game, Some(manifest),
            );
            // After season-end processing, generate split 0 of the new season
            olm_core::end_of_season::process_end_of_split(&mut game, manifest);
            summary
        } else {
            was_season_end = false;
            info!(
                "[cmd] advance_to_next_season: split complete, advancing to next split"
            );
            // Increment split, then generate its schedule
            if let Some(l) = game.active_league_mut() {
                l.split_index += 1;
            }
            olm_core::end_of_season::process_end_of_split(&mut game, manifest);
            // Return a minimal summary — no awards/history/reset on mid-year splits
            let league = game.active_league().cloned();
            olm_core::end_of_season::EndOfSeasonSummary {
                season: league.as_ref().map(|l| l.season).unwrap_or(0),
                league_name: league.as_ref().map(|l| l.name.clone()).unwrap_or_default(),
                ..Default::default()
            }
        }
    } else {
        was_season_end = true;
        info!("[cmd] advance_to_next_season: using legacy schedule");
        olm_core::end_of_season::process_end_of_season(&mut game)
    };

    // Process background league seasons
    {
        let manifests = game.competition_configs.clone();
        olm_core::end_of_season::process_background_seasons(&mut game, &manifests);
    }

    // End-of-season objective evaluation may have dropped satisfaction — check firing
    if was_season_end {
        olm_core::firing::check_manager_firing(&mut game);
    }

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

