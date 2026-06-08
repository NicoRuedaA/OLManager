use log::debug;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// A single entry in the save index, representing one save session.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveEntry {
    pub id: String,
    pub name: String,
    pub manager_name: String,
    pub created_at: String,
    pub last_played_at: String,
}

impl SaveEntry {
    /// The on-disk filename for this save.
    pub fn filename(&self) -> String {
        format!("{}.olsave", self.id)
    }
}

/// The save index file that tracks all save sessions.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveIndex {
    pub version: u32,
    pub saves: Vec<SaveEntry>,
}

impl SaveIndex {
    /// Create a new empty save index.
    pub fn new() -> Self {
        Self {
            version: 1,
            saves: Vec::new(),
        }
    }

    /// Add a save entry to the index.
    pub fn add(&mut self, entry: SaveEntry) {
        self.saves.push(entry);
    }

    /// Update an existing entry by id. Returns false if not found.
    pub fn update(&mut self, entry: &SaveEntry) -> bool {
        if let Some(existing) = self.saves.iter_mut().find(|e| e.id == entry.id) {
            existing.name = entry.name.clone();
            existing.manager_name = entry.manager_name.clone();
            existing.last_played_at = entry.last_played_at.clone();
            true
        } else {
            false
        }
    }

    /// Remove a save entry by id. Returns true if removed.
    pub fn remove(&mut self, id: &str) -> bool {
        let before = self.saves.len();
        self.saves.retain(|e| e.id != id);
        self.saves.len() < before
    }

    /// Find a save entry by id.
    pub fn find(&self, id: &str) -> Option<&SaveEntry> {
        self.saves.iter().find(|e| e.id == id)
    }
}

impl Default for SaveIndex {
    fn default() -> Self {
        Self::new()
    }
}

/// Load save index from a JSON file. Returns None if the file doesn't exist.
pub fn load_index(index_path: &Path) -> Result<Option<SaveIndex>, String> {
    if !index_path.exists() {
        debug!("[save_index] index file not found at {:?}", index_path);
        return Ok(None);
    }
    let data =
        fs::read_to_string(index_path).map_err(|e| format!("Failed to read save index: {}", e))?;
    let index: SaveIndex =
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse save index: {}", e))?;
    debug!("[save_index] loaded index with {} saves", index.saves.len());
    Ok(Some(index))
}

/// Write save index to a JSON file.
pub fn write_index(index_path: &Path, index: &SaveIndex) -> Result<(), String> {
    let data = serde_json::to_string_pretty(index)
        .map_err(|e| format!("Failed to serialize save index: {}", e))?;
    if let Some(parent) = index_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create index directory: {}", e))?;
    }
    fs::write(index_path, data).map_err(|e| format!("Failed to write save index: {}", e))?;
    debug!("[save_index] wrote index to {:?}", index_path);
    Ok(())
}

/// Load save index from a JSON file, returning an empty index if the file doesn't exist.
pub fn load_or_create_index(index_path: &Path) -> Result<SaveIndex, String> {
    if let Some(index) = load_index(index_path)? {
        Ok(index)
    } else {
        debug!("[save_index] index file missing, returning empty index");
        Ok(SaveIndex::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_save_index_new() {
        let index = SaveIndex::new();
        assert_eq!(index.version, 1);
        assert!(index.saves.is_empty());
    }

    #[test]
    fn test_save_index_add_and_find() {
        let mut index = SaveIndex::new();
        let entry = SaveEntry {
            id: "save-001".to_string(),
            name: "Test Career".to_string(),
            manager_name: "John Smith".to_string(),
            created_at: "2026-01-01".to_string(),
            last_played_at: "2026-01-02".to_string(),
        };
        index.add(entry);

        assert_eq!(index.saves.len(), 1);
        let found = index.find("save-001").unwrap();
        assert_eq!(found.name, "Test Career");
    }

    #[test]
    fn test_save_index_update() {
        let mut index = SaveIndex::new();
        index.add(SaveEntry {
            id: "save-001".to_string(),
            name: "Old Name".to_string(),
            manager_name: "John".to_string(),
            created_at: "2026-01-01".to_string(),
            last_played_at: "2026-01-01".to_string(),
        });

        let updated = index.update(&SaveEntry {
            id: "save-001".to_string(),
            name: "New Name".to_string(),
            manager_name: "John".to_string(),
            created_at: "2026-01-01".to_string(),
            last_played_at: "2026-01-05".to_string(),
        });

        assert!(updated);
        assert_eq!(index.find("save-001").unwrap().name, "New Name");
    }

    #[test]
    fn test_save_index_update_not_found() {
        let mut index = SaveIndex::new();
        let result = index.update(&SaveEntry {
            id: "nonexistent".to_string(),
            name: "x".to_string(),
            manager_name: "x".to_string(),
            created_at: "x".to_string(),
            last_played_at: "x".to_string(),
        });
        assert!(!result);
    }

    #[test]
    fn test_save_index_remove() {
        let mut index = SaveIndex::new();
        index.add(SaveEntry {
            id: "save-001".to_string(),
            name: "Career".to_string(),
            manager_name: "John".to_string(),
            created_at: "2026-01-01".to_string(),
            last_played_at: "2026-01-01".to_string(),
        });
        assert!(index.remove("save-001"));
        assert!(index.saves.is_empty());
        assert!(!index.remove("save-001")); // already removed
    }

    #[test]
    fn test_save_index_serialization_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let index_path = dir.path().join("save_index.json");

        let mut index = SaveIndex::new();
        index.add(SaveEntry {
            id: "save-001".to_string(),
            name: "Career".to_string(),
            manager_name: "John".to_string(),
            created_at: "2026-01-01".to_string(),
            last_played_at: "2026-01-02".to_string(),
        });

        write_index(&index_path, &index).unwrap();
        let loaded = load_index(&index_path).unwrap().unwrap();

        assert_eq!(loaded.version, 1);
        assert_eq!(loaded.saves.len(), 1);
        assert_eq!(loaded.saves[0].id, "save-001");
    }

    #[test]
    fn test_load_index_missing_file() {
        let dir = tempfile::tempdir().unwrap();
        let index_path = dir.path().join("nonexistent.json");
        let result = load_index(&index_path).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_load_or_create_uses_existing() {
        let dir = tempfile::tempdir().unwrap();
        let index_path = dir.path().join("save_index.json");

        let mut index = SaveIndex::new();
        index.add(SaveEntry {
            id: "existing".to_string(),
            name: "Existing".to_string(),
            manager_name: "John".to_string(),
            created_at: "2026-01-01".to_string(),
            last_played_at: "2026-01-01".to_string(),
        });
        write_index(&index_path, &index).unwrap();

        let loaded = load_or_create_index(&index_path).unwrap();
        assert_eq!(loaded.saves.len(), 1);
        assert_eq!(loaded.saves[0].id, "existing");
    }

    #[test]
    fn test_load_or_create_returns_empty_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        let index_path = dir.path().join("nonexistent.json");

        let loaded = load_or_create_index(&index_path).unwrap();
        assert!(loaded.saves.is_empty());
    }
}
