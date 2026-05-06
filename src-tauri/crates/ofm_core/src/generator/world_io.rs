use super::definitions::{WorldData, WorldDatabaseInfo};

/// Generate a random world and wrap it in a `WorldData`.
/// If `data_dir` is provided, tries to load definition files from that directory.
pub fn generate_world_data(data_dir: Option<&std::path::Path>) -> WorldData {
    let (mut teams, mut players, mut staff) = super::generate_world(data_dir);
    crate::identity_upgrade::upgrade_world_football_identities(
        &mut teams,
        &mut players,
        &mut staff,
    );

    WorldData {
        name: "Random World".to_string(),
        description: format!(
            "Randomly generated league with {} teams across Europe",
            teams.len()
        ),
        teams,
        players,
        staff,
    }
}

/// Parse a JSON string into a `WorldData`.
pub fn load_world_from_json(json: &str) -> Result<WorldData, String> {
    let mut world: WorldData =
        serde_json::from_str(json).map_err(|e| format!("Failed to parse world database: {}", e))?;
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

/// Load a world from a split directory containing teams/, players/, staff/ subdirectories.
/// Each subdirectory contains per-league JSON files (e.g. lec_teams.json, lck_teams.json).
/// All files matching `*_teams.json`, `*_players.json`, `*_staffs.json` are aggregated.
pub fn load_world_from_split_dir(base_dir: &std::path::Path) -> Result<WorldData, String> {
    let teams_dir = base_dir.join("teams");
    let players_dir = base_dir.join("players");
    let staffs_dir = base_dir.join("staffs");

    let mut all_teams: Vec<domain::team::Team> = Vec::new();
    let mut all_players: Vec<domain::player::Player> = Vec::new();
    let mut all_staff: Vec<domain::staff::Staff> = Vec::new();

    // Load teams from all *_teams.json files
    if let Ok(entries) = std::fs::read_dir(&teams_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if !fname.ends_with("_teams.json") || fname.ends_with("_disbanded.json") { continue; }
            let json = std::fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
            let container: serde_json::Value = serde_json::from_str(&json)
                .map_err(|e| format!("Failed to parse {}: {}", path.display(), e))?;
            let teams: Vec<domain::team::Team> = serde_json::from_value(container["teams"].clone())
                .map_err(|e| format!("Failed to deserialize teams from {}: {}", path.display(), e))?;
            all_teams.extend(teams);
        }
    }

    // Load players from all *_players.json files (except free_agents which have no team_id)
    if let Ok(entries) = std::fs::read_dir(&players_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if !fname.ends_with("_players.json") { continue; }
            let json = std::fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
            let container: serde_json::Value = serde_json::from_str(&json)
                .map_err(|e| format!("Failed to parse {}: {}", path.display(), e))?;
            let players: Vec<domain::player::Player> = serde_json::from_value(container["players"].clone())
                .map_err(|e| format!("Failed to deserialize players from {}: {}", path.display(), e))?;
            all_players.extend(players);
        }
    }

    // Load free agents if present
    let free_agents_path = players_dir.join("free_agents.json");
    if free_agents_path.exists() {
        let json = std::fs::read_to_string(&free_agents_path)
            .map_err(|e| format!("Failed to read {}: {}", free_agents_path.display(), e))?;
        let container: serde_json::Value = serde_json::from_str(&json)
            .map_err(|e| format!("Failed to parse free agents: {}", e))?;
        let players: Vec<domain::player::Player> = serde_json::from_value(container["players"].clone())
            .map_err(|e| format!("Failed to deserialize free agents: {}", e))?;
        all_players.extend(players);
    }

    // Load staff from all *_staffs.json files
    if let Ok(entries) = std::fs::read_dir(&staffs_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if !fname.ends_with("_staffs.json") { continue; }
            let json = std::fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
            let container: serde_json::Value = serde_json::from_str(&json)
                .map_err(|e| format!("Failed to parse {}: {}", path.display(), e))?;
            let staff: Vec<domain::staff::Staff> = serde_json::from_value(container["staff"].clone())
                .map_err(|e| format!("Failed to deserialize staff from {}: {}", path.display(), e))?;
            all_staff.extend(staff);
        }
    }

    // Load free agent staff if present
    let free_staff_path = staffs_dir.join("free_agents.json");
    if free_staff_path.exists() {
        let json = std::fs::read_to_string(&free_staff_path)
            .map_err(|e| format!("Failed to read {}: {}", free_staff_path.display(), e))?;
        let container: serde_json::Value = serde_json::from_str(&json)
            .map_err(|e| format!("Failed to parse free staff: {}", e))?;
        let staff: Vec<domain::staff::Staff> = serde_json::from_value(container["staff"].clone())
            .map_err(|e| format!("Failed to deserialize free staff: {}", e))?;
        all_staff.extend(staff);
    }

    let mut world = WorldData {
        name: "World".to_string(),
        description: format!(
            "{} teams, {} players, {} staff",
            all_teams.len(),
            all_players.len(),
            all_staff.len()
        ),
        teams: all_teams,
        players: all_players,
        staff: all_staff,
    };
    crate::identity_upgrade::upgrade_world_football_identities(
        &mut world.teams,
        &mut world.players,
        &mut world.staff,
    );
    Ok(world)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn load_world_from_json_normalizes_legacy_english_world_data() {
        let json = r##"
                {
                    "name": "Legacy World",
                    "description": "Old GB world",
                    "teams": [
                        {
                            "id": "team-1",
                            "name": "London FC",
                            "short_name": "LFC",
                            "country": "GB",
                            "city": "London",
                            "arena_name": "London Arena",
                            "arena_capacity": 50000,
                            "finance": 1000000,
                            "manager_id": null,
                            "reputation": 500,
                            "wage_budget": 100000,
                            "transfer_budget": 250000,
                            "season_income": 0,
                            "season_expenses": 0,
                            "formation": "4-4-2",
                            "play_style": "Balanced",
                            "training_focus": "Scrims",
                            "training_intensity": "Medium",
                            "training_schedule": "Balanced",
                            "founded_year": 1900,
                            "colors": { "primary": "#ffffff", "secondary": "#000000" },
                            "starting_xi_ids": [],
                            "match_roles": { "captain": null, "shotcaller": null },
                            "form": [],
                            "history": []
                        }
                    ],
                    "players": [
                        {
                            "id": "player-1",
                            "match_name": "J. Doe",
                            "full_name": "John Doe",
                            "date_of_birth": "2000-01-01",
                            "nationality": "GB",
                            "position": "Midfielder",
                            "natural_position": "Midfielder",
                            "alternate_positions": [],
                            "footedness": "Right",
                            "weak_foot": 2,
                            "attributes": {
                                "pace": 70, "stamina": 70, "strength": 70, "agility": 70,
                                "passing": 70, "shooting": 70, "tackling": 70, "dribbling": 70,
                                "defending": 70, "positioning": 70, "vision": 70, "decisions": 70,
                                "composure": 70, "aggression": 70, "teamwork": 70, "leadership": 70,
                                "handling": 20, "reflexes": 20, "aerial": 60
                            },
                            "condition": 100,
                            "morale": 100,
                            "fitness": 75,
                            "injury": null,
                            "team_id": "team-1",
                            "traits": [],
                            "contract_end": null,
                            "wage": 0,
                            "market_value": 0,
                            "stats": { "appearances": 0, "goals": 0, "assists": 0, "clean_sheets": 0, "avg_rating": 0.0, "minutes_played": 0 },
                            "career": [],
                            "training_focus": null,
                            "transfer_listed": false,
                            "loan_listed": false,
                            "transfer_offers": [],
                            "morale_core": { "manager_trust": 50, "unresolved_issue": null, "recent_treatment": null, "pending_promise": null, "talk_cooldown_until": null, "renewal_state": null }
                        }
                    ],
                    "staff": []
                }
                "##;

        let world = load_world_from_json(json).unwrap();

        assert_eq!(world.players[0].birth_country, None);
    }

    #[test]
    fn active_lec_world_seed_does_not_contain_football_nation() {
        let json = include_str!("../../../../databases/teams/lec_teams.json");

        // Assert: active seed data must NOT contain football_nation keys
        assert!(
            !json.contains("football_nation"),
            "Active LEC world seed should not contain legacy 'football_nation' field"
        );
    }

    #[test]
    fn export_world_to_json_writes_canonical_football_identity_fields() {
        let mut world = generate_world_data(None);
        world.teams[0].country = "GB".to_string();

        if let Some(player) = world
            .players
            .iter_mut()
            .find(|player| player.team_id.as_deref() == Some(world.teams[0].id.as_str()))
        {
            player.nationality = "GB".to_string();
            player.birth_country = None;
        }

        let json = export_world_to_json(&world).unwrap();
        let reparsed: WorldData = serde_json::from_str(&json).unwrap();

    }
}
