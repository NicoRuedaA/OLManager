//! Network messaging for online multiplayer mode.
//!
//! This module defines the protocol for communication between host and client
//! in P2P online multiplayer games.

use crate::game::Game;
use serde::{Deserialize, Serialize};

/// Unique request ID for tracking action confirmations
pub type RequestId = String;

/// Network message protocol for P2P communication
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum NetworkMessage {
    // ========== Connection & Handshake ==========
    /// Initial handshake request from client to host
    HandshakeRequest {
        room_code: String,
        client_name: String,
    },

    /// Handshake response from host to client
    HandshakeResponse {
        success: bool,
        error: Option<String>,
        game_state_summary: Option<GameStateSummary>,
    },

    /// Connection established confirmation
    ConnectionEstablished { host_name: String, game_id: String },

    // ========== Game State Synchronization ==========
    /// Request full game state (client → host)
    GameStateRequest,

    /// Full game state update (host → client)
    GameStateUpdate {
        game: Game,
        checksum: String,
        timestamp: u64,
    },

    /// Periodic sync ping (host → client)
    SyncPing { timestamp: u64, checksum: String },

    /// Sync pong response (client → host)
    SyncPong {
        timestamp: u64,
        checksum_valid: bool,
    },

    // ========== Day Advancement ==========
    /// Player marks their day as ready (client → host)
    ReadyToAdvance { player_num: u8, timestamp: u64 },

    /// Day is advancing, wait for new state (host → client)
    DayAdvancing { current_day: u32 },

    /// Day advanced successfully, here's new state (host → client)
    DayAdvanced {
        new_day: u32,
        game: Game,
        checksum: String,
    },

    /// Waiting for opponent to be ready (host → client)
    WaitingForOpponent {
        your_player_num: u8,
        opponent_ready: bool,
    },

    // ========== Player Actions (client → host) ==========
    /// Player action request
    PlayerAction {
        player_num: u8,
        action: PlayerActionType,
        request_id: RequestId,
        timestamp: u64,
    },

    /// Action confirmed and applied (host → client)
    ActionConfirmed {
        game: Game,
        request_id: RequestId,
        checksum: String,
    },

    /// Action rejected (host → client)
    ActionRejected {
        reason: String,
        request_id: RequestId,
    },

    // ========== Match Handling ==========
    /// PvP match ready confirmation
    MatchReady { player_num: u8, fixture_id: String },

    /// Start PvP match simulation
    MatchStarting {
        fixture_id: String,
        home_team_id: String,
        away_team_id: String,
    },

    /// Match result (host → client)
    MatchComplete {
        fixture_id: String,
        home_score: u32,
        away_score: u32,
        match_report: String,
    },

    // ========== Connection Management ==========
    /// Keep-alive ping
    Ping,

    /// Keep-alive pong response
    Pong,

    /// Graceful disconnect notification
    Disconnect,

    /// Reconnection request (client → host)
    ReconnectRequest { player_num: u8, last_known_day: u32 },

    /// Reconnection response
    ReconnectResponse {
        success: bool,
        game: Option<Game>,
        error: Option<String>,
    },

    /// Error message
    Error { code: String, message: String },
}

/// Summary of game state for handshake (lightweight)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameStateSummary {
    pub current_day: u32,
    pub start_date: String,
    pub manager_names: Vec<String>,
    pub team_names: Vec<String>,
}

/// Player action types that can be sent over network
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action")]
pub enum PlayerActionType {
    // Squad Management
    SetFormation {
        formation: String,
    },
    SetStartingXi {
        player_ids: Vec<String>,
    },
    SetSubstitutes {
        player_ids: Vec<String>,
    },
    SetPlayStyle {
        play_style: String,
    },
    SetLolTactics {
        tactics: String,
    },
    SetTrainingFocus {
        training_focus: String,
    },

    // Transfers
    MakeTransferBid {
        player_id: String,
        amount: u64,
    },
    ProposeRenewal {
        player_id: String,
        wage_offer: i64,
        duration_years: u32,
    },
    AcceptTransferOffer {
        player_id: String,
        offer_id: String,
    },
    RejectTransferOffer {
        player_id: String,
        offer_id: String,
    },

    // Staff
    HireStaff {
        staff_id: String,
    },
    ReleaseStaff {
        staff_id: String,
    },

    // Academy
    PromoteAcademyPlayer {
        player_id: String,
    },
    ReleaseAcademyPlayer {
        player_id: String,
    },

    // Player Development
    SetPlayerChampionTarget {
        player_id: String,
        champion_id: String,
    },
    SetPlayerTrainingFocus {
        player_id: String,
        focus: String,
    },

    // Match Commands (live match)
    ApplyMatchCommand {
        command: String,
        data: serde_json::Value,
    },

    // Time Management
    SkipToMatchDay,
}

/// Generate a unique request ID
pub fn generate_request_id() -> RequestId {
    use uuid::Uuid;
    Uuid::new_v4().to_string()
}

/// Compute checksum for game state validation
pub fn compute_checksum(game: &Game) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();

    // Hash critical game state
    game.clock.current_date.hash(&mut hasher);
    game.manager.id.hash(&mut hasher);
    game.manager.team_id.hash(&mut hasher);

    if let Some(ref p2) = game.player2_manager {
        p2.id.hash(&mut hasher);
        p2.team_id.hash(&mut hasher);
    }

    // Hash team states (simplified - just IDs and basic state)
    for team in &game.teams {
        team.id.hash(&mut hasher);
        team.finance.hash(&mut hasher);
        team.starting_xi_ids.hash(&mut hasher);
    }

    format!("{:016x}", hasher.finish())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_message_serialization() {
        let msg = NetworkMessage::Ping;
        let json = serde_json::to_string(&msg).unwrap();
        let loaded: NetworkMessage = serde_json::from_str(&json).unwrap();

        match loaded {
            NetworkMessage::Ping => {}
            _ => panic!("Wrong message type"),
        }
    }

    #[test]
    fn test_action_serialization() {
        let action = PlayerActionType::SetFormation {
            formation: "4-4-2".to_string(),
        };

        let json = serde_json::to_string(&action).unwrap();
        assert!(json.contains("SetFormation"));
        assert!(json.contains("4-4-2"));

        let loaded: PlayerActionType = serde_json::from_str(&json).unwrap();
        match loaded {
            PlayerActionType::SetFormation { formation } => {
                assert_eq!(formation, "4-4-2");
            }
            _ => panic!("Wrong action type"),
        }
    }

    #[test]
    fn test_generate_request_id() {
        let id1 = generate_request_id();
        let id2 = generate_request_id();

        assert_ne!(id1, id2);
        assert_eq!(id1.len(), 36); // UUID format
    }

    #[test]
    fn test_compute_checksum() {
        use crate::clock::GameClock;
        use crate::game::Game;
        use chrono::Utc;
        use domain::manager::Manager;

        // Create two identical games
        let start = Utc::now();
        let clock = GameClock::new(start);
        let mut manager = Manager::new(
            "Test".to_string(),
            "Manager".to_string(),
            "TM".to_string(),
            "ARG".to_string(),
            "2000-01-01".to_string(),
        );
        manager.id = "mgr-1".to_string();
        manager.team_id = Some("team-1".to_string());

        let game1 = Game::new(
            clock.clone(),
            manager.clone(),
            vec![],
            vec![],
            vec![],
            vec![],
        );

        let game2 = Game::new(clock, manager, vec![], vec![], vec![], vec![]);

        // Same state should produce same checksum
        let checksum1 = compute_checksum(&game1);
        let checksum2 = compute_checksum(&game2);
        assert_eq!(checksum1, checksum2);
    }
}
