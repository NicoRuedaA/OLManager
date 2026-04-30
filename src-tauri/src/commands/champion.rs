use db::game_database::GameDatabase;
use db::repositories::champion_repo;
use domain::champion::Champion;

/// Get all champions from the database.
/// Creates an in-memory database if needed to access champion data.
#[tauri::command]
pub fn get_champions() -> Result<Vec<Champion>, String> {
    log::debug!("[cmd] get_champions");
    let db = GameDatabase::open_in_memory()?;
    champion_repo::get_all_champions(db.conn())
}

/// Get a single champion by its numeric ID.
#[tauri::command]
pub fn get_champion_by_id(id: i64) -> Result<Option<Champion>, String> {
    log::debug!("[cmd] get_champion_by_id: id={}", id);
    let db = GameDatabase::open_in_memory()?;
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
