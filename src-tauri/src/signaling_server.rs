//! Signaling Server for Online Multiplayer
//! 
//! Simple HTTP server for WebRTC SDP exchange.
//! Stateless and minimal - only used for initial handshake.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::Arc,
};
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};

/// Shared state for all rooms
#[derive(Clone, Default)]
pub struct SignalingState {
    rooms: Arc<Mutex<HashMap<String, Room>>>,
}

/// Room information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Room {
    pub room_code: String,
    pub host_sdp: Option<String>,
    pub client_sdp: Option<String>,
    pub host_ice_candidates: Vec<String>,
    pub client_ice_candidates: Vec<String>,
    pub created_at: u64,
    pub last_activity: u64,
    pub status: RoomStatus,
}

/// Room status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RoomStatus {
    Waiting,      // Host created, waiting for client
    Connecting,   // Client joined, exchanging SDP
    Connected,    // WebRTC connection established
    Expired,      // Room expired (no activity)
}

/// Request/Response types
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateRoomRequest {
    pub host_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateRoomResponse {
    pub room_code: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JoinRoomRequest {
    pub client_name: String,
    pub client_sdp: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JoinRoomResponse {
    pub success: bool,
    pub host_sdp: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RoomStatusResponse {
    pub room_code: String,
    pub status: String,
    pub host_name: Option<String>,
    pub client_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IceCandidateRequest {
    pub candidate: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IceCandidateResponse {
    pub success: bool,
    pub candidates: Vec<String>,
}

/// Generate a 6-character room code
fn generate_room_code() -> String {
    use rand::{Rng, RngExt};
    const CHARSET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I, O, 0, 1 (confusing)
    let mut rng = rand::rng();
    (0..6)
        .map(|_| {
            let idx = rng.random_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

/// Get current timestamp in seconds
fn now_secs() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

/// Create a new room
#[axum::debug_handler]
async fn create_room(
    State(state): State<SignalingState>,
    Json(payload): Json<CreateRoomRequest>,
) -> Json<CreateRoomResponse> {
    let room_code = generate_room_code();
    let now = now_secs();
    
    let room = Room {
        room_code: room_code.clone(),
        host_sdp: None,
        client_sdp: None,
        host_ice_candidates: vec![],
        client_ice_candidates: vec![],
        created_at: now,
        last_activity: now,
        status: RoomStatus::Waiting,
    };
    
    let mut rooms = state.rooms.lock().await;
    rooms.insert(room_code.clone(), room);
    
    log::info!("Created room {} for host {}", room_code, payload.host_name);
    
    Json(CreateRoomResponse {
        room_code,
        status: "waiting".to_string(),
    })
}

/// Get room status
#[axum::debug_handler]
async fn get_room_status(
    State(state): State<SignalingState>,
    Path(room_code): Path<String>,
) -> Result<Json<RoomStatusResponse>, StatusCode> {
    let rooms = state.rooms.lock().await;
    
    match rooms.get(&room_code) {
        Some(room) => Ok(Json(RoomStatusResponse {
            room_code: room.room_code.clone(),
            status: format!("{:?}", room.status).to_lowercase(),
            host_name: None, // Could store host_name if needed
            client_name: None,
        })),
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// Join an existing room (client)
#[axum::debug_handler]
async fn join_room(
    State(state): State<SignalingState>,
    Path(room_code): Path<String>,
    Json(payload): Json<JoinRoomRequest>,
) -> Result<Json<JoinRoomResponse>, StatusCode> {
    let mut rooms = state.rooms.lock().await;
    
    let room = match rooms.get_mut(&room_code) {
        Some(room) => room,
        None => {
            return Ok(Json(JoinRoomResponse {
                success: false,
                host_sdp: None,
                error: Some("Room not found".to_string()),
            }));
        }
    };
    
    // Check if room is available
    if room.status != RoomStatus::Waiting {
        return Ok(Json(JoinRoomResponse {
            success: false,
            host_sdp: None,
            error: Some("Room is not available".to_string()),
        }));
    }
    
    // Update room with client SDP
    room.client_sdp = Some(payload.client_sdp);
    room.status = RoomStatus::Connecting;
    room.last_activity = now_secs();
    
    let host_sdp = room.host_sdp.clone();
    
    log::info!("Client joined room {}", room_code);
    
    Ok(Json(JoinRoomResponse {
        success: true,
        host_sdp,
        error: None,
    }))
}

/// Host sends SDP offer
#[axum::debug_handler]
async fn host_send_sdp(
    State(state): State<SignalingState>,
    Path(room_code): Path<String>,
    Json(payload): Json<IceCandidateRequest>,
) -> Result<Json<IceCandidateResponse>, StatusCode> {
    let mut rooms = state.rooms.lock().await;
    
    let room = match rooms.get_mut(&room_code) {
        Some(room) => room,
        None => return Err(StatusCode::NOT_FOUND),
    };
    
    room.host_sdp = Some(payload.candidate);
    room.last_activity = now_secs();
    
    log::info!("Host sent SDP for room {}", room_code);
    
    Ok(Json(IceCandidateResponse {
        success: true,
        candidates: room.client_ice_candidates.clone(),
    }))
}

/// Client sends SDP answer
#[axum::debug_handler]
async fn client_send_sdp(
    State(state): State<SignalingState>,
    Path(room_code): Path<String>,
    Json(payload): Json<IceCandidateRequest>,
) -> Result<Json<IceCandidateResponse>, StatusCode> {
    let mut rooms = state.rooms.lock().await;
    
    let room = match rooms.get_mut(&room_code) {
        Some(room) => room,
        None => return Err(StatusCode::NOT_FOUND),
    };
    
    room.client_sdp = Some(payload.candidate.clone());
    room.status = RoomStatus::Connected;
    room.last_activity = now_secs();
    
    log::info!("Client sent SDP answer for room {} - connection established", room_code);
    
    Ok(Json(IceCandidateResponse {
        success: true,
        candidates: room.host_ice_candidates.clone(),
    }))
}

/// Get pending ICE candidates
#[axum::debug_handler]
async fn get_ice_candidates(
    State(state): State<SignalingState>,
    Path(room_code): Path<String>,
) -> Result<Json<IceCandidateResponse>, StatusCode> {
    let rooms = state.rooms.lock().await;
    
    let room = match rooms.get(&room_code) {
        Some(room) => room,
        None => return Err(StatusCode::NOT_FOUND),
    };
    
    Ok(Json(IceCandidateResponse {
        success: true,
        candidates: room.host_ice_candidates.clone(),
    }))
}

/// Cleanup expired rooms (run periodically)
async fn cleanup_expired_rooms(state: SignalingState) {
    let mut rooms = state.rooms.lock().await;
    let now = now_secs();
    let expiry_secs = 300; // 5 minutes
    
    let mut expired = Vec::new();
    
    for (code, room) in rooms.iter() {
        if now - room.last_activity > expiry_secs {
            expired.push(code.clone());
        }
    }
    
    for code in expired {
        rooms.remove(&code);
        log::info!("Cleaned up expired room {}", code);
    }
}

/// Create the signaling server router
pub fn create_router() -> Router {
    let state = SignalingState::default();
    
    // Start cleanup task
    let cleanup_state = state.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
            cleanup_expired_rooms(cleanup_state.clone()).await;
        }
    });
    
    // CORS for browser access (if needed)
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);
    
    Router::new()
        .route("/room", post(create_room))
        .route("/room/:code", get(get_room_status))
        .route("/room/:code/join", post(join_room))
        .route("/room/:code/host/sdp", post(host_send_sdp))
        .route("/room/:code/client/sdp", post(client_send_sdp))
        .route("/room/:code/ice", get(get_ice_candidates))
        .with_state(state)
        .layer(cors)
}

/// Start the signaling server
pub async fn run_server(port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let app = create_router();
    
    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    log::info!("Starting signaling server on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_generate_room_code() {
        let code1 = generate_room_code();
        let code2 = generate_room_code();
        
        // Should be 6 characters
        assert_eq!(code1.len(), 6);
        assert_eq!(code2.len(), 6);
        
        // Should be different
        assert_ne!(code1, code2);
        
        // Should only contain valid characters
        for c in code1.chars() {
            assert!(c.is_ascii_alphanumeric());
            assert!(!['I', 'O', '0', '1'].contains(&c));
        }
    }
    
    #[test]
    fn test_room_code_format() {
        // Generate multiple codes and verify format
        for _ in 0..100 {
            let code = generate_room_code();
            assert_eq!(code.len(), 6);
            assert!(code.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()));
        }
    }
}
