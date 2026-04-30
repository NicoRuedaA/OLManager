//! Multiplayer Tauri Commands
//! 
//! Commands for creating/joining online rooms and managing multiplayer state.
//! MVP: Host runs WebSocket server, Client connects directly.

use crate::SaveManagerState;
use crate::backup_save::LoadBackupResult;
use domain::manager::Manager;
use ofm_core::error::MultiplayerError;
use ofm_core::game::{Game, MultiplayerMode};
use ofm_core::state::StateManager;
use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

// WebSocket modules (MVP)
mod websocket_server;
mod websocket_client;
mod messages;

use websocket_server::WebSocketServer;
use websocket_client::WebSocketClient;
use messages::{NetworkMessage, ConnectionStatus, compute_checksum};

/// Player context for multiplayer-aware commands
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum PlayerContext {
    #[default]
    SinglePlayer,
    Player1,
    Player2,
}

impl PlayerContext {
    /// Get player number (1 or 2, 0 for single player)
    pub fn player_num(&self) -> u8 {
        match self {
            PlayerContext::SinglePlayer => 0,
            PlayerContext::Player1 => 1,
            PlayerContext::Player2 => 2,
        }
    }

    /// Check if this is a multiplayer context
    pub fn is_multiplayer(&self) -> bool {
        matches!(self, PlayerContext::Player1 | PlayerContext::Player2)
    }
}

/// Connection status for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStatus {
    pub connected: bool,
    pub is_host: bool,
    pub room_code: Option<String>,
    pub opponent_name: Option<String>,
}

/// Resolve player context from optional manager_id
/// 
/// In single-player mode: returns SinglePlayer
/// In multiplayer mode: if manager_id matches player1, returns Player1, 
/// if matches player2, returns Player2
pub fn resolve_player_context(game: &Game, manager_id: Option<&str>) -> PlayerContext {
    // If no manager_id provided and game is offline, assume single player
    let Some(manager_id) = manager_id else {
        if game.multiplayer_mode == MultiplayerMode::Offline {
            return PlayerContext::SinglePlayer;
        }
        // In multiplayer, default to player 1 if not specified
        return PlayerContext::Player1;
    };

    // Check if it's player 1
    if game.manager.id == manager_id {
        return PlayerContext::Player1;
    }

    // Check if it's player 2
    if let Some(p2) = &game.player2_manager {
        if p2.id == manager_id {
            return PlayerContext::Player2;
        }
    }

    // Default to player 1 if not found
    PlayerContext::Player1
}

/// Get the team_id for the given player context
/// 
/// Returns None if the player doesn't exist (e.g., player 2 in single-player)
pub fn get_team_id_for_context(game: &Game, context: PlayerContext) -> Option<String> {
    match context {
        PlayerContext::SinglePlayer => game.manager.team_id.clone(),
        PlayerContext::Player1 => game.manager.team_id.clone(),
        PlayerContext::Player2 => game.player2_manager.as_ref().and_then(|m| m.team_id.clone()),
    }
}

/// Get mutable manager reference for the given player context
/// 
/// Returns error if player doesn't exist
pub fn get_manager_for_context<'a>(
    game: &'a mut Game,
    context: PlayerContext,
) -> Result<&'a mut Manager, MultiplayerError> {
    match context {
        PlayerContext::SinglePlayer | PlayerContext::Player1 => {
            Ok(&mut game.manager)
        }
        PlayerContext::Player2 => {
            game.player2_manager
                .as_mut()
                .ok_or(MultiplayerError::PlayerNotFound(
                    "Player 2 does not exist".to_string(),
                ))
        }
    }
}

/// Validate that the calling player can modify their own team
/// 
/// In multiplayer: ensures the manager_id belongs to a valid player
/// In single-player: always allows (backward compatible)
pub fn validate_player_action(
    game: &Game,
    manager_id: Option<&str>,
) -> Result<PlayerContext, MultiplayerError> {
    let context = resolve_player_context(game, manager_id);

    // In single-player mode, always allow
    if game.multiplayer_mode == MultiplayerMode::Offline {
        return Ok(context);
    }

    // In multiplayer, verify the player exists
    match context {
        PlayerContext::SinglePlayer => {
            Err(MultiplayerError::InvalidPlayerContext(
                "Must specify a valid manager_id in multiplayer mode".to_string(),
            ))
        }
        PlayerContext::Player1 => {
            // Verify player 1 exists
            if game.manager.id.is_empty() {
                Err(MultiplayerError::PlayerNotFound(
                    "Player 1 not found".to_string(),
                ))
            } else {
                Ok(context)
            }
        }
        PlayerContext::Player2 => {
            // Verify player 2 exists
            if game.player2_manager.is_none() {
                Err(MultiplayerError::PlayerNotFound(
                    "Player 2 not found".to_string(),
                ))
            } else {
                Ok(context)
            }
        }
    }
}

/// Check if an operation should be blocked in multiplayer mode
/// 
/// Some operations like advance_time need special handling in multiplayer
pub fn check_operation_allowed_in_multiplayer(
    game: &Game,
    operation: &str,
) -> Result<(), MultiplayerError> {
    if game.multiplayer_mode == MultiplayerMode::Online {
        match operation {
            "advance_time" | "advance_time_with_mode" => {
                return Err(MultiplayerError::OperationNotAllowedInMultiplayer(
                    "Use mark_day_ready + host advances instead".to_string(),
                ));
            }
            _ => {}
        }
    }
    Ok(())
}

/// Create a new online room (host - MVP WebSocket Server)
#[tauri::command]
pub async fn multiplayer_create_room(
    state: State<'_, StateManager>,
    host_name: String,
    port: Option<u16>, // NEW: configurable port (default 3000)
) -> Result<RoomInfo, String> {
    let port = port.unwrap_or(3000);
    
    log::info!("Creating multiplayer room for host: {} on port {}", host_name, port);
    
    // Create WebSocket server
    let server = WebSocketServer::new(port);
    
    // Start the server
    if let Err(e) = server.start() {
        return Err(format!("Failed to start WebSocket server: {}", e));
    }
    
    // Store server in StateManager (to keep it alive)
    // TODO: Properly store in state (for now, just log)
    log::info!("WebSocket server started on port {}", port);
    
    // Get local IPs for display
    let local_ip = get_local_ip();
    let public_ip = get_public_ip().await;
    
    // Generate room code (for UI reference)
    let room_code = generate_room_code();
    
    log::info!("Room created: {} (connect to {}:{})", room_code, public_ip, port);
    
    Ok(RoomInfo {
        room_code,
        port,
        local_ip,
        public_ip,
    })
}

/// Room information for host
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomInfo {
    pub room_code: String,
    pub port: u16,
    pub local_ip: Option<String>,
    pub public_ip: Option<String>,
}

/// Get local IP address
fn get_local_ip() -> Option<String> {
    use std::net::TcpStream;
    // Connect to a public server to get local IP
    if let Ok(stream) = TcpStream::connect("8.8.8.8:80") {
        if let Ok(local_addr) = stream.local_addr() {
            return Some(local_addr.ip().to_string());
        }
    }
    None
}

/// Get public IP address (async)
async fn get_public_ip() -> Option<String> {
    // Try to get public IP from a public service
    let clients = reqwest::Client::new();
    match clients.get("https://api.ipify.org").send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                if let Ok(ip) = resp.text().await {
                    return Some(ip.trim().to_string());
                }
            }
            None
        }
        Err(_) => None,
    }
}

/// Join an existing room (client - MVP WebSocket)
#[tauri::command]
pub async fn multiplayer_join_room(
    host_ip: String,
    port: Option<u16>,
    client_name: String,
) -> Result<ConnectionStatus, String> {
    let port = port.unwrap_or(3000);
    
    log::info!("Joining {}:{} as {}", host_ip, port, client_name);
    
    // Create WebSocket client
    let mut client = WebSocketClient::new();
    
    // Connect to Host's WebSocket server
    client.connect(&host_ip, port).await?;
    
    // Send handshake
    let handshake = NetworkMessage::Handshake {
        player_name: client_name.clone(),
        player_num: 2, // Client is always player 2
    };
    
    client.send(&handshake).await?;
    
    // Wait for handshake response (with timeout)
    let status = tokio::time::timeout(
        tokio::time::Duration::from_secs(10),
        async {
            while let Some(msg) = client.receive().await? {
                if let NetworkMessage::HandshakeResponse { success, game_state, error } = msg {
                    return Ok(ConnectionStatus {
                        connected: success,
                        is_host: false,
                        peer_name: Some(client_name.clone()),
                        last_error: error,
                    });
                }
            }
            Err("No response from host".to_string())
        }
    ).await
        .map_err(|_| "Connection timeout".to_string())?
        .map_err(|e| format!("Handshake failed: {}", e))?;
    
    log::info!("Connected to {}:{} as {}", host_ip, port, client_name);
    
    Ok(status)
}

/// Disconnect from current room
/// 
/// On Client: creates a final backup before disconnecting
/// On Host: stops WebSocket server and cleans up
#[tauri::command]
pub async fn multiplayer_disconnect(
    state: State<'_, StateManager>,
    save_manager: State<'_, SaveManagerState>,
    is_client: bool,
) -> Result<Option<LoadBackupResult>, String> {
    log::info!("Disconnecting from multiplayer session (is_client: {})", is_client);
    
    if is_client {
        // Client: create final backup before disconnecting
        log::info!("Client disconnecting - creating final backup");
        
        // Create backup
        let backup_result = crate::commands::backup_save::multiplayer_create_backup(
            state.clone(),
            save_manager.clone(),
        ).await;
        
        match backup_result {
            Ok(()) => {
                log::info!("Final backup created before disconnect");
            }
            Err(e) => {
                log::warn!("Failed to create final backup: {}", e);
            }
        }
        
        // Disconnect WebSocket client
        // TODO: Get actual client instance from state
        log::info!("Disconnecting WebSocket client");
        
        // Try to load the backup
        match crate::commands::backup_save::multiplayer_load_backup(
            state.clone(),
            save_manager.clone(),
        ).await {
            Ok(result) => {
                log::info!("Loaded backup for offline recovery");
                return Ok(Some(result));
            }
            Err(e) => {
                log::warn!("Failed to load backup: {}", e);
                return Ok(None);
            }
        }
    } else {
        // Host: stop WebSocket server
        log::info!("Host disconnecting - stopping WebSocket server");
        // TODO: Get server instance from state and call stop()
        // For now, just log
        
        Ok(None)
    }
}

/// Mark current day as ready (both players)
/// 
/// In multiplayer mode: requires manager_id to identify which player is marking ready
#[tauri::command]
pub async fn mark_day_ready(
    state: State<'_, StateManager>,
    manager_id: Option<String>,
) -> Result<ofm_core::game::Game, String> {
    let mut game_guard = state
        .active_game
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    
    let game = game_guard.as_mut().ok_or("No active game")?;
    
    // Resolve player context from manager_id
    let context = resolve_player_context(game, manager_id.as_deref());
    
    // Validate the player exists in multiplayer mode
    if game.multiplayer_mode != MultiplayerMode::Offline {
        validate_player_action(game, manager_id.as_deref())
            .map_err(|e| e.to_string())?;
    }
    
    let player_num = context.player_num();
    
    // In single-player mode, player_num is 0 which is invalid - use 1
    let player_num = if player_num == 0 { 1 } else { player_num };
    
    let can_advance = game.mark_player_ready(player_num);
    
    if can_advance {
        log::info!("Both players ready to advance day");
        // Day will be advanced by the game loop
    } else {
        log::info!("Player {} ready, waiting for opponent", player_num);
    }
    
    Ok(game.clone())
}

/// Get current connection status (MVP WebSocket)
#[tauri::command]
pub async fn get_connection_status(
    _state: State<'_, StateManager>,
) -> Result<ConnectionStatus, String> {
    // TODO: Get actual status from WebSocket server/client
    // For now, return disconnected (will be updated when state is integrated)
    
    Ok(ConnectionStatus {
        connected: false,  // TODO: Check WebSocket connection
        is_host: false,     // TODO: Check if we're host
        peer_name: None,
        last_error: None,
    })
}

/// Get room status (MVP - simplified)
#[tauri::command]
pub async fn get_room_status(
    room_code: String,
) -> Result<RoomStatusResponse, String> {
    // MVP: Room status is local (no signaling server)
    // TODO: If using Relay Server in future, call API
    
    Ok(RoomStatusResponse {
        room_code,
        status: "waiting".to_string(), // TODO: Check actual status
        host_name: None,
        client_name: None,
    })
}

/// Internal helper: Store WebSocket server in state (TODO: proper state management)
/// For now, server is started in local scope of multiplayer_create_room
/// In production, this should be stored in StateManager or similar

/// Room status response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomStatusResponse {
    pub room_code: String,
    pub status: String,
    pub host_name: Option<String>,
    pub client_name: Option<String>,
}

/// Generate a 6-character room code
fn generate_room_code() -> String {
    use rand::{Rng, RngExt};
    const CHARSET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut rng = rand::rng();
    (0..6)
        .map(|_| {
            let idx = rng.random_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::manager::Manager;
    use ofm_core::clock::GameClock;
    use ofm_core::game::{Game, MultiplayerMode};
    
    fn create_single_player_game() -> Game {
        let clock = GameClock::new(chrono::Utc::now());
        let mut manager = Manager::new(
            "mgr-1".to_string(),
            "Test".to_string(),
            "Manager".to_string(),
            "1980-01-01".to_string(),
            "England".to_string(),
        );
        manager.hire("team-1".to_string());

        let mut game = Game::new(clock, manager, vec![], vec![], vec![], vec![]);
        game.multiplayer_mode = MultiplayerMode::Offline;
        game
    }

    fn create_multiplayer_game() -> Game {
        let clock = GameClock::new(chrono::Utc::now());
        let mut manager = Manager::new(
            "mgr-1".to_string(),
            "Player".to_string(),
            "One".to_string(),
            "1980-01-01".to_string(),
            "England".to_string(),
        );
        manager.hire("team-1".to_string());

        let mut p2_manager = Manager::new(
            "mgr-2".to_string(),
            "Player".to_string(),
            "Two".to_string(),
            "1980-01-01".to_string(),
            "Spain".to_string(),
        );
        p2_manager.hire("team-2".to_string());

        let mut game = Game::new(clock, manager, vec![], vec![], vec![], vec![]);
        game.player2_manager = Some(p2_manager);
        game.multiplayer_mode = MultiplayerMode::Online;
        game
    }

    #[test]
    fn test_generate_room_code() {
        let code = generate_room_code();
        assert_eq!(code.len(), 6);
        assert!(code.chars().all(|c| c.is_alphanumeric()));
    }
    
    #[test]
    fn test_connection_status_serialization() {
        let status = ConnectionStatus {
            connected: false,
            is_host: false,
            room_code: None,
            opponent_name: None,
        };
        
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("connected"));
    }

    #[test]
    fn test_player_context_defaults_to_single_player() {
        let context = PlayerContext::default();
        assert_eq!(context, PlayerContext::SinglePlayer);
    }

    #[test]
    fn test_player_context_player_num() {
        assert_eq!(PlayerContext::SinglePlayer.player_num(), 0);
        assert_eq!(PlayerContext::Player1.player_num(), 1);
        assert_eq!(PlayerContext::Player2.player_num(), 2);
    }

    #[test]
    fn test_resolve_player_context_single_player_mode() {
        let game = create_single_player_game();
        
        // No manager_id -> SinglePlayer in offline mode
        let context = resolve_player_context(&game, None);
        assert_eq!(context, PlayerContext::SinglePlayer);
        
        // With manager_id matching player 1
        let context = resolve_player_context(&game, Some("mgr-1"));
        assert_eq!(context, PlayerContext::Player1);
    }

    #[test]
    fn test_resolve_player_context_multiplayer_mode() {
        let game = create_multiplayer_game();
        
        // No manager_id defaults to Player1 in multiplayer
        let context = resolve_player_context(&game, None);
        assert_eq!(context, PlayerContext::Player1);
        
        // With manager_id matching player 1
        let context = resolve_player_context(&game, Some("mgr-1"));
        assert_eq!(context, PlayerContext::Player1);
        
        // With manager_id matching player 2
        let context = resolve_player_context(&game, Some("mgr-2"));
        assert_eq!(context, PlayerContext::Player2);
    }

    #[test]
    fn test_get_team_id_for_context() {
        let game = create_multiplayer_game();
        
        let team_id = get_team_id_for_context(&game, PlayerContext::Player1);
        assert_eq!(team_id, Some("team-1".to_string()));
        
        let team_id = get_team_id_for_context(&game, PlayerContext::Player2);
        assert_eq!(team_id, Some("team-2".to_string()));
        
        let team_id = get_team_id_for_context(&game, PlayerContext::SinglePlayer);
        assert_eq!(team_id, Some("team-1".to_string()));
    }

    #[test]
    fn test_validate_player_action_single_player() {
        let game = create_single_player_game();
        
        // Should always allow in single-player mode
        let result = validate_player_action(&game, Some("mgr-1"));
        assert!(result.is_ok());
        
        let result = validate_player_action(&game, None);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_player_action_multiplayer() {
        let game = create_multiplayer_game();
        
        // Player 1 should be allowed
        let result = validate_player_action(&game, Some("mgr-1"));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), PlayerContext::Player1);
        
        // Player 2 should be allowed
        let result = validate_player_action(&game, Some("mgr-2"));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), PlayerContext::Player2);
        
        // No manager_id in multiplayer defaults to Player1 - should be allowed
        let result = validate_player_action(&game, None);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), PlayerContext::Player1);
    }
}
