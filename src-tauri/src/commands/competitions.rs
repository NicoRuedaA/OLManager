use olm_core::domain::player::Player;
use olm_core::domain::staff::Staff;
use olm_core::domain::team::Team;
use log::info;
use olm_core::competitions;
use olm_core::generator::definitions::{
    CompetitionManifest, LeagueSelectionData,
};
use std::path::PathBuf;
use tauri::Manager as TauriManager;

// ---------------------------------------------------------------------------
// Path resolution (Tauri-specific — uses AppHandle)
// ---------------------------------------------------------------------------

/// Resolve the base `data/competitions/` directory with multi-tier fallback.
fn resolve_competitions_base(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    let cwd = std::env::current_dir().ok()?;
    info!("[competitions] cwd: {:?}", cwd);

    let candidates: Vec<Option<PathBuf>> = vec![
        // Imported OLMDBManager data (writable app-data dir) takes precedence.
        app_handle
            .path()
            .app_data_dir()
            .ok()
            .map(|dir| dir.join("data").join("competitions")),
        // Tauri rewrites the leading `..` of bundled resource globs (e.g.
        // `../data/...`) into a literal `_up_` directory under the resource dir,
        // so the installed data lives at `<resource_dir>/_up_/data/...`.
        app_handle
            .path()
            .resource_dir()
            .ok()
            .map(|dir| dir.join("_up_").join("data").join("competitions")),
        app_handle
            .path()
            .resource_dir()
            .ok()
            .and_then(|dir| dir.parent().map(|p| p.join("data").join("competitions"))),
        app_handle
            .path()
            .resource_dir()
            .ok()
            .map(|dir| dir.join("data").join("competitions")),
        Some(cwd.join("..").join("data").join("competitions")),
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

/// Resolve the base `data/` directory for runtime file reads.
pub fn resolve_data_base(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    let cwd = std::env::current_dir().ok()?;

    let candidates: Vec<Option<PathBuf>> = vec![
        // Imported OLMDBManager data (writable app-data dir) takes precedence.
        app_handle
            .path()
            .app_data_dir()
            .ok()
            .map(|dir| dir.join("data")),
        // Tauri rewrites the leading `..` of bundled resource globs (e.g.
        // `../data/...`) into a literal `_up_` directory under the resource dir,
        // so the installed data lives at `<resource_dir>/_up_/data/...`.
        app_handle
            .path()
            .resource_dir()
            .ok()
            .map(|dir| dir.join("_up_").join("data")),
        app_handle
            .path()
            .resource_dir()
            .ok()
            .and_then(|dir| dir.parent().map(|p| p.join("data"))),
        app_handle
            .path()
            .resource_dir()
            .ok()
            .map(|dir| dir.join("data")),
        Some(cwd.join("..").join("data")),
        Some(cwd.join("data")),
        Some(cwd.join("src-tauri").join("data")),
    ];

    for candidate in candidates.into_iter().flatten() {
        if candidate.is_dir() {
            return Some(candidate);
        }
    }

    None
}

// ---------------------------------------------------------------------------
// Thin wrappers — resolve paths and delegate to olm_core
// ---------------------------------------------------------------------------

pub fn scan_competitions(app_handle: &tauri::AppHandle) -> Vec<CompetitionManifest> {
    let Some(base) = resolve_competitions_base(app_handle) else {
        return vec![];
    };
    competitions::scan_competitions(&base)
}

pub fn load_competition_manifest(
    app_handle: &tauri::AppHandle,
    competition_id: &str,
) -> Result<CompetitionManifest, String> {
    let base = resolve_competitions_base(app_handle)
        .ok_or_else(|| "Competitions directory not found.".to_string())?;
    competitions::load_competition_manifest(&base, competition_id)
}

pub fn load_competition_teams(
    app_handle: &tauri::AppHandle,
    manifest: &CompetitionManifest,
) -> Result<Vec<Team>, String> {
    let data_base = resolve_data_base(app_handle)
        .ok_or_else(|| "Data directory not found.".to_string())?;
    competitions::load_teams(&data_base, manifest)
}

pub fn load_competition_players(
    app_handle: &tauri::AppHandle,
    manifest: &CompetitionManifest,
) -> Result<Vec<Player>, String> {
    let data_base = resolve_data_base(app_handle)
        .ok_or_else(|| "Data directory not found.".to_string())?;
    competitions::load_players(&data_base, manifest)
}

pub fn load_competition_staff(
    app_handle: &tauri::AppHandle,
    manifest: &CompetitionManifest,
) -> Result<Vec<Staff>, String> {
    let data_base = resolve_data_base(app_handle)
        .ok_or_else(|| "Data directory not found.".to_string())?;
    competitions::load_staff(&data_base, manifest)
}

pub fn load_staff_free_agents(app_handle: &tauri::AppHandle) -> Result<Vec<Staff>, String> {
    let data_base = resolve_data_base(app_handle)
        .ok_or_else(|| "Data directory not found.".to_string())?;
    competitions::load_staff_free_agents(&data_base)
}

// ---------------------------------------------------------------------------
// Tauri command
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_league_selection_data(
    app_handle: tauri::AppHandle,
) -> Result<LeagueSelectionData, String> {
    info!("[cmd] get_league_selection_data");
    let data_base = resolve_data_base(&app_handle)
        .ok_or_else(|| "Data directory not found.".to_string())?;
    Ok(competitions::build_league_selection(&data_base))
}

