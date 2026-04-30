//! WebSocket Client for MVP (Client connects to Host)
//!
//! Connects to ws://host-ip:3000 and communicates via JSON messages.

use tokio_tungstenite::{connect_async, tungstenite::Message};
use tokio_tungstenite::tungstenite::protocol::WebSocketStream;
use tokio::net::TcpStream;
use serde_json;
use crate::network::messages::NetworkMessage;
use std::net::SocketAddr;

/// WebSocket client state
pub struct WebSocketClient {
    ws_stream: Option<WebSocketStream<TcpStream>>,
    connected: bool,
    host_addr: Option<SocketAddr>,
}

impl WebSocketClient {
    /// Create new client (not connected yet)
    pub fn new() -> Self {
        Self {
            ws_stream: None,
            connected: false,
            host_addr: None,
        }
    }

    /// Connect to Host's WebSocket server
    pub async fn connect(&mut self, host_ip: &str, port: u16) -> Result<(), String> {
        let addr = format!("{}:{}", host_ip, port);
        
        log::info!("Connecting to Host at {}", addr);

        // Parse address
        let socket_addr: SocketAddr = addr
            .parse()
            .map_err(|e| format!("Invalid address {}: {}", addr, e))?;

        self.host_addr = Some(socket_addr);

        // Connect TCP first
        let tcp_stream = tokio::net::TcpStream::connect(socket_addr)
            .await
            .map_err(|e| format!("TCP connection failed: {}", e))?;

        // Upgrade to WebSocket
        let (ws_stream, _) = connect_async("ws://placeholder")
            .use_context(tcp_stream)
            .await
            .map_err(|e| format!("WebSocket handshake failed: {}", e))?;

        self.ws_stream = Some(ws_stream);
        self.connected = true;

        log::info!("Connected to Host at {}", addr);

        Ok(())
    }

    /// Send message to Host
    pub async fn send(&mut self, message: &NetworkMessage) -> Result<(), String> {
        if !self.connected {
            return Err("Not connected to Host".to_string());
        }

        let json = serde_json::to_string(message)
            .map_err(|e| format!("Serialization error: {}", e))?;

        if let Some(ref mut ws) = self.ws_stream {
            ws.send(Message::Text(json))
                .await
                .map_err(|e| format!("Failed to send message: {}", e))?;
            Ok(())
        } else {
            Err("WebSocket stream not available".to_string())
        }
    }

    /// Receive message from Host
    pub async fn receive(&mut self) -> Result<Option<NetworkMessage>, String> {
        if let Some(ref mut ws) = self.ws_stream {
            match ws.next().await {
                Some(Ok(Message::Text(text))) => {
                    let msg: NetworkMessage = serde_json::from_str(&text)
                        .map_err(|e| format!("Parse error: {}", e))?;
                    Ok(Some(msg))
                }
                Some(Ok(Message::Close(_))) => {
                    self.connected = false;
                    Ok(None)
                }
                Some(Err(e)) => {
                    self.connected = false;
                    Err(format!("WebSocket error: {}", e))
                }
                _ => Ok(None), // Other message types
            }
        } else {
            Err("WebSocket stream not available".to_string())
        }
    }

    /// Check if connected
    pub fn is_connected(&self) -> bool {
        self.connected
    }

    /// Disconnect from Host
    pub async fn disconnect(&mut self, reason: &str) {
        if let Some(ref mut ws) = self.ws_stream {
            let msg = NetworkMessage::Disconnect {
                reason: reason.to_string(),
            };
            if let Ok(json) = serde_json::to_string(&msg) {
                let _ = ws.send(Message::Text(json)).await;
                let _ = ws.close(None).await;
            }
        }
        self.connected = false;
        log::info!("Disconnected from Host: {}", reason);
    }
}
