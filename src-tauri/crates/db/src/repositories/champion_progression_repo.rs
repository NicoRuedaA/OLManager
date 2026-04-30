use ofm_core::champions::{ChampionMasteryEntry, ChampionPatchState};
use rusqlite::{Connection, OptionalExtension, params};

pub fn upsert_state(
    conn: &Connection,
    champion_masteries: &[ChampionMasteryEntry],
    champion_patch: &ChampionPatchState,
) -> Result<(), String> {
    let masteries_json =
        serde_json::to_string(champion_masteries).map_err(|e| format!("JSON error: {}", e))?;
    let patch_json =
        serde_json::to_string(champion_patch).map_err(|e| format!("JSON error: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO champion_progression_state (id, champion_masteries_json, champion_patch_json)
         VALUES ('singleton', ?1, ?2)",
        params![masteries_json, patch_json],
    )
    .map_err(|e| format!("Failed to upsert champion progression state: {}", e))?;

    Ok(())
}

pub fn load_state(
    conn: &Connection,
) -> Result<Option<(Vec<ChampionMasteryEntry>, ChampionPatchState)>, String> {
    let row = conn
        .query_row(
            "SELECT champion_masteries_json, champion_patch_json
             FROM champion_progression_state WHERE id = 'singleton'",
            [],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                ))
            },
        )
        .optional()
        .map_err(|e| format!("Failed to load champion progression state: {}", e))?;

    let Some((masteries_json, patch_json)) = row else {
        return Ok(None);
    };

    let champion_masteries =
        serde_json::from_str::<Vec<ChampionMasteryEntry>>(&masteries_json).unwrap_or_default();
    let champion_patch =
        serde_json::from_str::<ChampionPatchState>(&patch_json).unwrap_or_default();

    Ok(Some((champion_masteries, champion_patch)))
}
