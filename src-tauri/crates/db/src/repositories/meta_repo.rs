use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

/// Game metadata stored as a singleton row in `game_meta`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameMeta {
    pub save_id: String,
    pub save_name: String,
    pub manager_id: String,
    pub start_date: String,
    pub game_date: String,
    pub created_at: String,
    pub last_played_at: String,
    // Multiplayer fields (V29)
    #[serde(default)]
    pub player2_manager_id: Option<String>,
    #[serde(default)]
    pub multiplayer_mode: String, // "offline", "hotseat", "online"
    #[serde(default)]
    pub room_code: Option<String>,
}

/// Insert or replace the singleton game_meta row.
pub fn upsert_meta(conn: &Connection, meta: &GameMeta) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO game_meta (id, save_id, save_name, manager_id, start_date, game_date, created_at, last_played_at, player2_manager_id, multiplayer_mode, room_code)
         VALUES ('singleton', ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            meta.save_id,
            meta.save_name,
            meta.manager_id,
            meta.start_date,
            meta.game_date,
            meta.created_at,
            meta.last_played_at,
            meta.player2_manager_id,
            meta.multiplayer_mode,
            meta.room_code,
        ],
    )
    .map_err(|e| format!("Failed to upsert game_meta: {}", e))?;
    Ok(())
}

/// Load the singleton game_meta row. Returns None if no meta exists.
pub fn load_meta(conn: &Connection) -> Result<Option<GameMeta>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT save_id, save_name, manager_id, start_date, game_date, created_at, last_played_at, player2_manager_id, multiplayer_mode, room_code
              FROM game_meta WHERE id = 'singleton'",
        )
        .map_err(|e| format!("Failed to prepare meta query: {}", e))?;

    let mut rows = stmt
        .query_map([], |row| {
            Ok(GameMeta {
                save_id: row.get(0)?,
                save_name: row.get(1)?,
                manager_id: row.get(2)?,
                start_date: row.get(3)?,
                game_date: row.get(4)?,
                created_at: row.get(5)?,
                last_played_at: row.get(6)?,
                player2_manager_id: row.get(7)?,
                multiplayer_mode: row.get(8)?,
                room_code: row.get(9)?,
            })
        })
        .map_err(|e| format!("Failed to query meta: {}", e))?;

    match rows.next() {
        Some(Ok(meta)) => Ok(Some(meta)),
        Some(Err(e)) => Err(format!("Failed to read meta row: {}", e)),
        None => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_database::GameDatabase;

    fn test_db() -> GameDatabase {
        GameDatabase::open_in_memory().unwrap()
    }

    #[test]
    fn test_upsert_and_load_meta() {
        let db = test_db();
        let meta = GameMeta {
            save_id: "save-001".to_string(),
            save_name: "Test Career".to_string(),
            manager_id: "mgr_user".to_string(),
            start_date: "2026-07-01T00:00:00Z".to_string(),
            game_date: "2026-07-15T00:00:00Z".to_string(),
            created_at: "2026-03-05T18:00:00Z".to_string(),
            last_played_at: "2026-03-05T19:00:00Z".to_string(),
            multiplayer_mode: "Offline".to_string(),
            player2_manager_id: None,
            room_code: None,
        };

        upsert_meta(db.conn(), &meta).unwrap();
        let loaded = load_meta(db.conn()).unwrap().unwrap();

        assert_eq!(loaded.save_id, "save-001");
        assert_eq!(loaded.save_name, "Test Career");
        assert_eq!(loaded.manager_id, "mgr_user");
        assert_eq!(loaded.game_date, "2026-07-15T00:00:00Z");
    }

    #[test]
    fn test_load_meta_empty() {
        let db = test_db();
        let loaded = load_meta(db.conn()).unwrap();
        assert!(loaded.is_none());
    }

    #[test]
    fn test_upsert_meta_overwrites() {
        let db = test_db();
        let meta1 = GameMeta {
            save_id: "save-001".to_string(),
            save_name: "Career v1".to_string(),
            manager_id: "mgr_user".to_string(),
            start_date: "2026-07-01T00:00:00Z".to_string(),
            game_date: "2026-07-15T00:00:00Z".to_string(),
            created_at: "2026-03-05T18:00:00Z".to_string(),
            last_played_at: "2026-03-05T19:00:00Z".to_string(),
            multiplayer_mode: "Offline".to_string(),
            player2_manager_id: None,
            room_code: None,
        };
        upsert_meta(db.conn(), &meta1).unwrap();

        let meta2 = GameMeta {
            save_id: "save-001".to_string(),
            save_name: "Career v2".to_string(),
            manager_id: "mgr_user".to_string(),
            start_date: "2026-07-01T00:00:00Z".to_string(),
            game_date: "2026-08-01T00:00:00Z".to_string(),
            created_at: "2026-03-05T18:00:00Z".to_string(),
            last_played_at: "2026-03-06T10:00:00Z".to_string(),
            multiplayer_mode: "Offline".to_string(),
            player2_manager_id: None,
            room_code: None,
        };
        upsert_meta(db.conn(), &meta2).unwrap();

        let loaded = load_meta(db.conn()).unwrap().unwrap();
        assert_eq!(loaded.save_name, "Career v2");
        assert_eq!(loaded.game_date, "2026-08-01T00:00:00Z");
    }
}
