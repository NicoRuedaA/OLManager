use domain::staff::Staff;
use log::info;
use serde::Serialize;
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
/// Order: resource_dir → cwd/../data/competitions/ (project root) → cwd/data/competitions/
fn resolve_competitions_base(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    let cwd = std::env::current_dir().ok()?;

    let candidates: Vec<Option<PathBuf>> = vec![
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

    for candidate in candidates.into_iter().flatten() {
        if candidate.is_dir() {
            return Some(candidate);
        }
    }

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

    let data_base = resolve_data_base(app_handle);

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
                    // Validate manifest
                    if let Some(ref data_base) = data_base {
                        let validation = validate_competition_manifest(&manifest, data_base);
                        if !validation.valid {
                            info!(
                                "[competitions] SKIPPED '{}' — validation failed: {:?}",
                                manifest.id, validation.errors
                            );
                            continue;
                        }
                        if !validation.warnings.is_empty() {
                            for w in &validation.warnings {
                                info!("[competitions] WARNING '{}': {}", manifest.id, w);
                            }
                        }
                    }

                    info!(
                        "[competitions] loaded + validated manifest: {} ({})",
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
// Manifest validation
// ---------------------------------------------------------------------------

/// Validation errors for a competition manifest.
#[derive(Debug, Clone, Serialize)]
pub struct ManifestValidation {
    pub id: String,
    pub name: String,
    pub tier: Option<u8>,
    pub version: Option<u32>,
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// Validate a competition manifest against tier requirements.
/// Returns a list of errors (fatal) and warnings (advisory).
pub fn validate_competition_manifest(
    manifest: &CompetitionManifest,
    data_base: &std::path::Path,
) -> ManifestValidation {
    let mut errors: Vec<String> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();

    let tier = manifest.tier.unwrap_or(2);

    // General checks (all tiers)
    if manifest.id.is_empty() {
        errors.push("id is empty".to_string());
    }
    if manifest.name.is_empty() {
        errors.push("name is empty".to_string());
    }
    if manifest.schedule.splits.is_empty() {
        errors.push("schedule.splits is empty — must define at least one split".to_string());
    }
    if manifest.schedule.team_count == 0 {
        errors.push("schedule.team_count must be > 0".to_string());
    }

    // Tier 1 checks: MUST have real teams + players + scheduling rules
    if tier >= 1 {
        // teams_file must exist
        let teams_path = data_base.join(&manifest.teams_file);
        if !teams_path.exists() {
            errors.push(format!(
                "teams_file '{}' not found at {:?}",
                manifest.teams_file, teams_path
            ));
        }

        // players_file must exist
        let players_path = data_base.join(&manifest.players_file);
        if !players_path.exists() {
            errors.push(format!(
                "players_file '{}' not found at {:?}",
                manifest.players_file, players_path
            ));
        }

        // schedule must define a known format
        let known_formats = [
            "double_round_robin",
            "single_round_robin",
            "swiss",
            "groups",
        ];
        if !known_formats.contains(&manifest.schedule.format.as_str()) {
            warnings.push(format!(
                "schedule.format '{}' is not a known format — calendar generation may fail",
                manifest.schedule.format
            ));
        }

        // Check team_count matches actual teams file (best-effort, not fatal)
        if teams_path.exists() {
            if let Ok(json) = std::fs::read_to_string(&teams_path) {
                if let Ok(data) = serde_json::from_str::<TeamDataFile>(&json) {
                    if data.teams.len() as u32 != manifest.schedule.team_count {
                        warnings.push(format!(
                            "schedule.team_count ({}) does not match actual teams in '{}' ({})",
                            manifest.schedule.team_count,
                            manifest.teams_file,
                            data.teams.len()
                        ));
                    }
                }
            }
        }
    } else {
        // Tier 2+: warn if referenced files don't exist (not fatal)
        let teams_path = data_base.join(&manifest.teams_file);
        if !teams_path.exists() {
            warnings.push(format!(
                "teams_file '{}' not found — Tier 2 competition may be incomplete",
                manifest.teams_file
            ));
        }
        let players_path = data_base.join(&manifest.players_file);
        if !players_path.exists() {
            warnings.push(format!(
                "players_file '{}' not found — Tier 2 competition may be incomplete",
                manifest.players_file
            ));
        }
    }

    ManifestValidation {
        id: manifest.id.clone(),
        name: manifest.name.clone(),
        tier: manifest.tier,
        version: manifest.version,
        valid: errors.is_empty(),
        errors,
        warnings,
    }
}

/// Resolve the base `data/` directory for runtime file reads.
/// Order: resource_dir → cwd/../data/ (project root) → cwd/data/ → cwd/src-tauri/data/
fn resolve_data_base(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    let cwd = std::env::current_dir().ok()?;

    let candidates: Vec<Option<PathBuf>> = vec![
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
// Validation report (Tauri command)
// ---------------------------------------------------------------------------

/// Returns validation reports for all competition manifests.
/// Useful for debugging manifest issues.
#[tauri::command]
pub fn validate_all_competitions(
    app_handle: tauri::AppHandle,
) -> Vec<ManifestValidation> {
    let manifests = scan_competitions_raw(&app_handle);
    let data_base = resolve_data_base(&app_handle);

    manifests
        .into_iter()
        .map(|manifest| {
            if let Some(ref data_base) = data_base {
                validate_competition_manifest(&manifest, data_base)
            } else {
                ManifestValidation {
                    id: manifest.id,
                    name: manifest.name,
                    tier: manifest.tier,
                    version: manifest.version,
                    valid: false,
                    errors: vec!["Data directory not found.".to_string()],
                    warnings: vec![],
                }
            }
        })
        .collect()
}

/// Scan manifest files WITHOUT validation (used for validation reporting).
fn scan_competitions_raw(app_handle: &tauri::AppHandle) -> Vec<CompetitionManifest> {
    let base = match resolve_competitions_base(app_handle) {
        Some(b) => b,
        None => return vec![],
    };

    let entries = match std::fs::read_dir(&base) {
        Ok(e) => e,
        Err(_) => return vec![],
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
        if let Ok(json) = std::fs::read_to_string(&manifest_path) {
            if let Ok(manifest) = serde_json::from_str::<CompetitionManifest>(&json) {
                manifests.push(manifest);
            }
        }
    }
    manifests
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

        let mut team_summaries = Vec::new();
        let prefix = format!("{}-", manifest.id);
        for entry in &teams {
            // Avoid double-prefixing: team IDs from data files may already include the competition prefix
            let display_id = if entry.id.starts_with(&prefix) {
                entry.id.clone()
            } else {
                format!("{}-{}", manifest.id, entry.id)
            };
            team_summaries.push(TeamSummary {
                id: display_id,
                name: entry.name.clone(),
                short_name: entry.short_name.clone(),
                logo_url: entry.logo_url.clone(),
                country: entry.country.clone(),
                ovr: None, // OVR not computed at selection time
            });
        }

        competitions.push(CompetitionSummary {
            id: manifest.id.clone(),
            name: manifest.name.clone(),
            region: manifest.region.clone(),
            logo: manifest.logo.clone(),
            team_count: manifest.schedule.team_count,
            teams: team_summaries,
        });
    }

    info!(
        "[cmd] get_league_selection_data: {} competitions",
        competitions.len()
    );
    Ok(LeagueSelectionData { competitions })
}

// ---------------------------------------------------------------------------
// Runtime ERL loading
// ---------------------------------------------------------------------------

use crate::commands::game::{parse_example_academy_file, ExampleAcademyTeamSeed};

/// Load ERL (European Regional League) academy data from manifests at runtime.
/// Falls back to compile-time `include_str!` catalog if files can't be read.
pub fn load_erls_from_manifest(
    app_handle: &tauri::AppHandle,
    manifest: &CompetitionManifest,
) -> Vec<ExampleAcademyTeamSeed> {
    let data_base = match resolve_data_base(app_handle) {
        Some(b) => b,
        None => return vec![],
    };

    let erl_dir = data_base.join("erls");
    let mut all_teams = Vec::new();

    for erl_file in &manifest.erls {
        let path = erl_dir.join(erl_file);
        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(err) => {
                info!(
                    "[competitions] ERL file '{}' not found at {:?}: {}",
                    erl_file, path, err
                );
                continue;
            }
        };

        // Infer league metadata from filename
        let league_id = erl_file
            .trim_end_matches(".txt")
            .to_lowercase()
            .replace(' ', "-");
        let league_name = erl_file.trim_end_matches(".txt").to_string();
        let country_code = match league_id.as_str() {
            "les" | "liga-espanola" => "ES",
            "lfl" => "FR",
            "prime-league" => "DE",
            _ => "EU",
        };

        let teams =
            parse_example_academy_file(&league_id, &league_name, country_code, &content);
        all_teams.extend(teams);
    }

    all_teams
}

// ---------------------------------------------------------------------------
// Runtime file loading helpers
// ---------------------------------------------------------------------------

/// Read the contents of a data file at runtime, with multi-tier resolution.
/// Searches: resource_dir/data/ → cwd/src-tauri/data/ → cwd/data/
pub fn read_data_file(
    app_handle: &tauri::AppHandle,
    relative_path: &str,
) -> Option<String> {
    let data_base = resolve_data_base(app_handle)?;
    let path = data_base.join(relative_path);

    match std::fs::read_to_string(&path) {
        Ok(content) => {
            info!("[data] read runtime file: {:?}", path);
            Some(content)
        }
        Err(err) => {
            info!(
                "[data] file '{}' not found at {:?}: {}",
                relative_path, path, err
            );
            None
        }
    }
}

/// Load draft/champions seed data from a competition's championships_file at runtime.
pub fn load_draft_seed_runtime(
    app_handle: &tauri::AppHandle,
    manifest: &CompetitionManifest,
) -> Option<String> {
    let championships_file = manifest.championships_file.as_deref()?;
    read_data_file(app_handle, championships_file)
}
