use domain::transfer_history::TransferHistory;
use rusqlite::{params, Connection};

pub fn upsert_transfer_history(
    conn: &Connection,
    history: &TransferHistory,
) -> Result<(), String> {
    let entries_json =
        serde_json::to_string(&history.entries).map_err(|e| format!("JSON error: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO transfer_history (id, entries_json) VALUES ('singleton', ?1)",
        params![entries_json],
    )
    .map_err(|e| format!("Failed to upsert transfer_history: {}", e))?;
    Ok(())
}

pub fn load_transfer_history(conn: &Connection) -> Result<TransferHistory, String> {
    let entries_json: Option<String> = conn
        .query_row(
            "SELECT entries_json FROM transfer_history WHERE id = 'singleton'",
            [],
            |row| row.get(0),
        )
        .ok();

    let entries = match entries_json {
        Some(json) => serde_json::from_str(&json).unwrap_or_default(),
        None => Vec::new(),
    };

    Ok(TransferHistory { entries })
}
