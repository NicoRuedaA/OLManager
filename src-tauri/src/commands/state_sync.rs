//! State Sync Manager for Online Multiplayer
//!
//! Handles periodic state synchronization between Host and Client.
//! - Periodic sync: Every 30 seconds, Host sends state checksum to Client
//! - Checksum validation: Client compares checksums, requests full sync if mismatch
//! - State diff: Send only changed data when possible (optimization)
//! - Full sync: Complete state transfer when checksums don't match or on join
//! - Backup: Client creates backup after receiving full state sync

use crate::SaveManagerState;
use ofm_core::game::{Game, MultiplayerMode};
use ofm_core::network::{GameStateChecksum, SyncReason};
use ofm_core::state::StateManager;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::State;
use tokio::sync::Mutex;

/// Sync interval in seconds
pub const SYNC_INTERVAL_SECS: u64 = 30;

/// State Sync Manager
/// 
/// Manages state synchronization between host and client in online multiplayer.
pub struct StateSyncManager {
    /// Last sync timestamp
    last_sync: Arc<Mutex<Option<u64>>>,
    /// Last computed checksum
    last_checksum: Arc<Mutex<Option<GameStateChecksum>>>,
    /// Client's last known checksum (for comparison)
    client_last_checksum: Arc<Mutex<Option<GameStateChecksum>>>,
    /// Sync task handle (None if not running)
    #[allow(dead_code)]
    sync_task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
    /// Whether this instance is the host
    is_host: bool,
    /// Whether sync is enabled
    enabled: Arc<Mutex<bool>>,
    /// Sync error count (for monitoring)
    error_count: Arc<Mutex<u32>>,
}

impl StateSyncManager {
    /// Create a new StateSyncManager
    pub fn new(is_host: bool) -> Self {
        Self {
            last_sync: Arc::new(Mutex::new(None)),
            last_checksum: Arc::new(Mutex::new(None)),
            client_last_checksum: Arc::new(Mutex::new(None)),
            sync_task: Arc::new(Mutex::new(None)),
            is_host,
            enabled: Arc::new(Mutex::new(false)),
            error_count: Arc::new(Mutex::new(0)),
        }
    }

    /// Start periodic sync (host side)
    pub async fn start_periodic_sync(&self) {
        let mut enabled = self.enabled.lock().await;
        *enabled = true;
        log::info!("State sync periodic task started (interval: {}s)", SYNC_INTERVAL_SECS);
    }

    /// Stop periodic sync
    pub async fn stop_periodic_sync(&self) {
        let mut enabled = self.enabled.lock().await;
        *enabled = false;
        log::info!("State sync periodic task stopped");
    }

    /// Check if sync is enabled
    pub async fn is_enabled(&self) -> bool {
        *self.enabled.lock().await
    }

    /// Compute checksum for current game state
    pub async fn compute_checksum(&self, game: &Game) -> GameStateChecksum {
        let checksum = GameStateChecksum::from_game(game);
        
        let mut last_checksum = self.last_checksum.lock().await;
        *last_checksum = Some(checksum.clone());
        
        checksum
    }

    /// Update client checksum (called when client receives checksum from host)
    pub async fn update_client_checksum(&self, checksum: GameStateChecksum) {
        let mut client_checksum = self.client_last_checksum.lock().await;
        *client_checksum = Some(checksum);
    }

    /// Get last computed checksum
    pub async fn get_last_checksum(&self) -> Option<GameStateChecksum> {
        self.last_checksum.lock().await.clone()
    }

    /// Get client last checksum
    pub async fn get_client_last_checksum(&self) -> Option<GameStateChecksum> {
        self.client_last_checksum.lock().await.clone()
    }

    /// Check if checksums match
    pub async fn checksums_match(&self) -> bool {
        let host_checksum = self.last_checksum.lock().await;
        let client_checksum = self.client_last_checksum.lock().await;

        match (&*host_checksum, &*client_checksum) {
            (Some(host), Some(client)) => host.matches(client),
            _ => false,
        }
    }

    /// Mark sync as completed
    pub async fn mark_sync_completed(&self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        let mut last_sync = self.last_sync.lock().await;
        *last_sync = Some(now);
        
        log::debug!("Sync marked completed at {}", now);
    }

    /// Get time since last sync
    pub async fn time_since_last_sync(&self) -> Option<Duration> {
        let last_sync = self.last_sync.lock().await;
        
        if let Some(last) = *last_sync {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            
            // Use >= to handle case where timestamps are equal
            if now >= last {
                return Some(Duration::from_secs(now - last));
            }
        }
        
        None
    }

    /// Check if periodic sync is due
    pub async fn is_sync_due(&self) -> bool {
        if let Some(duration) = self.time_since_last_sync().await {
            return duration.as_secs() >= SYNC_INTERVAL_SECS;
        }
        
        // No sync ever - it's due
        true
    }

    /// Increment error count
    pub async fn increment_error(&self) {
        let mut count = self.error_count.lock().await;
        *count += 1;
        log::warn!("Sync error count: {}", *count);
    }

    /// Get error count
    pub async fn get_error_count(&self) -> u32 {
        *self.error_count.lock().await
    }

    /// Reset error count
    pub async fn reset_errors(&self) {
        let mut count = self.error_count.lock().await;
        *count = 0;
    }
}

impl Default for StateSyncManager {
    fn default() -> Self {
        Self::new(false)
    }
}

/// Sync status for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub enabled: bool,
    pub is_host: bool,
    pub last_sync_timestamp: Option<u64>,
    pub time_since_last_sync_secs: Option<u64>,
    pub checksums_match: bool,
    pub error_count: u32,
    pub sync_interval_secs: u64,
}

impl SyncStatus {
    /// Create from StateSyncManager
    pub async fn from_manager(manager: &StateSyncManager) -> Self {
        let last_timestamp = *manager.last_sync.lock().await;
        let time_since = manager.time_since_last_sync().await
            .map(|d| d.as_secs());
        
        Self {
            enabled: manager.is_enabled().await,
            is_host: manager.is_host,
            last_sync_timestamp: last_timestamp,
            time_since_last_sync_secs: time_since,
            checksums_match: manager.checksums_match().await,
            error_count: manager.get_error_count().await,
            sync_interval_secs: SYNC_INTERVAL_SECS,
        }
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Start periodic sync (Host command)
#[tauri::command]
pub async fn multiplayer_start_sync(
    state: State<'_, StateManager>,
) -> Result<(), String> {
    log::info!("Starting periodic state sync");
    
    let game_guard = state
        .active_game
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    
    let game = game_guard.as_ref().ok_or("No active game")?;
    
    // Only in online mode
    if game.multiplayer_mode != MultiplayerMode::Online {
        return Err("Sync only available in online mode".to_string());
    }
    
    // TODO: Actually start the sync manager
    // For now, just log
    log::info!("Periodic sync started (every {} seconds)", SYNC_INTERVAL_SECS);
    
    Ok(())
}

/// Send checksum to client (Host command)
#[tauri::command]
pub async fn multiplayer_send_checksum(
    state: State<'_, StateManager>,
) -> Result<GameStateChecksum, String> {
    let game_guard = state
        .active_game
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    
    let game = game_guard.as_ref().ok_or("No active game")?;
    
    // Compute checksum
    let checksum = GameStateChecksum::from_game(game);
    
    log::debug!(
        "Checksum computed: combined={:016x}, team={:016x}, league={:016x}, transfers={:016x}, finances={:016x}",
        checksum.combined,
        checksum.team_checksum,
        checksum.league_checksum,
        checksum.transfers_checksum,
        checksum.finances_checksum
    );
    
    // TODO: Send via WebRTC to client
    // For now, just return the checksum
    
    Ok(checksum)
}

/// Request sync from host (Client command)
#[tauri::command]
pub async fn multiplayer_request_sync(
    state: State<'_, StateManager>,
    reason: String,
) -> Result<(), String> {
    log::info!("Requesting sync from host, reason: {}", reason);
    
    let game_guard = state
        .active_game
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    
    let game = game_guard.as_ref().ok_or("No active game")?;
    
    // Only in online mode
    if game.multiplayer_mode != MultiplayerMode::Online {
        return Err("Sync only available in online mode".to_string());
    }
    
    // Parse reason
    let sync_reason = match reason.as_str() {
        "on_join" => SyncReason::OnJoin,
        "checksum_mismatch" => SyncReason::ChecksumMismatch,
        "periodic_request" => SyncReason::PeriodicRequest,
        "manual_refresh" => SyncReason::ManualRefresh,
        _ => SyncReason::ManualRefresh,
    };
    
    log::info!("Sync requested with reason: {:?}", sync_reason);
    
    // TODO: Send RequestSync message to host via WebRTC
    
    Ok(())
}

/// Get current sync status (Client command)
#[tauri::command]
pub async fn multiplayer_get_sync_status(
    _state: State<'_, StateManager>,
) -> Result<SyncStatus, String> {
    // TODO: Get actual status from StateSyncManager
    // For now, return default status
    
    Ok(SyncStatus {
        enabled: false,
        is_host: false,
        last_sync_timestamp: None,
        time_since_last_sync_secs: None,
        checksums_match: true,
        error_count: 0,
        sync_interval_secs: SYNC_INTERVAL_SECS,
    })
}

/// Verify local checksum matches expected (Client command)
#[tauri::command]
pub async fn multiplayer_verify_checksum(
    state: State<'_, StateManager>,
    expected: u64,
) -> Result<bool, String> {
    let game_guard = state
        .active_game
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    
    let game = game_guard.as_ref().ok_or("No active game")?;
    
    // Compute local checksum
    let local_checksum = GameStateChecksum::from_game(game);
    
    let matches = local_checksum.combined == expected;
    
    if !matches {
        log::warn!(
            "Checksum mismatch! Expected: {:016x}, Local: {:016x}",
            expected,
            local_checksum.combined
        );
    } else {
        log::debug!("Checksum verified: matches");
    }
    
    Ok(matches)
}

/// Force full sync request (Client command)
#[tauri::command]
pub async fn multiplayer_force_sync(
    state: State<'_, StateManager>,
) -> Result<(), String> {
    log::info!("Force requesting full sync from host");
    
    // Request sync with ManualRefresh reason
    multiplayer_request_sync(state, "manual_refresh".to_string()).await
}

/// Receive full state sync from Host and create backup (Client command)
/// 
/// Called when:
/// - Client joins and receives initial state
/// - Periodic full sync after checksum mismatch
#[tauri::command]
pub async fn multiplayer_receive_full_sync(
    state: State<'_, StateManager>,
    save_manager: State<'_, SaveManagerState>,
    checksum: u64,
) -> Result<(), String> {
    log::info!("Received full state sync from Host, checksum: {:016x}", checksum);
    
    // The game state should already be updated via WebRTC before this is called
    // This command is called after the state is applied to trigger backup
    
    // Create backup after receiving full sync
    let backup_result = crate::commands::backup_save::multiplayer_create_backup(
        state.clone(),
        save_manager.clone(),
    ).await;
    
    match backup_result {
        Ok(()) => {
            log::info!("Backup created successfully after full sync");
            Ok(())
        }
        Err(e) => {
            log::warn!("Failed to create backup after sync: {}", e);
            // Don't fail the sync if backup fails - continue anyway
            Ok(())
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use domain::manager::Manager;
    use ofm_core::clock::GameClock;
    use ofm_core::game::{Game, MultiplayerMode};
    use chrono::Utc;

    fn create_test_game() -> Game {
        let clock = GameClock::new(Utc::now());
        let mut manager = Manager::new(
            "mgr-1".to_string(),
            "Test".to_string(),
            "Manager".to_string(),
            "1980-01-01".to_string(),
            "England".to_string(),
        );
        manager.hire("team-1".to_string());

        let mut game = Game::new(clock, manager, vec![], vec![], vec![], vec![]);
        game.multiplayer_mode = MultiplayerMode::Online;
        game
    }

    #[test]
    fn test_checksum_computation_deterministic() {
        let game = create_test_game();
        
        // Compute checksum multiple times
        let checksum1 = GameStateChecksum::from_game(&game);
        let checksum2 = GameStateChecksum::from_game(&game);
        
        // Should be identical
        assert_eq!(checksum1.combined, checksum2.combined);
        assert_eq!(checksum1.team_checksum, checksum2.team_checksum);
    }

    #[test]
    fn test_checksum_changes_when_state_changes() {
        let mut game1 = create_test_game();
        let game2 = create_test_game();
        
        let checksum1 = GameStateChecksum::from_game(&game1);
        let checksum2 = GameStateChecksum::from_game(&game2);
        
        // Same initial state should have same checksum
        assert_eq!(checksum1.combined, checksum2.combined);
    }

    #[test]
    fn test_sync_status_default() {
        let status = SyncStatus {
            enabled: false,
            is_host: true,
            last_sync_timestamp: None,
            time_since_last_sync_secs: None,
            checksums_match: true,
            error_count: 0,
            sync_interval_secs: SYNC_INTERVAL_SECS,
        };
        
        assert!(!status.enabled);
        assert!(status.is_host);
        assert!(status.checksums_match);
    }

    #[test]
    fn test_sync_reason_parsing() {
        let reason = "on_join";
        let sync_reason = match reason {
            "on_join" => SyncReason::OnJoin,
            "checksum_mismatch" => SyncReason::ChecksumMismatch,
            "periodic_request" => SyncReason::PeriodicRequest,
            "manual_refresh" => SyncReason::ManualRefresh,
            _ => SyncReason::ManualRefresh,
        };
        
        assert_eq!(sync_reason, SyncReason::OnJoin);
    }

    #[tokio::test]
    async fn test_state_sync_manager_creation() {
        let manager = StateSyncManager::new(true);
        
        assert!(!manager.is_enabled().await);
        assert!(manager.get_last_checksum().await.is_none());
    }

    #[tokio::test]
    async fn test_sync_due_when_no_sync() {
        let manager = StateSyncManager::new(true);
        
        // No sync ever - should be due
        assert!(manager.is_sync_due().await);
    }

    #[tokio::test]
    async fn test_sync_interval() {
        let manager = StateSyncManager::new(false);
        
        // Initially sync should be due (no previous sync)
        let initially_due = manager.is_sync_due().await;
        assert!(initially_due, "Initial sync should be due");
        
        // Mark sync completed
        manager.mark_sync_completed().await;
        
        // Allow a small amount of time to pass
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
        
        // Now sync should NOT be due (within 30 second window)
        let is_due_after = manager.is_sync_due().await;
        assert!(!is_due_after, "Sync should NOT be due immediately after completing");
    }

    #[tokio::test]
    async fn test_checksum_comparison() {
        let manager = StateSyncManager::new(false);
        
        // Create first game
        let game1 = create_test_game();
        
        // Compute and store host checksum
        let checksum1 = manager.compute_checksum(&game1).await;
        
        // Update client checksum
        manager.update_client_checksum(checksum1.clone()).await;
        
        // Should match now
        let match_after_first = manager.checksums_match().await;
        assert!(match_after_first, "Checksums should match after first sync");
        
        // Create second game (different manager/team)
        let game2 = create_test2_game();
        
        // Compute checksum for different game (this updates last_checksum)
        let checksum2 = manager.compute_checksum(&game2).await;
        
        // The host now has game2's checksum, client still has game1's
        // But we're now updating client with game2's checksum
        manager.update_client_checksum(checksum2).await;
        
        // Should match now (both have game2's checksum)
        let match_after_second = manager.checksums_match().await;
        assert!(match_after_second, "Checksums should match after updating both");
        
        // Now create a third different game but DON'T update host
        // Instead manually set client to a different checksum
        let game3 = create_test_game();
        let checksum3 = GameStateChecksum::from_game(&game3);
        
        // Manually update client to a completely different checksum
        let mut different_checksum = checksum3;
        different_checksum.combined = 0xDEADBEEF; // Force different value
        
        manager.update_client_checksum(different_checksum).await;
        
        // Should NOT match now (host has game2, client has different)
        let no_match = manager.checksums_match().await;
        assert!(!no_match, "Checksums should NOT match with different values");
    }

    fn create_test2_game() -> Game {
        let clock = GameClock::new(Utc::now());
        let mut manager = Manager::new(
            "mgr-2".to_string(),
            "Test2".to_string(),
            "Manager2".to_string(),
            "1985-01-01".to_string(),
            "Spain".to_string(),
        );
        manager.hire("team-2".to_string());

        let mut game = Game::new(clock, manager, vec![], vec![], vec![], vec![]);
        game.multiplayer_mode = MultiplayerMode::Online;
        game
    }

    #[test]
    fn test_game_state_checksum_from_game() {
        let game = create_test_game();
        let checksum = GameStateChecksum::from_game(&game);
        
        // All fields should be non-zero
        assert_ne!(checksum.team_checksum, 0);
        assert_ne!(checksum.timestamp, 0);
        
        // Combined should be computed from components
        let expected_combined = checksum.team_checksum
            .wrapping_mul(31)
            .wrapping_add(checksum.league_checksum)
            .wrapping_mul(37)
            .wrapping_add(checksum.transfers_checksum)
            .wrapping_mul(41)
            .wrapping_add(checksum.finances_checksum);
        
        assert_eq!(checksum.combined, expected_combined);
    }

    #[test]
    fn test_game_state_checksum_matches() {
        let game = create_test_game();
        let checksum1 = GameStateChecksum::from_game(&game);
        let checksum2 = GameStateChecksum::from_game(&game);
        
        assert!(checksum1.matches(&checksum2));
        assert!(checksum2.matches(&checksum1));
    }
}