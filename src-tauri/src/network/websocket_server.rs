//! WebSocket Server for MVP (Host runs this)
//!
//! Listens on port 3000 (default) and handles one client connection.

use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::Mutex;
use ofm_core::game::Game;
use crate::network::messages::{NetworkMessage, compute_checksum};
use serde_json;

/// WebSocket server state
pub struct WebSocketServer {
    addr: SocketAddr,
    host_game_state: Arc<Mutex<Option<Game>>>,
    is_running: Arc<Mutex<bool>>,
}

impl WebSocketServer {
    /// Create new server instance
    pub fn new(port: u16) -> Self {
        let addr = SocketAddr::from(([0, 0, 0, 0], port));
        Self {
            addr,
            host_game_state: Arc::new(Mutex::new(None)),
            is_running: Arc::new(Mutex::new(false)),
        }
    }

    /// Start the WebSocket server (spawns task)
    pub fn start(&self) -> Result<(), String> {
        let addr = self.addr;
        let game_state = self.host_game_state.clone();
        let is_running = self.is_running.clone();

        // Mark as running
        tokio::spawn(async move {
            *is_running.lock().await = true;

            log::info!("WebSocket server starting on {}", addr);

            // Bind to address
            let listener = match TcpListener::bind(addr).await {
                Ok(l) => l,
                Err(e) => {
                    log::error!("Failed to bind to {}: {}", addr, e);
                    *is_running.lock().await = false;
                    return;
                }
            };

            log::info!("WebSocket server listening on {}", addr);

            // Accept connections (only one client for MVP)
            while *is_running.lock().await {
                tokio::select! {
                    accept_result = listener.accept() => {
                        match accept_result {
                            Ok((stream, client_addr)) => {
                                log::info!("New WebSocket connection from {}", client_addr);

                                let game = game_state.clone();
                                tokio::spawn(async move {
                                    if let Err(e) = handle_client(stream, client_addr, game).await {
                                        log::error!("Client handler error: {}", e);
                                    }
                                });
                            }
                            Err(e) => {
                                log::error!("Failed to accept connection: {}", e);
                            }
                        }
                    }
                    _ = tokio::time::sleep(tokio::time::Duration::from_millis(100)) => {
                        // Check if still running
                        continue;
                    }
                }
            }

            log::info!("WebSocket server stopped");
        });

        Ok(())
    }

    /// Stop the server
    pub async fn stop(&self) {
        let mut running = self.is_running.lock().await;
        *running = false;
    }

    /// Update game state (called by host when game changes)
    pub async fn update_game_state(&self, game: Game) {
        let mut state = self.host_game_state.lock().await;
        *state = Some(game);
    }

    /// Check if server is running
    pub async fn is_running(&self) -> bool {
        *self.is_running.lock().await
    }
}

/// Handle a single client connection
async fn handle_client(
    stream: tokio::net::TcpStream,
    addr: SocketAddr,
    game_state: Arc<Mutex<Option<Game>>>,
) -> Result<(), Box<dyn std::error::Error>> {
    // Accept WebSocket handshake
    let ws_stream = accept_async(stream).await?;
    let (mut write, mut read) = ws_stream.split();

    log::info!("WebSocket handshake complete with {}", addr);

    // Send initial handshake response with game state
    let game_guard = game_state.lock().await;
    if let Some(ref game) = *game_guard {
        let response = NetworkMessage::HandshakeResponse {
            success: true,
            game_state: Some(game.clone()),
            error: None,
        };
        let json = serde_json::to_string(&response)?;
        write.send(Message::Text(json)).await?;
    }
    drop(game_guard);

    // Message loop
    while let Some(msg) = read.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                match serde_json::from_str::<NetworkMessage>(&text) {
                    Ok(message) => {
                        if let Err(e) = handle_message(message, &mut write, &game_state).await {
                            log::error!("Error handling message: {}", e);
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to parse message: {}", e);
                    }
                }
            }
            Ok(Message::Close(_)) => {
                log::info!("Client {} disconnected", addr);
                break;
            }
            Err(e) => {
                log::error!("WebSocket error from {}: {}", addr, e);
                break;
            }
            _ => {} // Ignore other message types
        }
    }

    log::info!("Connection with {} closed", addr);
    Ok(())
}

/// Handle incoming message from client
async fn handle_message(
    msg: NetworkMessage,
    write: &mut tokio_tungstenite::tungstenite::protocol::WriteHalf<'_>,
    game_state: &Arc<Mutex<Option<Game>>>,
) -> Result<(), Box<dyn std::error::Error>> {
    match msg {
        NetworkMessage::Handshake { player_name, player_num } => {
            log::info!("Handshake from {} (player {})", player_name, player_num);

            // Send response with current game state
            let game_guard = game_state.lock().await;
            let response = if let Some(ref game) = *game_guard {
                NetworkMessage::HandshakeResponse {
                    success: true,
                    game_state: Some(game.clone()),
                    error: None,
                }
            } else {
                NetworkMessage::HandshakeResponse {
                    success: false,
                    game_state: None,
                    error: Some("No game state available".to_string()),
                }
            };
            drop(game_guard);

            let json = serde_json::to_string(&response)?;
            write.send(Message::Text(json)).await?;
        }

        NetworkMessage::GameStateRequest => {
            log::info!("Client requested full game state");

            let game_guard = game_state.lock().await;
            if let Some(ref game) = *game_guard {
                let checksum = compute_checksum(game);
                let update = NetworkMessage::GameStateUpdate {
                    game: game.clone(),
                    checksum,
                };
                let json = serde_json::to_string(&update)?;
                write.send(Message::Text(json)).await?;
            }
        }

        NetworkMessage::ReadyToAdvance { player_num } => {
            log::info!("Player {} is ready to advance day", player_num);
            // TODO: Forward to game logic
        }

        NetworkMessage::PlayerAction { player_num, action } => {
            log::info!("Player {} sent action: {:?}", player_num, action);
            // TODO: Forward action to game logic
        }

        NetworkMessage::Ping { timestamp } => {
            let pong = NetworkMessage::Pong { timestamp };
            let json = serde_json::to_string(&pong)?;
            write.send(Message::Text(json)).await?;
        }

        NetworkMessage::Disconnect { reason } => {
            log::info!("Client disconnected: {}", reason);
        }

        _ => {
            log::warn!("Unhandled message type");
        }
    }

    Ok(())
}
