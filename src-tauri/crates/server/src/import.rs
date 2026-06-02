//! Import an OLMDBManager export bundle (.zip) into the server's data dir and
//! the frontend's public asset dirs.
//!
//! The export zip has this top-level shape:
//!   data/competitions/**, data/teams/**, data/players/**, data/staffs/**, ...
//!   public/player-photos/**, public/teams-icons/**, public/staff-photos/**
//!   _meta.json
//!
//! `data/**` is written under OLM_DATA_DIR; the `public/<dir>/**` photo folders
//! are written under OLM_PUBLIC_DIR. Everything else in the zip/folder is ignored.
//!
//! This replaces global game content, so manual uploads are gated behind
//! OLM_ALLOW_IMPORT=1 (off by default). Startup sync is separately gated behind
//! OLM_AUTO_IMPORT=1.

use std::io::Read;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Default, serde::Serialize)]
pub struct ImportSummary {
    pub data_files: usize,
    pub photo_files: usize,
    pub player_count: usize,
    pub team_count: usize,
    pub staff_count: usize,
    pub skipped: usize,
}

const PUBLIC_PHOTO_DIRS: [&str; 4] = [
    "player-photos",
    "teams-icons",
    "competitions-icons",
    "staff-photos",
];

fn data_dir() -> PathBuf {
    std::env::var("OLM_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("data"))
}

fn public_dir() -> PathBuf {
    std::env::var("OLM_PUBLIC_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("public"))
}

fn env_truthy(name: &str) -> bool {
    std::env::var(name)
        .map(|v| matches!(v.as_str(), "1" | "true" | "TRUE" | "yes" | "YES"))
        .unwrap_or(false)
}

fn count_entities(rel_name: &str, bytes: &[u8]) -> (usize, usize, usize) {
    let lower = rel_name.to_ascii_lowercase();
    if !lower.starts_with("data/") || lower.starts_with("data/draft/") {
        return (0, 0, 0);
    }

    let category = if lower.contains("/players/") || lower.ends_with("_players.json") {
        "players"
    } else if lower.contains("/teams/") || lower.ends_with("_teams.json") {
        "teams"
    } else if lower.contains("/staffs/") || lower.contains("/staff/")
        || lower.ends_with("_staffs.json")
        || lower.ends_with("_staff.json")
    {
        "staff"
    } else {
        return (0, 0, 0);
    };

    let Ok(value) = serde_json::from_slice::<serde_json::Value>(bytes) else {
        return (0, 0, 0);
    };

    let count = match category {
        "players" => entity_array_len(&value, &["players"]),
        "teams" => entity_array_len(&value, &["teams"]),
        "staff" => entity_array_len(&value, &["staff", "staffs"]),
        _ => 0,
    };

    match category {
        "players" => (count, 0, 0),
        "teams" => (0, count, 0),
        "staff" => (0, 0, count),
        _ => (0, 0, 0),
    }
}

fn entity_array_len(value: &serde_json::Value, keys: &[&str]) -> usize {
    if let Some(items) = value.as_array() {
        return items.len();
    }
    keys.iter()
        .find_map(|key| value.get(*key)?.as_array().map(Vec::len))
        .unwrap_or(0)
}

fn add_entity_counts(summary: &mut ImportSummary, rel_name: &str, bytes: &[u8]) {
    let (players, teams, staff) = count_entities(rel_name, bytes);
    summary.player_count += players;
    summary.team_count += teams;
    summary.staff_count += staff;
}

/// Reject path traversal: only allow normal, in-tree relative components.
fn safe_relative(path: &str) -> Option<PathBuf> {
    let p = Path::new(path);
    let mut out = PathBuf::new();
    for comp in p.components() {
        match comp {
            Component::Normal(c) => out.push(c),
            Component::CurDir => {}
            // Anything else (ParentDir, RootDir, Prefix) is unsafe.
            _ => return None,
        }
    }
    if out.as_os_str().is_empty() {
        None
    } else {
        Some(out)
    }
}

/// Decide the on-disk destination for a zip entry, or None to skip it.
fn destination_for(name: &str) -> Option<PathBuf> {
    let rel = safe_relative(name)?;
    let mut comps = rel.components();
    let first = comps.next()?.as_os_str().to_str()?;

    match first {
        "data" => {
            // data/<...> → OLM_DATA_DIR/<...>
            let rest: PathBuf = comps.collect();
            if rest.as_os_str().is_empty() {
                None
            } else {
                Some(data_dir().join(rest))
            }
        }
        "public" => {
            // public/<photoDir>/<...> → OLM_PUBLIC_DIR/<photoDir>/<...>
            let sub = comps.next()?.as_os_str().to_str()?;
            if !PUBLIC_PHOTO_DIRS.contains(&sub) {
                return None;
            }
            let rest: PathBuf = comps.collect();
            if rest.as_os_str().is_empty() {
                None
            } else {
                Some(public_dir().join(sub).join(rest))
            }
        }
        _ => None,
    }
}

/// Extract the zip bytes into the data/public dirs. Returns a summary.
pub fn import_zip(bytes: &[u8]) -> Result<ImportSummary, String> {
    if !env_truthy("OLM_ALLOW_IMPORT") {
        return Err("import disabled — set OLM_ALLOW_IMPORT=1 to enable".into());
    }

    import_zip_unchecked(bytes)
}

fn import_zip_unchecked(bytes: &[u8]) -> Result<ImportSummary, String> {
    let reader = std::io::Cursor::new(bytes);
    let mut zip = zip::ZipArchive::new(reader).map_err(|e| format!("open zip: {e}"))?;

    let mut summary = ImportSummary::default();

    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| format!("zip entry {i}: {e}"))?;
        if entry.is_dir() {
            continue;
        }
        let name = entry.name().to_string();
        let Some(dest) = destination_for(&name) else {
            summary.skipped += 1;
            continue;
        };

        write_imported_file(&dest, |buf| {
            entry
                .read_to_end(buf)
                .map_err(|e| format!("read {name}: {e}"))?;
            Ok(())
        })?;

        if name.starts_with("data/") {
            summary.data_files += 1;
            if let Ok(bytes) = std::fs::read(&dest) {
                add_entity_counts(&mut summary, &name, &bytes);
            }
        } else {
            summary.photo_files += 1;
        }
    }

    Ok(summary)
}

fn write_imported_file<F>(dest: &Path, read: F) -> Result<(), String>
where
    F: FnOnce(&mut Vec<u8>) -> Result<(), String>,
{
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("mkdir {parent:?}: {e}"))?;
    }
    let mut buf = Vec::new();
    read(&mut buf)?;
    std::fs::write(dest, &buf).map_err(|e| format!("write {dest:?}: {e}"))?;
    Ok(())
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

fn import_tree(source_root: &Path, synthetic_prefix: &str) -> Result<ImportSummary, String> {
    let mut files = Vec::new();
    walk_files(source_root, &mut files)?;

    let mut summary = ImportSummary::default();
    for file in files {
        let rel = file
            .strip_prefix(source_root)
            .map_err(|e| format!("strip_prefix {file:?}: {e}"))?;
        let rel_name = format!("{}/{}", synthetic_prefix, rel.to_string_lossy().replace('\\', "/"));
        let Some(dest) = destination_for(&rel_name) else {
            summary.skipped += 1;
            continue;
        };

        write_imported_file(&dest, |buf| {
            let mut src = std::fs::File::open(&file).map_err(|e| format!("open {file:?}: {e}"))?;
            src.read_to_end(buf)
                .map_err(|e| format!("read {file:?}: {e}"))?;
            Ok(())
        })?;

        if rel_name.starts_with("data/") {
            summary.data_files += 1;
            if let Ok(bytes) = std::fs::read(&dest) {
                add_entity_counts(&mut summary, &rel_name, &bytes);
            }
        } else {
            summary.photo_files += 1;
        }
    }

    Ok(summary)
}

fn merge_summary(into: &mut ImportSummary, next: ImportSummary) {
    into.data_files += next.data_files;
    into.photo_files += next.photo_files;
    into.player_count += next.player_count;
    into.team_count += next.team_count;
    into.staff_count += next.staff_count;
    into.skipped += next.skipped;
}

/// Import a previously extracted OLMDBManager export directory.
///
/// Supported directory shapes:
/// - export root containing `data/` and optionally `public/`
/// - OLMDBManager project root containing `export_output/data/` and `public/`
///
/// Only known `data/**` and public asset folders are scanned, so pointing this
/// at the OLMDBManager repo root does not walk `node_modules`.
pub fn import_dir(root: &Path) -> Result<ImportSummary, String> {
    let mut summary = ImportSummary::default();
    let mut found = false;

    for data_root in [root.join("data"), root.join("export_output").join("data")] {
        if data_root.is_dir() {
            merge_summary(&mut summary, import_tree(&data_root, "data")?);
            found = true;
        }
    }

    for public_root in [root.join("public"), root.join("export_output").join("public")] {
        if public_root.is_dir() {
            merge_summary(&mut summary, import_tree(&public_root, "public")?);
            found = true;
        }
    }

    if !found {
        return Err(format!(
            "no data/public export folders found under {:?}",
            root
        ));
    }

    Ok(summary)
}

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

/// Import from OLM_IMPORT_SOURCE. Supported sources:
/// - directory containing `data/` and optionally `public/`
/// - `.zip` file
/// - public `http(s)://...` zip URL
pub async fn import_source(source: &str) -> Result<ImportSummary, String> {
    if !env_truthy("OLM_AUTO_IMPORT") {
        return Err("auto import disabled — set OLM_AUTO_IMPORT=1 to enable".into());
    }

    import_source_unchecked(source).await
}

async fn import_source_unchecked(source: &str) -> Result<ImportSummary, String> {
    if source.starts_with("http://") || source.starts_with("https://") {
        let bytes = download_export(source).await?;
        return import_zip_unchecked(&bytes);
    }

    let path = PathBuf::from(source);
    if path.is_dir() {
        return import_dir(&path);
    }
    if path.is_file() {
        let bytes = std::fs::read(&path).map_err(|e| format!("read {path:?}: {e}"))?;
        return import_zip_unchecked(&bytes);
    }

    Err(format!("import source not found: {source}"))
}

pub async fn import_configured_source() -> Result<ImportSummary, String> {
    let source = std::env::var("OLM_IMPORT_SOURCE")
        .map_err(|_| "OLM_IMPORT_SOURCE is not configured".to_string())?;
    if source.trim().is_empty() {
        return Err("OLM_IMPORT_SOURCE is empty".into());
    }
    import_source_unchecked(&source).await
}

pub fn current_catalog_summary() -> ImportSummary {
    let base = data_dir();
    let mut files = Vec::new();
    if walk_files(&base, &mut files).is_err() {
        return ImportSummary::default();
    }

    let mut summary = ImportSummary::default();
    for file in files {
        let Ok(rel) = file.strip_prefix(&base) else {
            continue;
        };
        let rel_name = format!("data/{}", rel.to_string_lossy().replace('\\', "/"));
        if let Ok(bytes) = std::fs::read(&file) {
            add_entity_counts(&mut summary, &rel_name, &bytes);
        }
    }
    summary
}

/// Run startup import if configured. Missing OLM_IMPORT_SOURCE is a no-op.
pub async fn run_startup_import() {
    if !env_truthy("OLM_AUTO_IMPORT") {
        tracing::debug!("startup data import skipped: OLM_AUTO_IMPORT disabled");
        return;
    }

    let Ok(source) = std::env::var("OLM_IMPORT_SOURCE") else {
        tracing::debug!("startup data import skipped: OLM_IMPORT_SOURCE not set");
        return;
    };
    if source.trim().is_empty() {
        tracing::debug!("startup data import skipped: OLM_IMPORT_SOURCE empty");
        return;
    }

    match import_source(&source).await {
        Ok(summary) => tracing::info!(
            "startup data import completed from {}: {} data files, {} photos, {} players, {} teams, {} staff, {} skipped",
            source,
            summary.data_files,
            summary.photo_files,
            summary.player_count,
            summary.team_count,
            summary.staff_count,
            summary.skipped
        ),
        Err(e) => tracing::warn!("startup data import failed from {source}: {e}"),
    }
}
