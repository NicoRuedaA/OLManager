//! Multiplayer State for Tauri
//!
//! Holds WebSocket server/client instances for MVP.

use crate::network::websocket_server::WebSocketServer;
use crate::network::websocket_client::WebSocketClient;

/// Multiplayer state managed by Tauri
pub struct MultiplayerState {
    pub server: Option<WebSocketServer>,
    pub client: Option<WebSocketClient>,
    pub is_host: bool,
}

impl Default for MultiplayerState {
    fn default() -> Self {
        Self {
            server: None,
            client: None,
            is_host: false,
        }
    }
}

impl MultiplayerState {
    /// Set as host with WebSocket server
    pub fn set_host(&mut self, server: WebSocketServer) {
        self.server = Some(server);
        self.is_host = true;
    }

    /// Set as client with WebSocket client
    pub fn set_client(&mut self, client: WebSocketClient) {
        self.client = Some(client);
        self.is_host = false;
    }

    /// Check if connected (host or client)
    pub fn is_connected(&self) -> bool {
        if self.is_host {
            self.server.as_ref().map_or(false, |s| {
                // TODO: Add is_running() to WebSocketServer
                true // For now, assume running if exists
            })
        } else {
            self.client.as_ref().map_or(false, |c| c.is_connected())
        }
    }

    /// Get mutable server reference
    pub fn server_mut(&mut self) -> Option<&mut WebSocketServer> {
        self.server.as_mut()
    }

    /// Get mutable client reference
    pub fn client_mut(&mut self) -> Option<&mut WebSocketClient> {
        self.client.as_mut()
    }

    /// Clear state (disconnect)
    pub fn clear(&mut self) {
        self.server = None;
        self.client = None;
        self.is_host = false;
    }
}
