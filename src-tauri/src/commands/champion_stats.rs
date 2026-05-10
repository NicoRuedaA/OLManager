use db::repositories::champion_stats_repo;
use domain::champion_stats::ChampionStatsSummary;
use ofm_core::state::StateManager;
use tauri::State;

use crate::SaveManagerState;

#[tauri::command]
pub fn get_champion_stats(
    champion_key: String,
    state: State<'_, StateManager>,
    sm_state: State<'_, SaveManagerState>,
) -> Result<ChampionStatsSummary, String> {
    log::debug!("[cmd] get_champion_stats: champion={}", champion_key);

    let save_id = state
        .get_save_id()
        .ok_or("No active game session".to_string())?;

    let mut sm = sm_state.0.lock().map_err(|e| format!("Lock error: {e}"))?;

    let db_arc = sm.open_game_db(&save_id)?;
    let db = db_arc.lock().map_err(|e| format!("Lock error: {e}"))?;
    champion_stats_repo::champion_stats(db.conn(), &champion_key)
}

#[tauri::command]
pub fn get_top_champions(
    limit: usize,
    state: State<'_, StateManager>,
    sm_state: State<'_, SaveManagerState>,
) -> Result<Vec<serde_json::Value>, String> {
    log::debug!("[cmd] get_top_champions: limit={}", limit);

    let save_id = state
        .get_save_id()
        .ok_or("No active game session".to_string())?;

    let mut sm = sm_state.0.lock().map_err(|e| format!("Lock error: {e}"))?;

    let db_arc = sm.open_game_db(&save_id)?;
    let db = db_arc.lock().map_err(|e| format!("Lock error: {e}"))?;
    let conn = db.conn();

    let tops = champion_stats_repo::top_champions_by_pick_rate(conn, limit)?;
    let mut result = Vec::new();
    for (key, games, pick_rate) in tops {
        // Resolve name through champion_repo which handles the query internally
        let name = db::repositories::champion_repo::get_champion_by_key(conn, &key)
            .ok()
            .flatten()
            .map(|c| c.name)
            .unwrap_or_default();
        result.push(serde_json::json!({
            "champion_key": key,
            "champion_name": name,
            "games": games,
            "pick_rate": pick_rate,
        }));
    }
    Ok(result)
}
