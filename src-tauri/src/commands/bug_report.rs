use log::info;
use std::io::{Read, Write};
use std::path::PathBuf;
use tauri::Manager as TauriManager;
use zip::write::FileOptions;
use zip::ZipWriter;

/// Export a bug report ZIP to the user's Desktop.
///
/// # Arguments
/// * `context_json` — JSON string with user description + game context
/// * `save_json` — JSON string with the full serialized save/game state
///
/// Returns the path to the created .zip file, or an error string.
#[tauri::command]
pub fn export_bug_report(
    app_handle: tauri::AppHandle,
    context_json: String,
    save_json: String,
) -> Result<String, String> {
    info!("[cmd] export_bug_report");
    let desktop = dirs::desktop_dir().ok_or("Could not find Desktop directory")?;
    let timestamp = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S");
    let filename = format!("bugreport-{}.zip", timestamp);
    let zip_path: PathBuf = desktop.join(&filename);
    info!("[cmd] export_bug_report: creating {}", zip_path.display());

    // Try to also include Tauri log files (last 50KB of last 3 logs)
    let logs_dir = app_handle
        .path()
        .app_data_dir()
        .map(|p| p.join("logs"));
    let log_contents = match &logs_dir {
        Ok(dir) if dir.exists() => {
            let mut combined = String::new();
            if let Ok(entries) = std::fs::read_dir(dir) {
                let mut log_files: Vec<_> = entries
                    .filter_map(|e| e.ok())
                    .filter(|e| e.path().extension().map(|ext| ext == "log").unwrap_or(false))
                    .collect();
                log_files.sort_by_key(|e| e.path());
                for entry in log_files.iter().rev().take(3) {
                    if let Ok(mut f) = std::fs::File::open(entry.path()) {
                        let mut content = String::new();
                        if f.read_to_string(&mut content).is_ok() {
                            let log_name = entry.file_name().to_string_lossy().to_string();
                            combined.push_str(&format!("\n\n===== {} =====\n", log_name));
                            let len = content.len();
                            let start = if len > 50_000 { len - 50_000 } else { 0 };
                            combined.push_str(&content[start..]);
                        }
                    }
                }
            }
            combined
        }
        _ => String::new(),
    };

    let file = std::fs::File::create(&zip_path).map_err(|e| format!("Failed to create zip: {}", e))?;
    let mut zip = ZipWriter::new(file);

    let options = FileOptions::<()>::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);

    // context.json
    zip.start_file("context.json", options)
        .map_err(|e| format!("Failed to write context.json: {}", e))?;
    zip.write_all(context_json.as_bytes())
        .map_err(|e| format!("Failed to write context data: {}", e))?;

    // save.json
    zip.start_file("save.json", options)
        .map_err(|e| format!("Failed to write save.json: {}", e))?;
    zip.write_all(save_json.as_bytes())
        .map_err(|e| format!("Failed to write save data: {}", e))?;

    // logs.txt (if available)
    if !log_contents.is_empty() {
        zip.start_file("logs.txt", options)
            .map_err(|e| format!("Failed to write logs.txt: {}", e))?;
        zip.write_all(log_contents.as_bytes())
            .map_err(|e| format!("Failed to write logs: {}", e))?;
    }

    zip.finish().map_err(|e| format!("Failed to finalize zip: {}", e))?;

    info!("[cmd] export_bug_report: done at {}", zip_path.display());

    Ok(zip_path.to_string_lossy().to_string())
}
