use super::definitions::{WorldData, WorldDatabaseInfo};

/// Convert a team name to a filesystem-safe slug for logo lookup.
fn team_name_to_logo_slug(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect()
}

/// Parse a JSON string into a `WorldData`.
pub fn load_world_from_json(json: &str) -> Result<WorldData, String> {
    let mut world: WorldData =
        serde_json::from_str(json).map_err(|e| format!("Failed to parse world database: {}", e))?;
    for team in &mut world.teams {
        // Populate logo_url if missing
        if team.logo_url.is_none() {
            let slug = team_name_to_logo_slug(&team.name);
            team.logo_url = Some(format!("/teams-icons/{}.webp", slug));
        }
    }
    crate::identity_upgrade::upgrade_world_football_identities(
        &mut world.teams,
        &mut world.players,
        &mut world.staff,
    );
    Ok(world)
}

/// Serialise a `WorldData` to a pretty-printed JSON string.
pub fn export_world_to_json(world: &WorldData) -> Result<String, String> {
    let mut normalized = world.clone();
    crate::identity_upgrade::upgrade_world_football_identities(
        &mut normalized.teams,
        &mut normalized.players,
        &mut normalized.staff,
    );
    serde_json::to_string_pretty(&normalized)
        .map_err(|e| format!("Failed to serialise world: {}", e))
}

/// Scan a directory for `.json` world database files and return their metadata.
pub fn scan_world_databases(dir: &std::path::Path) -> Vec<WorldDatabaseInfo> {
    let mut results = Vec::new();
    let Ok(entries) = std::fs::read_dir(dir) else {
        return results;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let Ok(contents) = std::fs::read_to_string(&path) else {
            continue;
        };
        // Parse just enough to get metadata — try full parse
        if let Ok(world) = load_world_from_json(&contents) {
            let file_stem = path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            results.push(WorldDatabaseInfo {
                id: format!("file:{}", path.display()),
                name: world.name,
                description: world.description,
                team_count: world.teams.len(),
                player_count: world.players.len(),
                source: "user".to_string(),
                path: path.to_string_lossy().to_string(),
            });
            // suppress unused variable warning
            let _ = file_stem;
        }
    }
    results
}


