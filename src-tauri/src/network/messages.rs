//! Network message definitions for MVP WebSocket protocol
//!
//! All messages are JSON-encoded and sent over WebSocket.

use serde::{Deserialize, Serialize};
use ofm_core::game::Game;

/// Main message enum - all messages flow through WebSocket
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum NetworkMessage {
    // Connection handshake
    Handshake {
        player_name: String,
        player_num: u8, // 1 = Host, 2 = Client
    },
    HandshakeResponse {
        success: bool,
        game_state: Option<Game>, // Host sends initial state to Client
        error: Option<String>,
    },

    // Game State Sync (Host → Client)
    GameStateUpdate {
        game: Game,
        checksum: u64, // For verification
    },
    GameStateRequest, // Client → Host (request full sync)

    // Day Advancement
    ReadyToAdvance { player_num: u8 }, // Both → Host
    DayAdvanced { new_day: u32 },    // Host → Client

    // Player Actions (Client → Host)
    PlayerAction {
        player_num: u8,
        action: PlayerActionType,
    },

    // Connection Status
    Ping { timestamp: u64 },
    Pong { timestamp: u64 },
    Disconnect { reason: String },
}

/// Player actions that can be sent over network
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action")]
pub enum PlayerActionType {
    // Team management
    SetFormation { formation: String },
    SetStartingXi { player_ids: Vec<String> },
    SetPlayStyle { style: String },
    SetLolTactics { tactics: serde_json::Value },
    
    // Transfers
    ToggleTransferList { player_id: String },
    ToggleLoanList { player_id: String },
    MakeTransferBid { player_id: String, amount: u64 },
    ProposeRenewal { player_id: String },
    ReleasePlayerContract { player_id: String },
    RespondToOffer { offer_id: String, response: String },
    CounterOffer { offer_id: String, amount: u64 },
    
    // Staff
    HireStaff { staff_id: String },
    ReleaseStaff { staff_id: String },
    
    // Training
    SetTraining { training_type: String },
    SetTrainingSchedule { schedule: serde_json::Value },
    SetTrainingGroups { groups: serde_json::Value },
    SetWeeklyScrims { enabled: bool },
    SetPlayerTrainingFocus { player_id: String, focus: String },
    
    // Academy
    PromoteAcademyPlayer { player_id: String },
    DemoteMainPlayerToAcademy { player_id: String },
    
    // Match
    ApplyMatchCommand { command: serde_json::Value },
    RecordFixtureChampionPicks { picks: serde_json::Value },
    
    // Other
    SetChampionTrainingTarget { player_id: String, champ_id: String },
    StartPotentialResearch,
    RerollPlayerLolRole,
    UpgradeFacility { facility_type: String },
    UpgradeMainFacilityModule { module_type: String },
    ExpandMainFacilityHub,
    ApplyTeamTalk { talk_type: String },
    SubmitPressConference { answers: serde_json::Value },
}

/// Connection status for UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStatus {
    pub connected: bool,
    pub is_host: bool,
    pub peer_name: Option<String>,
    pub last_error: Option<String>,
}

/// Helper to compute checksum of game state
pub fn compute_checksum(game: &Game) -> u64 {
    use std::hash::{Hash, Hasher};
    use std::collections::hash_map::DefaultHasher;
    
    let mut hasher = DefaultHasher::new();
    // Hash key fields that should match between host and client
    game.clock.hash(&mut hasher);
    // Add more fields as needed for verification
    hasher.finish()
}
