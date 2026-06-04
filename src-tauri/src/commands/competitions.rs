use domain::staff::Staff;
use log::info;
use ofm_core::generator::definitions::{
    CompetitionManifest, CompetitionSummary, LeagueSelectionData, PlayerDataFile, StaffDataFile,
    TeamDataFile, TeamSummary,
};
use std::path::PathBuf;
use tauri::Manager as TauriManager;

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

/// Resolve the base `data/competitions/` directory with multi-tier fallback.
/// Order: resource_dir/../data/competitions → resource_dir/data/competitions → cwd/../data/competitions → cwd/data/competitions
fn resolve_competitions_base(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    let cwd = std::env::current_dir().ok()?;
    info!("[competitions] cwd: {:?}", cwd);

    let candidates: Vec<Option<PathBuf>> = vec![
        // resource_dir() suele ser src-tauri/ en dev; probamos primero /../data/competitions
        app_handle
            .path()
            .resource_dir()
            .ok()
            .and_then(|dir| dir.parent().map(|p| p.join("data").join("competitions"))),
        // resource_dir/data/competitions (producción)
        app_handle
            .path()
            .resource_dir()
            .ok()
            .map(|dir| dir.join("data").join("competitions")),
        // cwd puede ser src-tauri/ durante tauri dev, subimos un nivel
        Some(cwd.join("..").join("data").join("competitions")),
        // o cwd puede ser la raíz del proyecto
        Some(cwd.join("data").join("competitions")),
    ];

    let candidate_count = candidates.len();
    for candidate in candidates.into_iter().flatten() {
        info!("[competitions] checking candidate: {:?}", candidate);
        if candidate.is_dir() {
            info!("[competitions] resolved to: {:?}", candidate);
            return Some(candidate);
        }
    }

    info!("[competitions] no competitions directory found among {} candidates", candidate_count);
    None
}

// ---------------------------------------------------------------------------
// Manifest loading
// ---------------------------------------------------------------------------

/// Scan all competition directories and return their manifests.
pub fn scan_competitions(app_handle: &tauri::AppHandle) -> Vec<CompetitionManifest> {
    let base = match resolve_competitions_base(app_handle) {
        Some(b) => b,
        None => {
            info!("[competitions] no competitions directory found");
            return vec![];
        }
    };

    let entries = match std::fs::read_dir(&base) {
        Ok(e) => e,
        Err(err) => {
            info!("[competitions] failed to read competitions dir: {}", err);
            return vec![];
        }
    };

    let mut manifests = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let manifest_path = path.join("manifest.json");
        if !manifest_path.exists() {
            continue;
        }
        match std::fs::read_to_string(&manifest_path) {
            Ok(json) => match serde_json::from_str::<CompetitionManifest>(&json) {
                Ok(manifest) => {
                    info!(
                        "[competitions] loaded manifest: {} ({})",
                        manifest.id, manifest.name
                    );
                    manifests.push(manifest);
                }
                Err(err) => {
                    info!(
                        "[competitions] skipped malformed manifest at {:?}: {}",
                        manifest_path, err
                    );
                }
            },
            Err(err) => {
                info!(
                    "[competitions] failed to read manifest at {:?}: {}",
                    manifest_path, err
                );
            }
        }
    }

    manifests
}

/// Load a single competition manifest by ID.
pub fn load_competition_manifest(
    app_handle: &tauri::AppHandle,
    competition_id: &str,
) -> Result<CompetitionManifest, String> {
    let base = resolve_competitions_base(app_handle)
        .ok_or_else(|| "Competitions directory not found.".to_string())?;
    let manifest_path = base.join(competition_id).join("manifest.json");
    let json = std::fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read manifest for '{}': {}", competition_id, e))?;
    serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse manifest for '{}': {}", competition_id, e))
}

// ---------------------------------------------------------------------------
// Team / Player / Staff data loading
// ---------------------------------------------------------------------------

/// Resolve the base `data/` directory for runtime file reads.
/// Order: resource_dir parent → resource_dir → cwd/../data/ (project root) → cwd/data/ → cwd/src-tauri/data/
fn resolve_data_base(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    let cwd = std::env::current_dir().ok()?;

    let candidates: Vec<Option<PathBuf>> = vec![
        // resource_dir() suele ser src-tauri/ en dev; probamos /../data primero
        app_handle
            .path()
            .resource_dir()
            .ok()
            .and_then(|dir| dir.parent().map(|p| p.join("data"))),
        // resource_dir/data (producción)
        app_handle
            .path()
            .resource_dir()
            .ok()
            .map(|dir| dir.join("data")),
        // cwd puede ser src-tauri/ durante tauri dev, subimos un nivel
        Some(cwd.join("..").join("data")),
        // o cwd puede ser la raíz del proyecto
        Some(cwd.join("data")),
        // Fallback to src-tauri/data/ (legacy random world files)
        Some(cwd.join("src-tauri").join("data")),
    ];

    for candidate in candidates.into_iter().flatten() {
        if candidate.is_dir() {
            return Some(candidate);
        }
    }

    None
}

use domain::player::Player;
use domain::team::Team;

/// Load team data for a competition from its manifest's `teams_file` path.
pub fn load_competition_teams(
    app_handle: &tauri::AppHandle,
    manifest: &CompetitionManifest,
) -> Result<Vec<Team>, String> {
    let data_base = resolve_data_base(app_handle)
        .ok_or_else(|| "Data directory not found.".to_string())?;
    let teams_path = data_base.join(&manifest.teams_file);
    info!("[competitions] loading teams for '{}' from {:?}", manifest.id, teams_path);
    let json = std::fs::read_to_string(&teams_path).map_err(|e| {
        format!(
            "Failed to read teams file '{}' for '{}': {}",
            manifest.teams_file, manifest.id, e
        )
    })?;
    let data: TeamDataFile =
        serde_json::from_str(&json).map_err(|e| format!("Failed to parse teams data: {}", e))?;

    // Inject competition_id and fix logo paths
    let mut teams = data.teams;
    for team in &mut teams {
        team.competition_id = Some(manifest.id.clone());
        // Map legacy logo paths to actual files in public/teams-icons/
        if let Some(ref mut url) = team.logo_url {
            if url.starts_with("/team-logos/") {
                *url = url.replacen("/team-logos/", "/teams-icons/", 1);
            }
        }
    }
    Ok(teams)
}

/// Load player data for a competition from its manifest's `players_file` path.
pub fn load_competition_players(
    app_handle: &tauri::AppHandle,
    manifest: &CompetitionManifest,
) -> Result<Vec<Player>, String> {
    let data_base = resolve_data_base(app_handle)
        .ok_or_else(|| "Data directory not found.".to_string())?;
    let players_path = data_base.join(&manifest.players_file);
    info!("[competitions] loading players for '{}' from {:?}", manifest.id, players_path);
    let json = std::fs::read_to_string(&players_path).map_err(|e| {
        format!(
            "Failed to read players file '{}' for '{}': {}",
            manifest.players_file, manifest.id, e
        )
    })?;
    let data: PlayerDataFile = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse players data: {}", e))?;
    Ok(data.players)
}

/// Load staff data for a competition from its manifest's `staff_file` path.
/// Returns an empty vec if no staff_file is configured.
pub fn load_competition_staff(
    app_handle: &tauri::AppHandle,
    manifest: &CompetitionManifest,
) -> Result<Vec<Staff>, String> {
    let data_base = resolve_data_base(app_handle)
        .ok_or_else(|| "Data directory not found.".to_string())?;
    let staff_path = match &manifest.staff_file {
        Some(path) => data_base.join(path),
        None => return Ok(Vec::new()),
    };
    info!("[competitions] loading staff for '{}' from {:?}", manifest.id, staff_path);
    let json = std::fs::read_to_string(&staff_path).map_err(|e| {
        format!(
            "Failed to read staff file '{}' for '{}': {}",
            manifest.staff_file.as_deref().unwrap_or("?"),
            manifest.id,
            e
        )
    })?;
    let data: StaffDataFile = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse staff data: {}", e))?;
    Ok(data.staff)
}

/// Load free agent staff from `data/staffs/free_agents.json`.
pub fn load_staff_free_agents(
    app_handle: &tauri::AppHandle,
) -> Result<Vec<Staff>, String> {
    let data_base = resolve_data_base(app_handle)
        .ok_or_else(|| "Data directory not found.".to_string())?;
    let staff_path = data_base.join("staffs").join("free_agents.json");
    let json = std::fs::read_to_string(&staff_path).map_err(|e| {
        format!("Failed to read staff file: {}", e)
    })?;
    let data: StaffDataFile = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse staff data: {}", e))?;
    Ok(data.staff)
}

// ---------------------------------------------------------------------------
// League selection data
// ---------------------------------------------------------------------------

/// Build lightweight league selection metadata from all competition manifests
/// and their team rosters. This is read-only and does not require game state.
#[tauri::command]
pub fn get_league_selection_data(
    app_handle: tauri::AppHandle,
) -> Result<LeagueSelectionData, String> {
    info!("[cmd] get_league_selection_data");
    let manifests = scan_competitions(&app_handle);

    let mut competitions = Vec::new();
    for manifest in manifests {
        let teams = match load_competition_teams(&app_handle, &manifest) {
            Ok(t) => t,
            Err(err) => {
                info!(
                    "[competitions] skipping '{}' — teams not loaded: {}",
                    manifest.id, err
                );
                continue;
            }
        };

        // Build team summaries with player counts
        let players_result = load_competition_players(&app_handle, &manifest);
        let player_count_by_team: std::collections::HashMap<String, usize> = match &players_result {
            Ok(p) => {
                info!(
                    "[competitions] '{}' loaded {} players (raw team_ids: {:?})",
                    manifest.id,
                    p.len(),
                    p.iter().filter_map(|pl| pl.team_id.as_deref()).collect::<std::collections::HashSet<_>>()
                );
                let mut counts = std::collections::HashMap::new();
                for player in p {
                    if let Some(ref tid) = player.team_id {
                        *counts.entry(tid.clone()).or_default() += 1;
                    }
                }
                counts
            }
            Err(e) => {
                info!(
                    "[competitions] '{}' players NOT loaded: {}",
                    manifest.id, e
                );
                std::collections::HashMap::new()
            }
        };

        let mut team_summaries = Vec::new();
        let prefix = format!("{}-", manifest.id);
        for entry in &teams {
            // Avoid double-prefixing: team IDs from data files may already include the competition prefix
            let display_id = if entry.id.starts_with(&prefix) {
                entry.id.clone()
            } else {
                format!("{}-{}", manifest.id, entry.id)
            };
            let raw_id = &entry.id;
            let pc = player_count_by_team.get(raw_id).copied();
            info!(
                "[competitions] '{}' team '{}' (raw: '{}'): player_count={:?}",
                manifest.id, display_id, raw_id, pc
            );
            team_summaries.push(TeamSummary {
                id: display_id,
                name: entry.name.clone(),
                short_name: entry.short_name.clone(),
                logo_url: entry.logo_url.clone(),
                country: entry.country.clone(),
                city: Some(entry.city.clone()),
                finance: Some(entry.finance),
                reputation: Some(entry.reputation),
                colors: Some(entry.colors.clone()),
                ovr: None, // OVR not computed at selection time
                player_count: pc,
            });
        }

        // Only show Tier 1 competitions as playable
        let tier = manifest.tier.unwrap_or(0);
        if tier >= 1 {
            competitions.push(CompetitionSummary {
                id: manifest.id.clone(),
                name: manifest.name.clone(),
                region: manifest.region.clone(),
                logo: manifest.logo.clone(),
                team_count: manifest.schedule.team_count,
                teams: team_summaries,
            });
        } else {
            info!(
                "[competitions] skipping '{}' — Tier {} not playable",
                manifest.id, tier
            );
        }
    }

    info!(
        "[cmd] get_league_selection_data: {} competitions",
        competitions.len()
    );
    Ok(LeagueSelectionData { competitions })
}
