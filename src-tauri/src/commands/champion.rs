use db::game_database::GameDatabase;
use db::repositories::champion_repo;
use domain::champion::Champion;
use ofm_core::state::StateManager;
use tauri::State;

use crate::SaveManagerState;

/// Get all champions from the active save game database.
/// Assumes the database is already seeded (via write_game in game_persistence).
#[tauri::command]
pub fn get_champions(
    state: State<'_, StateManager>,
    sm_state: State<'_, SaveManagerState>,
) -> Result<Vec<Champion>, String> {
    log::debug!("[cmd] get_champions");

    // Get the active save ID from the state manager
    let save_id = state
        .get_save_id()
        .ok_or("No active game session - cannot get champions".to_string())?;

    // Open the correct save game database using the SaveManager
    let mut sm = sm_state
        .0
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    // Use cached database - returns Arc<Mutex<GameDatabase>>
    let db_arc = sm.open_game_db(&save_id)?;
    let db = db_arc.lock().map_err(|e| format!("Lock error: {}", e))?;
    let conn = db.conn();

    // Read champions - no lazy seed needed (seed happens in write_game)
    champion_repo::get_all_champions(conn)
}

/// Get a single champion by its numeric ID from the active save game database.
#[tauri::command]
pub fn get_champion_by_id(
    id: i64,
    state: State<'_, StateManager>,
    sm_state: State<'_, SaveManagerState>,
) -> Result<Option<Champion>, String> {
    log::debug!("[cmd] get_champion_by_id: id={}", id);

    let save_id = state
        .get_save_id()
        .ok_or("No active game session - cannot get champion".to_string())?;

    let mut sm = sm_state
        .0
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    // Use cached database - returns Arc<Mutex<GameDatabase>>
    let db_arc = sm.open_game_db(&save_id)?;
    let db = db_arc.lock().map_err(|e| format!("Lock error: {}", e))?;
    champion_repo::get_champion_by_id(db.conn(), id)
}

/// Seed champions from a JSON content string.
/// This is idempotent - if champions already exist, it returns 0.
#[tauri::command]
pub fn seed_champions_from_json(json_content: String) -> Result<usize, String> {
    log::debug!("[cmd] seed_champions_from_json: len={}", json_content.len());
    let db = GameDatabase::open_in_memory()?;
    champion_repo::seed_from_json(db.conn(), &json_content)
}
