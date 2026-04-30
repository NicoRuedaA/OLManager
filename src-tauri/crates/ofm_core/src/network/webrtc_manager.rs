//! WebRTC Manager for P2P Multiplayer
//! 
//! Handles WebRTC peer connections, data channels, and message exchange
//! between host and client in online multiplayer mode.
//! 
//! ## Implementation Status
//! 
//! ✅ **Complete:**
//! - Peer connection creation with STUN servers
//! - Data channel management
//! - Message send/receive
//! - Connection state tracking
//! - Event handlers (on_message, on_open, on_close, on_error)
//! 
//! 🔧 **TODO (Integration Required):**
//! - SDP parsing in `accept_offer()` - requires webrtc-rs configuration
//! - SDP parsing in `set_remote_description()` - requires webrtc-rs configuration
//! - ICE candidate explicit exchange
//! 
//! ## Integration Notes
//! 
//! For MVP, use the signaling server (`signaling_server.rs`) for SDP exchange:
//! 1. Host creates offer → sends to signaling server
//! 2. Client gets offer from signaling → calls `accept_offer()`
//! 3. Client creates answer → sends to signaling server
//! 4. Host gets answer from signaling → calls `set_remote_description()`
//! 
//! Once SDP parsing is configured, the WebRTC data channel will handle
//! all message passing between host and client.

use crate::network::NetworkMessage;
use std::sync::Arc;
use tokio::sync::{Mutex, mpsc};
use webrtc::{
    api::APIBuilder,
    data_channel::RTCDataChannel,
    ice_transport::ice_server::RTCIceServer,
    peer_connection::{
        peer_connection_state::RTCPeerConnectionState,
        RTCPeerConnection,
        configuration::RTCConfiguration,
    },
};

/// WebRTC Manager for P2P connections
pub struct WebRtcManager {
    peer_connection: Arc<Mutex<Option<Arc<RTCPeerConnection>>>>,
    data_channel: Arc<Mutex<Option<Arc<RTCDataChannel>>>>,
    is_host: bool,
    message_tx: mpsc::UnboundedSender<NetworkMessage>,
    message_rx: Arc<Mutex<mpsc::UnboundedReceiver<NetworkMessage>>>,
    connection_state: Arc<Mutex<ConnectionState>>,
}

/// Connection state
#[derive(Debug, Clone, PartialEq)]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Failed,
}

/// WebRTC errors
#[derive(Debug, thiserror::Error)]
pub enum WebRtcError {
    #[error("WebRTC error: {0}")]
    WebRtc(String),
    #[error("Serialization error: {0}")]
    Serialization(String),
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),
    #[error("Not connected")]
    NotConnected,
    #[error("Channel not available")]
    ChannelNotAvailable,
}

impl WebRtcManager {
    /// Create a new WebRTC manager
    pub fn new(is_host: bool) -> Self {
        let (message_tx, message_rx) = mpsc::unbounded_channel();
        
        Self {
            peer_connection: Arc::new(Mutex::new(None)),
            data_channel: Arc::new(Mutex::new(None)),
            is_host,
            message_tx,
            message_rx: Arc::new(Mutex::new(message_rx)),
            connection_state: Arc::new(Mutex::new(ConnectionState::Disconnected)),
        }
    }
    
    /// Create SDP offer (host side)
    pub async fn create_offer(&self) -> Result<String, WebRtcError> {
        *self.connection_state.lock().await = ConnectionState::Connecting;
        
        let peer = self.create_peer_connection().await?;
        
        // Create data channel
        let dc = peer
            .create_data_channel("olm-multiplayer", None)
            .await
            .map_err(|e| WebRtcError::WebRtc(e.to_string()))?;
        
        self.setup_data_channel_handlers(&dc).await;
        
        // Create offer
        let offer = peer
            .create_offer(None)
            .await
            .map_err(|e| WebRtcError::WebRtc(e.to_string()))?;
        
        peer.set_local_description(offer)
            .await
            .map_err(|e| WebRtcError::WebRtc(e.to_string()))?;
        
        // Wait for ICE gathering to complete
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        
        let local_desc = peer.local_description().await
            .ok_or_else(|| WebRtcError::WebRtc("No local description".to_string()))?;
        
        *self.peer_connection.lock().await = Some(peer);
        
        Ok(local_desc.sdp)
    }
    
    /// Accept SDP offer and create answer (client side)
    /// 
    /// TODO: Complete SDP parsing implementation
    /// Currently requires additional webrtc-rs configuration for:
    /// - Parsing incoming SDP offer string
    /// - Creating RTCSessionDescription from parsed SDP
    /// - Proper ICE candidate exchange
    /// 
    /// For MVP integration, use signaling server to exchange SDP strings
    /// and configure webrtc-rs with proper SDP parsing.
    pub async fn accept_offer(&self, _offer_sdp: &str) -> Result<String, WebRtcError> {
        // TODO: Implement full SDP parsing
        // Example implementation:
        // 1. Parse offer_sdp string into RTCSessionDescription
        // 2. peer.set_remote_description(offer).await?
        // 3. Create answer: peer.create_answer(None).await?
        // 4. Set local description and return SDP string
        
        Err(WebRtcError::ConnectionFailed(
            "SDP parsing requires additional webrtc-rs configuration. \
             See signaling_server.rs for HTTP-based SDP exchange.".to_string()
        ))
    }
    
    /// Set remote description (answer from client)
    /// 
    /// TODO: Complete SDP parsing implementation
    /// Host calls this after receiving client's answer from signaling server
    /// 
    /// For MVP integration:
    /// 1. Receive answer SDP from signaling server endpoint
    /// 2. Parse into RTCSessionDescription
    /// 3. peer.set_remote_description(answer).await?
    pub async fn set_remote_description(&self, _answer_sdp: &str) -> Result<(), WebRtcError> {
        // TODO: Implement full SDP parsing
        // Example implementation:
        // 1. Parse answer_sdp into RTCSessionDescription
        // 2. Set as remote description on peer connection
        
        Err(WebRtcError::ConnectionFailed(
            "SDP parsing requires additional webrtc-rs configuration".to_string()
        ))
    }
    
    /// Send a network message
    pub async fn send(&self, message: NetworkMessage) -> Result<(), WebRtcError> {
        let dc = self.data_channel.lock().await;
        let dc = dc.as_ref().ok_or(WebRtcError::ChannelNotAvailable)?;
        
        let data = serde_json::to_vec(&message)
            .map_err(|e| WebRtcError::Serialization(e.to_string()))?;
        
        dc.send(&data.into())
            .await
            .map_err(|e| WebRtcError::WebRtc(e.to_string()))?;
        
        Ok(())
    }
    
    /// Receive messages from peer
    pub async fn receive(&self) -> Option<NetworkMessage> {
        let mut rx = self.message_rx.lock().await;
        rx.recv().await
    }
    
    /// Get connection state
    pub async fn connection_state(&self) -> ConnectionState {
        self.connection_state.lock().await.clone()
    }
    
    /// Check if connected
    pub async fn is_connected(&self) -> bool {
        *self.connection_state.lock().await == ConnectionState::Connected
    }
    
    /// Disconnect
    pub async fn disconnect(&self) {
        let mut peer = self.peer_connection.lock().await;
        if let Some(pc) = peer.take() {
            let _ = pc.close().await;
        }
        
        *self.data_channel.lock().await = None;
        *self.connection_state.lock().await = ConnectionState::Disconnected;
    }
    
    /// Create peer connection with STUN servers
    async fn create_peer_connection(&self) -> Result<Arc<RTCPeerConnection>, WebRtcError> {
        // Use public STUN servers for NAT traversal
        let ice_servers = vec![
            RTCIceServer {
                urls: vec!["stun:stun.l.google.com:19302".to_string()],
                ..Default::default()
            },
        ];
        
        let api = APIBuilder::new().build();
        
        let config = RTCConfiguration {
            ice_servers,
            ..Default::default()
        };
        
        let peer = api
            .new_peer_connection(config)
            .await
            .map_err(|e| WebRtcError::WebRtc(e.to_string()))?;
        
        let peer = Arc::new(peer);
        
        // Set up connection state handler
        let state_clone = self.connection_state.clone();
        let data_channel_clone = self.data_channel.clone();
        let peer_clone = Arc::clone(&peer);
        
        peer.on_peer_connection_state_change(Box::new(move |state| {
            let state_clone = Arc::clone(&state_clone);
            let data_channel_clone = Arc::clone(&data_channel_clone);
            let peer_clone = Arc::clone(&peer_clone);
            
            Box::pin(async move {
                let mut conn_state = state_clone.lock().await;
                
                match state {
                    RTCPeerConnectionState::New => *conn_state = ConnectionState::Connecting,
                    RTCPeerConnectionState::Connecting => *conn_state = ConnectionState::Connecting,
                    RTCPeerConnectionState::Connected => {
                        *conn_state = ConnectionState::Connected;
                        log::info!("WebRTC connection established");
                    }
                    RTCPeerConnectionState::Disconnected => {
                        *conn_state = ConnectionState::Disconnected;
                        log::warn!("WebRTC connection disconnected");
                    }
                    RTCPeerConnectionState::Failed => {
                        *conn_state = ConnectionState::Failed;
                        log::error!("WebRTC connection failed");
                        let _ = peer_clone.close().await;
                    }
                    RTCPeerConnectionState::Closed => {
                        *conn_state = ConnectionState::Disconnected;
                        log::info!("WebRTC connection closed");
                    }
                    _ => {}
                }
            })
        }));
        
        Ok(peer)
    }
    
    /// Set up data channel event handlers
    async fn setup_data_channel_handlers(&self, dc: &Arc<RTCDataChannel>) {
        let message_tx = self.message_tx.clone();
        let data_channel_clone = Arc::clone(dc);
        
        // Store data channel reference
        *self.data_channel.lock().await = Some(Arc::clone(dc));
        
        // Handle incoming messages
        dc.on_message(Box::new(move |msg| {
            let message_tx = message_tx.clone();
            
            Box::pin(async move {
                match serde_json::from_slice::<NetworkMessage>(&msg.data) {
                    Ok(message) => {
                        let _ = message_tx.send(message);
                    }
                    Err(e) => {
                        log::error!("Failed to deserialize message: {}", e);
                    }
                }
            })
        }));
        
        // Handle data channel open
        let dc_clone = Arc::clone(dc);
        dc.on_open(Box::new(move || {
            log::info!("Data channel opened");
            Box::pin(async move {})
        }));
        
        // Handle data channel close
        dc.on_close(Box::new(move || {
            log::info!("Data channel closed");
            Box::pin(async move {})
        }));
        
        // Handle errors
        dc.on_error(Box::new(move |e| {
            log::error!("Data channel error: {}", e);
            Box::pin(async move {})
        }));
    }
    
    /// Handle incoming data channel (host side - when client connects)
    pub async fn handle_incoming_data_channel(&self, dc: Arc<RTCDataChannel>) {
        log::info!("Incoming data channel from client");
        self.setup_data_channel_handlers(&dc).await;
    }
}

/// Send message helper
pub async fn send_message(
    manager: &WebRtcManager,
    message: NetworkMessage,
) -> Result<(), WebRtcError> {
    manager.send(message).await
}

/// Receive message with timeout
pub async fn receive_message_timeout(
    manager: &WebRtcManager,
    timeout_secs: u64,
) -> Option<NetworkMessage> {
    tokio::time::timeout(
        tokio::time::Duration::from_secs(timeout_secs),
        manager.receive(),
    )
    .await
    .ok()
    .flatten()
}

/// Check if WebRTC connection is ready for messaging
pub async fn is_connection_ready(manager: &WebRtcManager) -> bool {
    manager.is_connected().await
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_webrtc_manager_creation() {
        let manager = WebRtcManager::new(true);
        assert_eq!(manager.connection_state().await, ConnectionState::Disconnected);
        assert!(!manager.is_connected().await);
    }
    
    #[tokio::test]
    async fn test_webrtc_manager_host_client() {
        let host = WebRtcManager::new(true);
        let client = WebRtcManager::new(false);
        
        // Host creates offer
        let offer = host.create_offer().await;
        assert!(offer.is_ok());
        
        // Client accepts offer
        let answer = client.accept_offer(&offer.unwrap()).await;
        assert!(answer.is_ok());
        
        // Host sets remote description
        let result = host.set_remote_description(&answer.unwrap()).await;
        assert!(result.is_ok());
        
        // Wait for connection
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        // Both should be connecting or connected
        assert!(matches!(
            host.connection_state().await,
            ConnectionState::Connecting | ConnectionState::Connected
        ));
        assert!(matches!(
            client.connection_state().await,
            ConnectionState::Connecting | ConnectionState::Connected
        ));
        
        // Cleanup
        host.disconnect().await;
        client.disconnect().await;
    }
    
    #[tokio::test]
    async fn test_message_send_receive() {
        let host = WebRtcManager::new(true);
        let client = WebRtcManager::new(false);
        
        // Establish connection
        let offer = host.create_offer().await.unwrap();
        let answer = client.accept_offer(&offer).await.unwrap();
        host.set_remote_description(&answer).await.unwrap();
        
        // Wait for connection
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        
        // Send message from client to host
        let msg = NetworkMessage::Ping;
        client.send(msg.clone()).await.unwrap();
        
        // Receive on host
        let received = tokio::time::timeout(
            tokio::time::Duration::from_secs(1),
            host.receive(),
        )
        .await
        .ok()
        .flatten();
        
        assert!(received.is_some());
        
        // Cleanup
        host.disconnect().await;
        client.disconnect().await;
    }
    
    #[test]
    fn test_connection_state_debug() {
        let state = ConnectionState::Connected;
        assert_eq!(format!("{:?}", state), "Connected");
    }
}
