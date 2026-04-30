//! Backup Save Manager for Online Multiplayer
//!
//! Handles backup saves for Client to recover if Host disconnects.
//! - Backup saves to: app_data_dir/saves/{id}_backup.db
//! - Auto-backup triggers every 5 minutes during active session
//! - Backup triggered on receiving full state sync from Host

#![allow(dead_code)]

use crate::SaveManagerState;
use db::game_persistence::{write_backup, read_backup, backup_exists, delete_backup, get_backup_path, BackupMetadata};
use ofm_core::game::{Game, MultiplayerMode};
use ofm_core::state::StateManager;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::State;
use tokio::sync::Mutex;

/// Auto-backup interval in seconds
pub const AUTO_BACKUP_INTERVAL_SECS: u64 = 300; // 5 minutes

/// Result structure for loading backup
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadBackupResult {
    pub success: bool,
    pub game_id: String,
    pub converted_to_offline: bool,
    pub message: String,
}

/// BackupSaveManager
/// 
/// Manages backup saves for Client in online multiplayer.
/// Tracks backup metadata and handles auto-backup timing.
pub struct BackupSaveManager {
    /// Last backup timestamp
    last_backup: Arc<Mutex<Option<u64>>>,
    /// Last sync checksum when backup was created
    last_backup_checksum: Arc<Mutex<Option<u64>>>,
    /// Whether auto-backup is enabled
    auto_backup_enabled: Arc<Mutex<bool>>,
    /// Backup save ID (corresponds to the main save)
    backup_save_id: Arc<Mutex<Option<String>>>,
}

impl BackupSaveManager {
    /// Create a new BackupSaveManager
    pub fn new() -> Self {
        Self {
            last_backup: Arc::new(Mutex::new(None)),
            last_backup_checksum: Arc::new(Mutex::new(None)),
            auto_backup_enabled: Arc::new(Mutex::new(false)),
            backup_save_id: Arc::new(Mutex::new(None)),
        }
    }

    /// Enable auto-backup and set the save ID
    pub async fn enable_auto_backup(&self, save_id: String) {
        let mut enabled = self.auto_backup_enabled.lock().await;
        *enabled = true;
        
        let mut backup_id = self.backup_save_id.lock().await;
        *backup_id = Some(save_id.clone());
        
        log::info!("Auto-backup enabled for save_id: {}", save_id);
    }

    /// Disable auto-backup
    pub async fn disable_auto_backup(&self) {
        let mut enabled = self.auto_backup_enabled.lock().await;
        *enabled = false;
        
        log::info!("Auto-backup disabled");
    }

    /// Check if auto-backup is enabled
    pub async fn is_auto_backup_enabled(&self) -> bool {
        *self.auto_backup_enabled.lock().await
    }

    /// Check if backup is due (more than 5 minutes since last backup)
    pub async fn is_backup_due(&self) -> bool {
        let last_backup = self.last_backup.lock().await;
        
        if let Some(last) = *last_backup {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            
            // Backup due if more than 5 minutes since last backup
            return (now - last) >= AUTO_BACKUP_INTERVAL_SECS;
        }
        
        // No backup ever - it's due
        true
    }

    /// Mark backup as completed
    pub async fn mark_backup_completed(&self, checksum: u64) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        let mut last_backup = self.last_backup.lock().await;
        *last_backup = Some(now);
        
        let mut last_checksum = self.last_backup_checksum.lock().await;
        *last_checksum = Some(checksum);
        
        log::debug!("Backup marked completed at {} with checksum {:016x}", now, checksum);
    }

    /// Get time since last backup
    pub async fn time_since_last_backup(&self) -> Option<Duration> {
        let last_backup = self.last_backup.lock().await;
        
        if let Some(last) = *last_backup {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            
            if now >= last {
                return Some(Duration::from_secs(now - last));
            }
        }
        
        None
    }

    /// Get last backup checksum
    pub async fn get_last_backup_checksum(&self) -> Option<u64> {
        *self.last_backup_checksum.lock().await
    }

    /// Get the backup save ID
    pub async fn get_backup_save_id(&self) -> Option<String> {
        self.backup_save_id.lock().await.clone()
    }

    /// Reset backup state (e.g., when disconnecting)
    pub async fn reset(&self) {
        let mut last_backup = self.last_backup.lock().await;
        *last_backup = None;
        
        let mut last_checksum = self.last_backup_checksum.lock().await;
        *last_checksum = None;
        
        let mut enabled = self.auto_backup_enabled.lock().await;
        *enabled = false;
        
        let mut backup_id = self.backup_save_id.lock().await;
        *backup_id = None;
        
        log::info!("BackupSaveManager reset");
    }
}

impl Default for BackupSaveManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Convert game to offline mode after Host disconnect
/// 
/// This removes player 2's manager and sets multiplayer_mode to offline,
/// allowing the Client to continue as a single-player game.
pub fn convert_to_offline_mode(game: &mut Game) {
    log::info!(
        "Converting game to offline mode: removing player 2 (was: {:?})",
        game.player2_manager.as_ref().map(|m| &m.id)
    );
    
    // Set multiplayer mode to offline
    game.multiplayer_mode = MultiplayerMode::Offline;
    
    // Remove player 2's manager
    game.player2_manager = None;
    
    // Clear multiplayer-specific fields
    game.player1_day_ready = false;
    game.player2_day_ready = false;
    
    // Clear room code
    game.room_code = None;
    
    // Reset current player to 1
    game.current_player = 1;
    
    log::info!("Game converted to offline mode successfully");
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Create a backup save (Client command)
/// 
/// Called when:
/// - Receiving full state sync from Host
/// - Before Host disconnects (graceful)
/// - Every 5 minutes during active session (auto-backup)
#[tauri::command]
pub async fn multiplayer_create_backup(
    state: State<'_, StateManager>,
    _save_manager: State<'_, SaveManagerState>,
) -> Result<(), String> {
    log::info!("Creating backup save");
    
    // Get the active game
    let game = {
        let game_guard = state
            .active_game
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        
        game_guard.as_ref().ok_or("No active game")?.clone()
    };
    
    // Verify we're in online multiplayer mode
    if game.multiplayer_mode != MultiplayerMode::Online {
        return Err("Backup only available in online multiplayer mode".to_string());
    }
    
    // Get save ID
    let save_id = state
        .get_save_id()
        .ok_or("No active save ID")?;
    
    // Get backup metadata - use manager IDs
    let host_player_id = game.manager.id.clone();
    let client_player_id = game.player2_manager.as_ref()
        .map(|m| m.id.clone())
        .unwrap_or_default();
    let checksum = 0u64; // Would come from state sync
    
    let metadata = BackupMetadata::new(
        save_id.clone(),
        host_player_id,
        client_player_id,
        checksum,
    );
    
    // Write backup to default location
    // Note: In production, this should come from app_data_dir
    let backup_path = PathBuf::from("saves").join(format!("{}_backup.db", save_id));
    write_backup(&backup_path, &game, &save_id, &metadata)?;
    
    log::info!("Backup created successfully at {:?}", backup_path);
    
    Ok(())
}

/// Load a backup save (Client command)
/// 
/// Called when Client detects Host disconnect and wants to recover.
#[tauri::command]
pub async fn multiplayer_load_backup(
    state: State<'_, StateManager>,
    save_manager: State<'_, SaveManagerState>,
) -> Result<LoadBackupResult, String> {
    log::info!("Loading backup save");
    
    // Get save ID
    let save_id = state
        .get_save_id()
        .ok_or("No active save ID")?;
    
    // Get saves directory
    let saves_dir = PathBuf::from("saves");
    
    // Check if backup exists
    let backup_path = get_backup_path(&saves_dir, &save_id);
    if !backup_exists(&backup_path) {
        return Ok(LoadBackupResult {
            success: false,
            game_id: save_id,
            converted_to_offline: false,
            message: "No backup found".to_string(),
        });
    }
    
    // Load backup
    let (mut game, metadata) = read_backup(&backup_path)
        .map_err(|e| format!("Failed to load backup: {}", e))?;
    
    // Convert to offline mode
    convert_to_offline_mode(&mut game);
    
    // Set the game in state
    state.set_game(game.clone());
    
    log::info!(
        "Backup loaded and converted to offline: game_id={}",
        metadata.game_id
    );
    
    Ok(LoadBackupResult {
        success: true,
        game_id: metadata.game_id,
        converted_to_offline: true,
        message: "Backup loaded successfully".to_string(),
    })
}

/// Check if a backup exists (Client command)
#[tauri::command]
pub async fn multiplayer_has_backup(
    state: State<'_, StateManager>,
) -> Result<bool, String> {
    // Get save ID
    let save_id = match state.get_save_id() {
        Some(id) => id,
        None => return Ok(false),
    };
    
    // Check backup exists at default location
    let backup_path = PathBuf::from("saves").join(format!("{}_backup.db", save_id));
    
    Ok(backup_exists(&backup_path))
}

/// Delete a backup save (Client command)
#[tauri::command]
pub async fn multiplayer_delete_backup(
    state: State<'_, StateManager>,
) -> Result<(), String> {
    // Get save ID
    let save_id = state
        .get_save_id()
        .ok_or("No active save ID")?;
    
    // Get saves directory
    let saves_dir = PathBuf::from("saves");
    
    // Delete backup
    let backup_path = get_backup_path(&saves_dir, &save_id);
    delete_backup(&backup_path)?;
    
    log::info!("Backup deleted for save_id: {}", save_id);
    
    Ok(())
}

/// Handle Host disconnect (internal function)
/// 
/// This is called when Client detects that Host has disconnected.
/// It creates a final backup and returns the game in offline mode.
pub async fn on_host_disconnect(
    state: State<'_, StateManager>,
    save_manager: State<'_, SaveManagerState>,
) -> Result<LoadBackupResult, String> {
    log::info!("Host disconnected, attempting recovery");
    
    // First, try to create a final backup
    let backup_result = multiplayer_create_backup(state.clone(), save_manager.clone()).await;
    
    if let Err(e) = backup_result {
        log::warn!("Failed to create final backup: {}", e);
    }
    
    // Then load the backup (or the existing one)
    multiplayer_load_backup(state, save_manager).await
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use domain::manager::Manager;
    use ofm_core::clock::GameClock;
    use chrono::Utc;

    fn create_online_game() -> Game {
        let clock = GameClock::new(Utc::now());
        let mut manager = Manager::new(
            "mgr-1".to_string(),
            "Host".to_string(),
            "Manager".to_string(),
            "1980-01-01".to_string(),
            "England".to_string(),
        );
        manager.hire("team-1".to_string());

        let mut p2_manager = Manager::new(
            "mgr-2".to_string(),
            "Client".to_string(),
            "Manager".to_string(),
            "1985-01-01".to_string(),
            "Spain".to_string(),
        );
        p2_manager.hire("team-2".to_string());

        let mut game = Game::new(clock, manager, vec![], vec![], vec![], vec![]);
        game.player2_manager = Some(p2_manager);
        game.multiplayer_mode = MultiplayerMode::Online;
        // host_player_id and joiner_player_id are tracked via manager.id and player2_manager.id
        game
    }

    #[test]
    fn test_convert_to_offline_mode() {
        let mut game = create_online_game();
        
        // Verify initial state
        assert_eq!(game.multiplayer_mode, MultiplayerMode::Online);
        assert!(game.player2_manager.is_some());
        
        // Convert to offline
        convert_to_offline_mode(&mut game);
        
        // Verify conversion
        assert_eq!(game.multiplayer_mode, MultiplayerMode::Offline);
        assert!(game.player2_manager.is_none());
        assert!(game.room_code.is_none());
        assert_eq!(game.current_player, 1);
    }

    #[test]
    fn test_backup_metadata_creation() {
        let metadata = BackupMetadata::new(
            "save-123".to_string(),
            "host-1".to_string(),
            "client-1".to_string(),
            0xDEADBEEF,
        );
        
        assert_eq!(metadata.game_id, "save-123");
        assert_eq!(metadata.host_player_id, "host-1");
        assert_eq!(metadata.client_player_id, "client-1");
        assert_eq!(metadata.last_sync_checksum, 0xDEADBEEF);
        assert!(metadata.backup_timestamp > 0);
    }

    #[tokio::test]
    async fn test_backup_save_manager_creation() {
        let manager = BackupSaveManager::new();
        
        assert!(!manager.is_auto_backup_enabled().await);
        assert!(manager.is_backup_due().await);
    }

    #[tokio::test]
    async fn test_auto_backup_enable() {
        let manager = BackupSaveManager::new();
        
        manager.enable_auto_backup("save-123".to_string()).await;
        
        assert!(manager.is_auto_backup_enabled().await);
        assert_eq!(manager.get_backup_save_id().await, Some("save-123".to_string()));
    }

    #[tokio::test]
    async fn test_backup_due_after_interval() {
        let manager = BackupSaveManager::new();
        
        // Initially backup should be due
        assert!(manager.is_backup_due().await);
        
        // Mark backup completed
        manager.mark_backup_completed(0x12345678).await;
        
        // Immediately after, backup should NOT be due
        assert!(!manager.is_backup_due().await);
    }

    #[tokio::test]
    async fn test_backup_manager_reset() {
        let manager = BackupSaveManager::new();
        
        // Enable and mark backup
        manager.enable_auto_backup("save-123".to_string()).await;
        manager.mark_backup_completed(0xDEADBEEF).await;
        
        // Reset
        manager.reset().await;
        
        // Verify reset state
        assert!(!manager.is_auto_backup_enabled().await);
        assert!(manager.get_backup_save_id().await.is_none());
        assert!(manager.get_last_backup_checksum().await.is_none());
    }

    #[test]
    fn test_load_backup_result_serialization() {
        let result = LoadBackupResult {
            success: true,
            game_id: "save-123".to_string(),
            converted_to_offline: true,
            message: "Backup loaded".to_string(),
        };
        
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("success"));
        assert!(json.contains("convertedToOffline"));
    }
}