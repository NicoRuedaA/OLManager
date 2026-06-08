//! Desktop port of the web server's OLMDBManager auto-import.
//!
//! The web build pulls the public OLMDBManager export from a server endpoint;
//! the desktop build has no server, so this module downloads and extracts the
//! same export bundle directly into writable app-data directories:
//!
//!   <app_data>/data/**     ← modular competition/team/player/staff JSON
//!   <app_data>/public/**   ← player-photos / teams-icons / staff-photos / ...
//!
//! The competition loaders (see `commands::competitions`) prefer `<app_data>/data`
//! over the bundled read-only `data/`, and the `olm-asset://` protocol
//! (see `lib.rs`) serves imported photos with a fallback to bundled assets.

use std::io::Read;
use std::path::{Component, Path, PathBuf};

use log::info;
use serde_json::Value;
use tauri::Manager as TauriManager;

/// Default public OLMDBManager export endpoint. Overridable at runtime via the
/// `OLM_IMPORT_SOURCE` env var.
const DEFAULT_IMPORT_SOURCE: &str = "https://olmdatabase.nicorueda.dev/api/olm/export";

const PUBLIC_PHOTO_DIRS: [&str; 4] = [
    "player-photos",
    "teams-icons",
    "competitions-icons",
    "staff-photos",
];

#[derive(Debug, Default, serde::Serialize)]
pub struct ImportSummary {
    pub data_files: usize,
    pub photo_files: usize,
    pub player_count: usize,
    pub team_count: usize,
    pub staff_count: usize,
    pub skipped: usize,
}

#[derive(Debug, Default, serde::Serialize)]
pub struct CatalogResponse {
    pub summary: ImportSummary,
    pub players: Vec<CatalogPlayer>,
    pub teams: Vec<CatalogTeam>,
    pub staff: Vec<CatalogStaff>,
}

#[derive(Debug, serde::Serialize)]
pub struct CatalogPlayer {
    pub id: String,
    pub name: String,
    pub full_name: String,
    pub team_id: Option<String>,
    pub nationality: Option<String>,
    pub role: Option<String>,
    pub image_url: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct CatalogTeam {
    pub id: String,
    pub name: String,
    pub short_name: Option<String>,
    pub country: Option<String>,
    pub competition_id: Option<String>,
    pub logo_url: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct CatalogStaff {
    pub id: String,
    pub name: String,
    pub role: Option<String>,
    pub team_id: Option<String>,
    pub nationality: Option<String>,
    pub image_url: Option<String>,
}

// ---------------------------------------------------------------------------
// Writable destination directories (shared with competitions + asset protocol)
// ---------------------------------------------------------------------------

/// Writable `data/` directory the import extracts into and the loaders prefer.
pub fn writable_data_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app_handle)?.join("data"))
}

/// Writable `public/` directory imported photos are extracted into.
pub fn writable_public_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app_handle)?.join("public"))
}

fn app_data_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("resolve app data dir: {e}"))
}

/// Resolve a `/public`-namespaced asset (e.g. `player-photos/x.webp`) for the
/// `olm-asset://` protocol: imported file first, bundled frontend asset second.
/// Returns the bytes and a best-effort MIME type.
pub fn resolve_public_asset(
    app_handle: &tauri::AppHandle,
    rel: &str,
) -> Option<(Vec<u8>, String)> {
    let safe = safe_relative(rel)?;

    // 1. Imported photo in the writable app-data dir (the whole point).
    if let Ok(public_dir) = writable_public_dir(app_handle) {
        if let Ok(bytes) = std::fs::read(public_dir.join(&safe)) {
            return Some((bytes, mime_for(&safe)));
        }
    }

    // 2. Bundled frontend asset embedded in the production build (Vite copies
    //    `public/` to the dist root). Try both key spellings to be safe.
    let key = safe.to_string_lossy().replace('\\', "/");
    let resolver = app_handle.asset_resolver();
    if let Some(asset) = resolver
        .get(format!("/{key}"))
        .or_else(|| resolver.get(key.clone()))
    {
        let mime = if asset.mime_type.is_empty() {
            mime_for(&safe)
        } else {
            asset.mime_type
        };
        return Some((asset.bytes, mime));
    }

    // 3. Dev mode: assets aren't embedded (served by Vite), so read the
    //    frontend `public/` dir from disk. cwd is `src-tauri/` under `tauri dev`.
    if let Ok(cwd) = std::env::current_dir() {
        for candidate in [
            cwd.join("..").join("public").join(&safe),
            cwd.join("public").join(&safe),
        ] {
            if let Ok(bytes) = std::fs::read(&candidate) {
                return Some((bytes, mime_for(&safe)));
            }
        }
    }

    None
}

fn mime_for(path: &Path) -> String {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match ext.as_str() {
        "webp" => "image/webp",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "avif" => "image/avif",
        _ => "application/octet-stream",
    }
    .to_string()
}

fn import_source() -> String {
    std::env::var("OLM_IMPORT_SOURCE")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_IMPORT_SOURCE.to_string())
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Download the configured public OLMDBManager export and extract it into the
/// writable data/public directories.
#[tauri::command]
pub async fn auto_import_database(app_handle: tauri::AppHandle) -> Result<ImportSummary, String> {
    let source = import_source();
    info!("[cmd] auto_import_database: source={source}");
    let bytes = download_export(&source).await?;
    let data_dir = writable_data_dir(&app_handle)?;
    let public_dir = writable_public_dir(&app_handle)?;
    let summary =
        tauri::async_runtime::spawn_blocking(move || import_zip(&bytes, &data_dir, &public_dir))
            .await
            .map_err(|e| format!("import task panicked: {e}"))??;
    info!(
        "[cmd] auto_import_database: {} data files, {} photos, {} players, {} teams, {} staff, {} skipped",
        summary.data_files,
        summary.photo_files,
        summary.player_count,
        summary.team_count,
        summary.staff_count,
        summary.skipped
    );
    Ok(summary)
}

/// Import a local OLMDBManager export `.zip` from disk (manual fallback).
#[tauri::command]
pub async fn import_export_zip(
    app_handle: tauri::AppHandle,
    path: String,
) -> Result<ImportSummary, String> {
    info!("[cmd] import_export_zip: path={path}");
    let data_dir = writable_data_dir(&app_handle)?;
    let public_dir = writable_public_dir(&app_handle)?;
    tauri::async_runtime::spawn_blocking(move || {
        let bytes = std::fs::read(&path).map_err(|e| format!("read {path}: {e}"))?;
        import_zip(&bytes, &data_dir, &public_dir)
    })
    .await
    .map_err(|e| format!("import task panicked: {e}"))?
}

/// Counts of the currently imported catalog (or zeros if nothing imported yet).
#[tauri::command]
pub fn get_catalog_summary(app_handle: tauri::AppHandle) -> Result<ImportSummary, String> {
    let data_dir = writable_data_dir(&app_handle)?;
    Ok(catalog_summary(&data_dir))
}

/// Full imported catalog (players/teams/staff) for the Settings browser.
#[tauri::command]
pub fn get_catalog(app_handle: tauri::AppHandle) -> Result<CatalogResponse, String> {
    let data_dir = writable_data_dir(&app_handle)?;
    Ok(current_catalog(&data_dir))
}

// ---------------------------------------------------------------------------
// Download + extraction
// ---------------------------------------------------------------------------

async fn download_export(url: &str) -> Result<Vec<u8>, String> {
    let response = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .map_err(|e| format!("download {url}: {e}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("download {url}: HTTP {status}"));
    }
    response
        .bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| format!("read response {url}: {e}"))
}

/// Extract the export zip into the data/public dirs. Returns a summary.
fn import_zip(bytes: &[u8], data_dir: &Path, public_dir: &Path) -> Result<ImportSummary, String> {
    let reader = std::io::Cursor::new(bytes);
    let mut zip = zip::ZipArchive::new(reader).map_err(|e| format!("open zip: {e}"))?;

    let mut summary = ImportSummary::default();

    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| format!("zip entry {i}: {e}"))?;
        if entry.is_dir() {
            continue;
        }
        let name = entry.name().to_string();
        let Some(dest) = destination_for(&name, data_dir, public_dir) else {
            summary.skipped += 1;
            continue;
        };

        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("mkdir {parent:?}: {e}"))?;
        }
        let mut buf = Vec::new();
        entry
            .read_to_end(&mut buf)
            .map_err(|e| format!("read {name}: {e}"))?;
        std::fs::write(&dest, &buf).map_err(|e| format!("write {dest:?}: {e}"))?;

        if name.starts_with("data/") {
            summary.data_files += 1;
            add_entity_counts(&mut summary, &name, &buf);
        } else {
            summary.photo_files += 1;
        }
    }

    Ok(summary)
}

/// Decide the on-disk destination for a zip entry, or None to skip it.
fn destination_for(name: &str, data_dir: &Path, public_dir: &Path) -> Option<PathBuf> {
    let rel = safe_relative(name)?;
    let mut comps = rel.components();
    let first = comps.next()?.as_os_str().to_str()?;

    match first {
        "data" => {
            let rest: PathBuf = comps.collect();
            if rest.as_os_str().is_empty() {
                None
            } else {
                Some(data_dir.join(rest))
            }
        }
        "public" => {
            let sub = comps.next()?.as_os_str().to_str()?;
            if !PUBLIC_PHOTO_DIRS.contains(&sub) {
                return None;
            }
            let rest: PathBuf = comps.collect();
            if rest.as_os_str().is_empty() {
                None
            } else {
                Some(public_dir.join(sub).join(rest))
            }
        }
        _ => None,
    }
}

/// Reject path traversal: only allow normal, in-tree relative components.
fn safe_relative(path: &str) -> Option<PathBuf> {
    let p = Path::new(path);
    let mut out = PathBuf::new();
    for comp in p.components() {
        match comp {
            Component::Normal(c) => out.push(c),
            Component::CurDir => {}
            _ => return None,
        }
    }
    if out.as_os_str().is_empty() {
        None
    } else {
        Some(out)
    }
}

// ---------------------------------------------------------------------------
// Entity counting + catalog reading
// ---------------------------------------------------------------------------

fn rel_category(rel_name: &str) -> Option<&'static str> {
    let lower = rel_name.to_ascii_lowercase();
    if !lower.starts_with("data/") || lower.starts_with("data/draft/") {
        return None;
    }
    if lower.contains("/players/") || lower.ends_with("_players.json") {
        Some("players")
    } else if lower.contains("/teams/") || lower.ends_with("_teams.json") {
        Some("teams")
    } else if lower.contains("/staffs/")
        || lower.contains("/staff/")
        || lower.ends_with("_staffs.json")
        || lower.ends_with("_staff.json")
    {
        Some("staff")
    } else {
        None
    }
}

fn add_entity_counts(summary: &mut ImportSummary, rel_name: &str, bytes: &[u8]) {
    let Some(category) = rel_category(rel_name) else {
        return;
    };
    let Ok(value) = serde_json::from_slice::<Value>(bytes) else {
        return;
    };
    let count = match category {
        "players" => entity_array_len(&value, &["players"]),
        "teams" => entity_array_len(&value, &["teams"]),
        "staff" => entity_array_len(&value, &["staff", "staffs"]),
        _ => 0,
    };
    match category {
        "players" => summary.player_count += count,
        "teams" => summary.team_count += count,
        "staff" => summary.staff_count += count,
        _ => {}
    }
}

fn entity_array_len(value: &Value, keys: &[&str]) -> usize {
    if let Some(items) = value.as_array() {
        return items.len();
    }
    keys.iter()
        .find_map(|key| value.get(*key)?.as_array().map(Vec::len))
        .unwrap_or(0)
}

fn entity_items<'a>(value: &'a Value, keys: &[&str]) -> Vec<&'a Value> {
    if let Some(items) = value.as_array() {
        return items.iter().collect();
    }
    keys.iter()
        .find_map(|key| value.get(*key)?.as_array())
        .map(|items| items.iter().collect())
        .unwrap_or_default()
}

fn json_string(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        value
            .get(*key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|text| !text.is_empty())
            .map(ToOwned::to_owned)
    })
}

fn catalog_summary(data_dir: &Path) -> ImportSummary {
    let mut summary = ImportSummary::default();
    let mut files = Vec::new();
    if walk_files(data_dir, &mut files).is_err() {
        return summary;
    }
    for file in files {
        let Ok(rel) = file.strip_prefix(data_dir) else {
            continue;
        };
        let rel_name = format!("data/{}", rel.to_string_lossy().replace('\\', "/"));
        if rel_category(&rel_name).is_none() {
            continue;
        }
        if let Ok(bytes) = std::fs::read(&file) {
            summary.data_files += 1;
            add_entity_counts(&mut summary, &rel_name, &bytes);
        }
    }
    summary
}

fn current_catalog(data_dir: &Path) -> CatalogResponse {
    let mut catalog = CatalogResponse::default();
    let mut files = Vec::new();
    if walk_files(data_dir, &mut files).is_err() {
        return catalog;
    }

    for file in files {
        let Ok(rel) = file.strip_prefix(data_dir) else {
            continue;
        };
        let rel_name = format!("data/{}", rel.to_string_lossy().replace('\\', "/"));
        let Some(category) = rel_category(&rel_name) else {
            continue;
        };
        let Ok(bytes) = std::fs::read(&file) else {
            continue;
        };
        add_entity_counts(&mut catalog.summary, &rel_name, &bytes);
        catalog.summary.data_files += 1;
        let Ok(value) = serde_json::from_slice::<Value>(&bytes) else {
            continue;
        };

        match category {
            "players" => {
                for item in entity_items(&value, &["players"]) {
                    let Some(id) = json_string(item, &["id"]) else {
                        continue;
                    };
                    let full_name =
                        json_string(item, &["full_name", "name"]).unwrap_or_else(|| id.clone());
                    let name = json_string(item, &["match_name", "nickname", "full_name", "name"])
                        .unwrap_or_else(|| full_name.clone());
                    catalog.players.push(CatalogPlayer {
                        id,
                        name,
                        full_name,
                        team_id: json_string(item, &["team_id"]),
                        nationality: json_string(item, &["nationality", "country"]),
                        role: json_string(item, &["role", "position", "lol_role"]),
                        image_url: json_string(item, &["profile_image_url", "image_url"]),
                    });
                }
            }
            "teams" => {
                for item in entity_items(&value, &["teams"]) {
                    let Some(id) = json_string(item, &["id"]) else {
                        continue;
                    };
                    catalog.teams.push(CatalogTeam {
                        name: json_string(item, &["name"]).unwrap_or_else(|| id.clone()),
                        short_name: json_string(item, &["short_name", "abbreviation"]),
                        country: json_string(item, &["country", "region"]),
                        competition_id: json_string(item, &["competition_id"]),
                        logo_url: json_string(item, &["logo_url"]),
                        id,
                    });
                }
            }
            "staff" => {
                for item in entity_items(&value, &["staff", "staffs"]) {
                    let Some(id) = json_string(item, &["id"]) else {
                        continue;
                    };
                    let first = json_string(item, &["first_name"]).unwrap_or_default();
                    let last = json_string(item, &["last_name"]).unwrap_or_default();
                    let full_name = format!("{first} {last}").trim().to_string();
                    let name = if full_name.is_empty() {
                        json_string(item, &["nickname", "name"]).unwrap_or_else(|| id.clone())
                    } else {
                        full_name
                    };
                    catalog.staff.push(CatalogStaff {
                        id,
                        name,
                        role: json_string(item, &["role"]),
                        team_id: json_string(item, &["team_id"]),
                        nationality: json_string(item, &["nationality", "country"]),
                        image_url: json_string(item, &["profile_image_url", "image_url"]),
                    });
                }
            }
            _ => {}
        }
    }

    catalog.players.sort_by(|a, b| a.name.cmp(&b.name));
    catalog.teams.sort_by(|a, b| a.name.cmp(&b.name));
    catalog.staff.sort_by(|a, b| a.name.cmp(&b.name));
    catalog
}

fn walk_files(root: &Path, out: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in std::fs::read_dir(root).map_err(|e| format!("read_dir {root:?}: {e}"))? {
        let entry = entry.map_err(|e| format!("read_dir entry {root:?}: {e}"))?;
        let path = entry.path();
        if path.is_dir() {
            walk_files(&path, out)?;
        } else if path.is_file() {
            out.push(path);
        }
    }
    Ok(())
}
