//! Import an OLMDBManager export bundle (.zip) into the server's data dir and
//! the frontend's public asset dirs.
//!
//! The export zip has this top-level shape:
//!   data/competitions/**, data/teams/**, data/players/**, data/staffs/**, ...
//!   public/player-photos/**, public/teams-icons/**, public/staff-photos/**
//!   _meta.json
//!
//! `data/**` is written under OLM_DATA_DIR; the `public/<dir>/**` photo folders
//! are written under OLM_PUBLIC_DIR. Everything else in the zip is ignored.
//!
//! This replaces global game content, so it's gated behind auth AND the
//! OLM_ALLOW_IMPORT=1 env flag (off by default).

use std::io::Read;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Default, serde::Serialize)]
pub struct ImportSummary {
    pub data_files: usize,
    pub photo_files: usize,
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
    if std::env::var("OLM_ALLOW_IMPORT").map(|v| v == "1" || v == "true").unwrap_or(false) == false {
        return Err("import disabled — set OLM_ALLOW_IMPORT=1 to enable".into());
    }

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

        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("mkdir {parent:?}: {e}"))?;
        }
        let mut buf = Vec::with_capacity(entry.size() as usize);
        entry
            .read_to_end(&mut buf)
            .map_err(|e| format!("read {name}: {e}"))?;
        std::fs::write(&dest, &buf).map_err(|e| format!("write {dest:?}: {e}"))?;

        if name.starts_with("data/") {
            summary.data_files += 1;
        } else {
            summary.photo_files += 1;
        }
    }

    Ok(summary)
}
