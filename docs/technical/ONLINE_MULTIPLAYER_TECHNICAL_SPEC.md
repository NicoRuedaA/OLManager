# Online Multiplayer Mode - Technical Specification

**Version**: 1.0  
**Date**: 2026-04-30  
**Status**: Draft  
**Confidence**: High (based on codebase analysis)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Data Model](#3-data-model)
4. [Network Layer](#4-network-layer)
5. [Game Loop Modifications](#5-game-loop-modifications)
6. [Command Layer](#6-command-layer)
7. [Frontend Integration](#7-frontend-integration)
8. [Conflict Resolution](#8-conflict-resolution)
9. [Save/Load System](#9-saveload-system)
10. [Testing Strategy](#10-testing-strategy)
11. [Implementation Checklist](#11-implementation-checklist)
12. [Appendix: Code Analysis](#12-appendix-code-analysis)

---

## 1. Overview

### 1.1 Goal

Implement a 2-player online mode where each player controls a different team in the same game session, maintaining full backward compatibility with single-player mode.

### 1.2 Constraints

- **DO NOT** change `game.manager: Manager` to `Vec<Manager>` (breaks 142+ usages)
- **DO NOT** break existing single-player saves
- **DO NOT** modify game loop without feature flag
- **MUST** be host-authoritative (simplifies sync)
- **MUST** support hotseat (local) and online (P2P) modes

### 1.3 Definitions

| Term | Definition |
|------|------------|
| **Host** | Player who creates the game, owns authoritative state |
| **Client/Joiner** | Player who joins via room code |
| **Hotseat** | Local multiplayer, players take turns on same machine |
| **Online** | Networked P2P via WebRTC |
| **Day Readiness** | Flag indicating player has finished their day actions |
| **PvP Match** | Match between Player 1's team and Player 2's team |

---

## 2. Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         HOST CLIENT                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Frontend   │  │   Backend    │  │    P2P       │          │
│  │   (React)    │◄─┤   (Rust)     │◄─┤   (WebRTC)   │◄────┐    │
│  │              │  │              │  │              │     │    │
│  │  - UI        │  │  - Game      │  │  - Data      │     │    │
│  │  - Player    │  │  - Logic     │  │  - Sync      │     │    │
│  │    Selector  │  │  - Save      │  │  - Messages  │     │    │
│  └──────────────┘  └──────────────┘  └──────────────┘     │    │
│         ▲                 ▲                                 │    │
│         │                 │                                 │    │
│    ┌────┴────┐       ┌────┴────┐                       │    │
│    │ Game    │       │  Game   │                       │    │
│    │ Store   │       │  State  │                       │    │
│    │(Zustand)│       │(Mutex)  │                       │    │
│    └─────────┘       └─────────┘                       │    │
│         ▲                                                  │    │
│         │                                                  │    │
│    ┌────┴─────────────────────────────┐                    │    │
│    │         SAVE SYSTEM              │                    │    │
│    │  (SQLite in app_data_dir/saves)  │                    │    │
│    └──────────────────────────────────┘                    │    │
│                                                            │    │
└────────────────────────────────────────────────────────────┼────┘
                                                             │
                           WebRTC Data Channel               │
                           (Game State Sync)                 │
                           - State updates                   │
                           - Player actions                  │
                           - Ready signals                   │
                                                             │
┌────────────────────────────────────────────────────────────┼────┐
│                        CLIENT (JOINER)                     │    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │    │
│  │   Frontend   │  │   Backend    │  │    P2P       │─────┘    │
│  │   (React)    │◄─┤   (Rust)     │◄─┤   (WebRTC)   │          │
│  │              │  │              │  │              │          │
│  │  - UI        │  │  - Game      │  │  - Data      │          │
│  │  - Player    │  │  - Logic     │  │  - Sync      │          │
│  │    Selector  │  │  - (Read-    │  │  - Messages  │          │
│  └──────────────┘  │    only)     │  └──────────────┘          │
│                    └──────────────┘                            │
│         ▲                                                      │
│         │                                                      │
│    ┌────┴────┐                                            │
│    │ Game    │                                            │
│    │ Store   │                                            │
│    │(Zustand)│                                            │
│    └─────────┘                                            │
│                                                           │
│  (Local backup save for disconnect recovery)              │
│                                                           │
└───────────────────────────────────────────────────────────┘

                        ┌─────────────────┐
                        │ SIGNALING SERVER │
                        │  (Simple HTTP    │
                        │   or WebSocket)  │
                        │                  │
                        │  - POST /room    │
                        │    → {code}      │
                        │  - GET /room/:id │
                        │    → {host_sdp}  │
                        │  - POST /join    │
                        │    → exchange    │
                        └─────────────────┘
```

### 2.2 Design Principles

1. **Host is Authoritative**: Only host runs game logic, client receives state updates
2. **Additive Changes**: New fields with `#[serde(default)]`, no modifications to existing fields
3. **Feature Flag**: Multiplayer behind `MULTIPLAYER` flag, single-player unaffected
4. **Graceful Degradation**: If network fails, client can continue offline with backup save
5. **Minimal Refactoring**: Reuse existing game loop, add multiplayer layer on top

---

## 3. Data Model

### 3.1 Game Struct Modifications

**File**: `crates/ofm_core/src/game.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Game {
    // ========== EXISTING (UNCHANGED) ==========
    pub clock: GameClock,
    pub manager: Manager,
    pub teams: Vec<Team>,
    pub players: Vec<Player>,
    pub staff: Vec<Staff>,
    pub messages: Vec<InboxMessage>,
    pub news: Vec<NewsArticle>,
    pub league: Option<League>,
    pub academy_league: Option<League>,
    pub scouting_assignments: Vec<ScoutingAssignment>,
    pub board_objectives: Vec<BoardObjective>,
    pub season_context: SeasonContext,
    pub days_since_last_job_offer: Option<u32>,
    pub champion_masteries: Vec<ChampionMasteryEntry>,
    pub champion_patch: ChampionPatchState,
    
    // ========== NEW (Multiplayer Support) ==========
    
    /// Second player's manager (None in single-player mode)
    #[serde(default)]
    pub player2_manager: Option<Manager>,
    
    /// Multiplayer mode: offline, hotseat, or online
    #[serde(default)]
    pub multiplayer_mode: MultiplayerMode,
    
    /// Which player's turn it is (1 or 2)
    #[serde(default = "default_current_player")]
    pub current_player: u8,
    
    /// Day readiness flags (reset after each day advance)
    #[serde(default)]
    pub player1_day_ready: bool,
    #[serde(default)]
    pub player2_day_ready: bool,
    
    /// Room code for online mode (None in offline/hotseat)
    #[serde(default)]
    pub room_code: Option<String>,
    
    /// Network state (transient, not persisted in some cases)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub network_state: Option<NetworkState>,
}

fn default_current_player() -> u8 { 1 }

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum MultiplayerMode {
    #[default]
    Offline,
    Hotseat,
    Online,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NetworkState {
    pub is_host: bool,
    pub peer_id: Option<String>,
    pub connection_status: ConnectionStatus,
    pub last_sync_timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum ConnectionStatus {
    #[default]
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Failed,
}
```

### 3.2 Helper Methods

**File**: `crates/ofm_core/src/game.rs` (impl block)

```rust
impl Game {
    /// Get manager for a given player number
    pub fn manager_for_player(&self, player_num: u8) -> Option<&Manager> {
        match player_num {
            1 => Some(&self.manager),
            2 => self.player2_manager.as_ref(),
            _ => None,
        }
    }
    
    /// Get mutable manager for a given player number
    pub fn manager_for_player_mut(&mut self, player_num: u8) -> Option<&mut Manager> {
        match player_num {
            1 => Some(&mut self.manager),
            2 => self.player2_manager.as_mut(),
            _ => None,
        }
    }
    
    /// Get manager by team_id (find which player owns this team)
    pub fn manager_for_team(&self, team_id: &str) -> Option<&Manager> {
        if self.manager.team_id.as_deref() == Some(team_id) {
            Some(&self.manager)
        } else if let Some(p2) = &self.player2_manager {
            if p2.team_id.as_deref() == Some(team_id) {
                return Some(p2);
            }
        }
        None
    }
    
    /// Get team_id for a given player
    pub fn team_id_for_player(&self, player_num: u8) -> Option<String> {
        self.manager_for_player(player_num)
            .and_then(|m| m.team_id.clone())
    }
    
    /// Check if both players are ready to advance day
    pub fn can_advance_day(&self) -> bool {
        match self.multiplayer_mode {
            MultiplayerMode::Offline => true,  // Single player: always ready
            MultiplayerMode::Hotseat | MultiplayerMode::Online => {
                self.player1_day_ready && self.player2_day_ready
            }
        }
    }
    
    /// Mark player as ready and return whether day can advance
    pub fn mark_player_ready(&mut self, player_num: u8) -> bool {
        match player_num {
            1 => self.player1_day_ready = true,
            2 => self.player2_day_ready = true,
            _ => return false,
        }
        self.can_advance_day()
    }
    
    /// Reset readiness after day advance
    pub fn reset_day_readiness(&mut self) {
        self.player1_day_ready = false;
        self.player2_day_ready = false;
    }
    
    /// Switch current player (for hotseat mode)
    pub fn switch_current_player(&mut self) {
        self.current_player = if self.current_player == 1 { 2 } else { 1 };
    }
    
    /// Check if a team belongs to a human player (vs AI)
    pub fn is_human_team(&self, team_id: &str) -> bool {
        self.manager.team_id.as_deref() == Some(team_id)
            || self.player2_manager.as_ref().map(|m| m.team_id.as_deref() == Some(team_id)).unwrap_or(false)
    }
    
    /// Get all human team IDs
    pub fn human_team_ids(&self) -> Vec<String> {
        let mut ids = Vec::new();
        if let Some(id) = &self.manager.team_id {
            ids.push(id.clone());
        }
        if let Some(id) = self.player2_manager.as_ref().and_then(|m| m.team_id.clone()) {
            ids.push(id);
        }
        ids
    }
}
```

### 3.3 Database Schema

**File**: `crates/db/src/sql/v029_multiplayer.sql`

```sql
-- Multiplayer Support
-- Adds fields for 2-player mode

-- Add player2_manager_id to game_meta
ALTER TABLE game_meta ADD COLUMN player2_manager_id TEXT;

-- Add multiplayer_mode to game_meta
ALTER TABLE game_meta ADD COLUMN multiplayer_mode TEXT DEFAULT 'offline';

-- Add room_code (for online mode)
ALTER TABLE game_meta ADD COLUMN room_code TEXT;

-- Note: player1_day_ready and player2_day_ready are runtime-only,
-- not persisted to database (reset each day)
```

**File**: `crates/db/src/migrations.rs`

```rust
const MIGRATIONS: &[&str] = &[
    include_str!("sql/v001_initial_schema.sql"),
    // ... existing migrations ...
    include_str!("sql/v028_avatar_path.sql"),
    include_str!("sql/v029_multiplayer.sql"),  // NEW
];
```

### 3.4 Save/Load Modifications

**File**: `crates/db/src/game_persistence.rs`

```rust
// In GamePersistenceWriter::write_game():

// Save player2_manager if exists
if let Some(p2_mgr) = &game.player2_manager {
    conn.execute(
        "INSERT OR REPLACE INTO managers (id, team_id, data) VALUES (?1, ?2, ?3)",
        (&p2_mgr.id, &p2_mgr.team_id, &serde_json::to_string(p2_mgr)?),
    )?;
    
    // Update game_meta with player2_manager_id
    conn.execute(
        "UPDATE game_meta SET player2_manager_id = ?1 WHERE save_id = ?2",
        (&p2_mgr.id, save_id),
    )?;
}

// Save multiplayer_mode
conn.execute(
    "UPDATE game_meta SET multiplayer_mode = ?1 WHERE save_id = ?2",
    (&game.multiplayer_mode.to_string(), save_id),
)?;

// In GamePersistenceReader::read_game():

// Load player2_manager_id from game_meta
let player2_manager_id: Option<String> = conn.query_row(
    "SELECT player2_manager_id FROM game_meta WHERE save_id = ?1",
    [save_id],
    |row| row.get(0),
).unwrap_or(None);

// Load player2_manager if exists
let player2_manager = if let Some(p2_id) = player2_manager_id {
    let data: String = conn.query_row(
        "SELECT data FROM managers WHERE id = ?1",
        [&p2_id],
        |row| row.get(0),
    )?;
    Some(serde_json::from_str(&data)?)
} else {
    None
};

// Load multiplayer_mode
let multiplayer_mode: String = conn.query_row(
    "SELECT multiplayer_mode FROM game_meta WHERE save_id = ?1",
    [save_id],
    |row| row.get(0),
).unwrap_or_else(|_| "offline".to_string());
```

---

## 4. Network Layer

### 4.1 Technology Stack

| Component | Library | Version | Purpose |
|-----------|---------|---------|---------|
| WebRTC | `webrtc-rs` | Latest | P2P data channels |
| Async Runtime | `tokio` | Existing | Async I/O |
| Serialization | `serde_json` | Existing | Message format |
| Signaling | `axum` | Latest | HTTP signaling server |

### 4.2 Cargo Dependencies

**File**: `src-tauri/Cargo.toml`

```toml
[dependencies]
# ... existing dependencies ...

# WebRTC for P2P
webrtc = "0.9"
tokio = { version = "1", features = ["full"] }

# Signaling server (optional, host can run minimal server)
axum = "0.7"
tower-http = { version = "0.5", features = ["cors"] }
```

### 4.3 Message Protocol

All messages are JSON-encoded and sent over WebRTC data channels:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum NetworkMessage {
    // Connection
    HandshakeRequest { room_code: String },
    HandshakeResponse { success: bool, error: Option<String> },
    
    // Game State Sync
    GameStateUpdate { game: Game },  // Host → Client
    GameStateRequest,                 // Client → Host
    
    // Day Advancement
    ReadyToAdvance { player_num: u8 },  // Client → Host
    DayAdvanced { new_day: u32 },       // Host → All
    
    // Player Actions (Client → Host)
    PlayerAction {
        player_num: u8,
        action: PlayerActionType,
    },
    
    // Connection Status
    Ping,
    Pong,
    Disconnect,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action")]
pub enum PlayerActionType {
    SetFormation { formation: String },
    SetStartingXi { player_ids: Vec<String> },
    MakeTransferBid { player_id: String, amount: u64 },
    HireStaff { staff_id: String },
    // ... all other actions
}
```

### 4.4 WebRTC Manager

**File**: `crates/ofm_core/src/network/webrtc_manager.rs`

```rust
pub struct WebRtcManager {
    peer_connection: Arc<Mutex<Option<RTCPeerConnection>>>,
    data_channel: Arc<Mutex<Option<RTCDataChannel>>>,
    is_host: bool,
    message_rx: mpsc::UnboundedReceiver<NetworkMessage>,
    message_tx: mpsc::UnboundedSender<NetworkMessage>,
}

impl WebRtcManager {
    pub fn new(is_host: bool) -> Self {
        let (message_tx, message_rx) = mpsc::unbounded_channel();
        Self {
            peer_connection: Arc::new(Mutex::new(None)),
            data_channel: Arc::new(Mutex::new(None)),
            is_host,
            message_rx,
            message_tx,
        }
    }
    
    /// Create room and get room code
    pub async fn create_room(&self) -> Result<String, NetworkError> {
        // Call signaling server to create room
        // Return room code
    }
    
    /// Join room with code
    pub async fn join_room(&self, room_code: &str) -> Result<(), NetworkError> {
        // Call signaling server to join room
        // Exchange SDP offers/answers
        // Establish WebRTC connection
    }
    
    /// Send message to peer
    pub async fn send(&self, message: NetworkMessage) -> Result<(), NetworkError> {
        let dc = self.data_channel.lock().await;
        if let Some(channel) = dc.as_ref() {
            let data = serde_json::to_vec(&message)?;
            channel.send(&data).await?;
        }
        Ok(())
    }
    
    /// Receive messages from peer
    pub async fn receive(&mut self) -> Option<NetworkMessage> {
        self.message_rx.recv().await
    }
    
    /// Close connection
    pub async fn disconnect(&self) {
        // Close data channel
        // Close peer connection
    }
}
```

### 4.5 Signaling Server

**File**: `src-tauri/src/signaling_server.rs`

```rust
use axum::{
    extract::Path,
    json::Json,
    routing::{get, post},
    Router,
};
use std::collections::HashMap;
use tokio::sync::Mutex;
use axum::extract::State;

#[derive(Clone)]
struct AppState {
    rooms: Arc<Mutex<HashMap<String, Room>>>,
}

struct Room {
    host_sdp: Option<String>,
    client_sdp: Option<String>,
}

async fn create_room(
    State(state): State<AppState>,
) -> Json<CreateRoomResponse> {
    let room_code = generate_room_code();
    let mut rooms = state.rooms.lock().await;
    rooms.insert(room_code.clone(), Room {
        host_sdp: None,
        client_sdp: None,
    });
    Json(CreateRoomResponse { room_code })
}

async fn join_room(
    State(state): State<AppState>,
    Path(room_code): Path<String>,
    Json(payload): Json<JoinRoomPayload>,
) -> Result<Json<JoinRoomResponse>, StatusCode> {
    let mut rooms = state.rooms.lock().await;
    let room = rooms.get_mut(&room_code)
        .ok_or(StatusCode::NOT_FOUND)?;
    
    // Exchange SDP
    // ...
    
    Ok(Json(JoinRoomResponse {
        host_sdp: room.host_sdp.clone(),
    }))
}

pub fn create_router() -> Router {
    let state = AppState {
        rooms: Arc::new(Mutex::new(HashMap::new())),
    };
    
    Router::new()
        .route("/room", post(create_room))
        .route("/room/:code", post(join_room))
        .with_state(state)
}
```

---

## 5. Game Loop Modifications

### 5.1 Day Advancement Flow

**File**: `src-tauri/src/commands/time.rs`

```rust
#[tauri::command]
pub fn advance_time(
    state: State<'_, StateManager>,
    manager_id: Option<String>,  // NEW: for multiplayer
) -> Result<Game, String> {
    let mut game = state
        .active_game
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    
    let game = game.as_mut().ok_or("No active game")?;
    
    // Determine which player is advancing
    let player_num = if let Some(mid) = &manager_id {
        if game.manager.id == *mid { 1 }
        else if game.player2_manager.as_ref().map(|m| m.id == *mid).unwrap_or(false) { 2 }
        else { return Err("Invalid manager_id".to_string()); }
    } else {
        1  // Default to player 1 (backward compatible)
    };
    
    // Mark player as ready
    let can_advance = game.mark_player_ready(player_num);
    
    if !can_advance {
        // Not all players ready yet
        return Ok(game.clone());
    }
    
    // All players ready - advance day
    game.reset_day_readiness();
    
    // Process day for BOTH players
    process_day_multiplayer(game)?;
    
    // Advance clock
    game.clock.advance_days(1);
    
    // Sync to clients (if online mode)
    if game.multiplayer_mode == MultiplayerMode::Online {
        state.sync_to_clients(game.clone()).await?;
    }
    
    Ok(game.clone())
}
```

### 5.2 Multiplayer Day Processing

**File**: `crates/ofm_core/src/turn/mod.rs`

```rust
pub fn process_day_multiplayer(game: &mut Game) -> Result<(), String> {
    let today = game.clock.current_date();
    
    // Process for EACH human player
    for player_num in 1..=2 {
        if game.manager_for_player(player_num).is_none() {
            continue;  // Player doesn't exist
        }
        
        let team_id = game.team_id_for_player(player_num)
            .ok_or("Player has no team")?;
        
        // Process team-specific logic for this player
        process_player_day(game, player_num, &team_id)?;
    }
    
    // Process shared logic (once)
    process_shared_day(game)?;
    
    Ok(())
}

fn process_player_day(
    game: &mut Game,
    player_num: u8,
    team_id: &str,
) -> Result<(), String> {
    // Training
    training::process_training_for_team(game, team_id, weekday_num);
    
    // Finances (for this team)
    finances::process_weekly_finances_for_team(game, team_id);
    
    // Transfer offers (incoming for this team)
    transfers::generate_incoming_transfer_offers_for_team(game, team_id);
    
    // Board objectives (for this player)
    board_objectives::generate_objectives_for_player(game, player_num);
    
    // Firing check (for this player's manager)
    firing::check_manager_firing_for_player(game, player_num);
    
    // Job offers (for this player)
    job_offers::check_job_offers_for_player(game, player_num);
    
    Ok(())
}

fn process_shared_day(game: &mut Game) -> Result<(), String> {
    // Contract expiries (global)
    process_contract_expiries(game);
    
    // Match day processing
    let today = game.clock.current_date();
    if has_match_today(game, today) {
        simulate_matchday_multiplayer(game, today)?;
    }
    
    // League simulation (AI teams)
    simulate_ai_matches(game, today);
    
    // Update standings
    update_standings(game);
    
    // News generation
    news::generate_news(game);
    
    // Champion system updates
    update_champion_system(game);
    
    Ok(())
}
```

### 5.3 PvP Match Handling

**File**: `crates/ofm_core/src/turn/match.rs`

```rust
fn simulate_matchday_multiplayer(
    game: &mut Game,
    today: &str,
) -> Result<(), String> {
    let fixtures = find_fixtures_today(game, today);
    
    for fixture in fixtures {
        let is_pvp = game.is_human_team(&fixture.home_team_id)
            && game.is_human_team(&fixture.away_team_id);
        
        if is_pvp {
            // PvP match - special handling
            handle_pvp_match(game, &fixture)?;
        } else {
            // Normal match (human vs AI or AI vs AI)
            handle_normal_match(game, &fixture)?;
        }
    }
    
    Ok(())
}

fn handle_pvp_match(
    game: &mut Game,
    fixture: &Fixture,
) -> Result<(), String> {
    // In hotseat: both players watch same screen
    // In online: host simulates, sends result to client
    
    // Get both teams' data
    let home_team = game.teams.iter()
        .find(|t| t.id == fixture.home_team_id)
        .ok_or("Home team not found")?;
    let away_team = game.teams.iter()
        .find(|t| t.id == fixture.away_team_id)
        .ok_or("Away team not found")?;
    
    // Build engine data
    let home_data = build_engine_team(home_team, game)?;
    let away_data = build_engine_team(away_team, game)?;
    
    // Simulate ONCE (host does this)
    let result = engine::simulate(home_data, away_data, &engine::Config::default());
    
    // Apply result (same for both players)
    apply_match_result(game, fixture, &result)?;
    
    // Generate match report
    let report = generate_match_report(&result);
    
    // Add to both players' inboxes
    if let Some(p1_team) = game.manager.team_id.as_ref() {
        if p1_team == &fixture.home_team_id || p1_team == &fixture.away_team_id {
            game.messages.push(InboxMessage::match_report(report.clone()));
        }
    }
    if let Some(p2_team) = game.player2_manager.as_ref().and_then(|m| m.team_id.as_ref()) {
        if p2_team == &fixture.home_team_id || p2_team == &fixture.away_team_id {
            game.messages.push(InboxMessage::match_report(report.clone()));
        }
    }
    
    Ok(())
}
```

---

## 6. Command Layer

### 6.1 Command Modifications

All commands that modify team-specific state need to accept `manager_id` parameter.

**Pattern**:

```rust
// BEFORE (single-player)
#[tauri::command]
pub fn set_formation(
    state: State<'_, StateManager>,
    formation: String,
) -> Result<Game, String> {
    let mut game = state.get_game()?;
    let team_id = game.manager.team_id.ok_or("No team")?;
    // ... modify team
}

// AFTER (multiplayer-aware)
#[tauri::command]
pub fn set_formation(
    state: State<'_, StateManager>,
    formation: String,
    manager_id: Option<String>,  // NEW
) -> Result<Game, String> {
    let mut game = state.get_game()?;
    
    // Determine which manager is acting
    let team_id = if let Some(mid) = manager_id {
        game.manager_for_team(&mid)
            .ok_or("Manager not found")?
            .team_id
            .clone()
            .ok_or("Manager has no team")?
    } else {
        game.manager.team_id.clone().ok_or("No team")?
    };
    
    // ... modify team (same logic)
}
```

### 6.2 Commands Requiring Modification

| Command | File | Changes |
|---------|------|---------|
| `set_formation` | `commands/squad.rs` | Add `manager_id` |
| `set_starting_xi` | `commands/squad.rs` | Add `manager_id` |
| `set_play_style` | `commands/squad.rs` | Add `manager_id` |
| `set_lol_tactics` | `commands/squad.rs` | Add `manager_id` |
| `set_training` | `commands/squad.rs` | Add `manager_id` |
| `make_transfer_bid` | `commands/transfers.rs` | Add `manager_id` |
| `propose_renewal` | `commands/transfers.rs` | Add `manager_id` |
| `hire_staff` | `commands/staff.rs` | Add `manager_id` |
| `release_staff` | `commands/staff.rs` | Add `manager_id` |
| `promote_academy_player` | `commands/academy.rs` | Add `manager_id` |
| `set_player_champion_target` | `commands/player.rs` | Add `manager_id` |

### 6.3 Backward Compatibility

To maintain backward compatibility with frontend:

```rust
// Make manager_id optional with default
#[tauri::command]
pub fn set_formation(
    state: State<'_, StateManager>,
    formation: String,
    #[serde(default)] manager_id: Option<String>,  // Optional
) -> Result<Game, String> {
    // If manager_id is None, default to game.manager (player 1)
    // This maintains backward compatibility
}
```

---

## 7. Frontend Integration

### 7.1 TypeScript Types

**File**: `src/store/types.ts`

```typescript
// Existing
export interface GameStateData {
  manager: ManagerData;
  // ... existing fields
}

// NEW - Multiplayer support
export interface GameStateData {
  manager: ManagerData;
  player2_manager?: ManagerData;  // Optional
  multiplayer_mode: 'offline' | 'hotseat' | 'online';
  current_player: 1 | 2;
  is_my_turn: boolean;
  opponent_ready: boolean;
  connection_status: 'disconnected' | 'connecting' | 'connected' | 'failed';
  room_code?: string;
}

export interface ManagerData {
  id: string;
  team_id: string | null;
  // ... existing fields
}
```

### 7.2 Game Store Modifications

**File**: `src/store/gameStore.ts`

```typescript
interface GameStore {
  // Existing
  hasActiveGame: boolean;
  managerName: string | null;
  gameState: GameStateData | null;
  isDirty: boolean;
  
  // NEW - Multiplayer
  current_player: 1 | 2;
  is_my_turn: boolean;
  opponent_ready: boolean;
  connection_status: ConnectionStatus;
  room_code: string | null;
  
  // Actions
  switchPlayer: () => void;
  markReady: () => Promise<void>;
  connectToRoom: (roomCode: string) => Promise<void>;
  createRoom: () => Promise<string>;
  disconnect: () => Promise<void>;
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Existing state...
  
  // NEW
  current_player: 1,
  is_my_turn: true,
  opponent_ready: false,
  connection_status: 'disconnected',
  room_code: null,
  
  switchPlayer: () => {
    const current = get().current_player;
    set({ current_player: current === 1 ? 2 : 1 });
  },
  
  markReady: async () => {
    // Call Tauri command
    await invoke('advance_time', { managerId: get().gameState?.manager.id });
  },
  
  createRoom: async () => {
    // Call Tauri command to create room
    const roomCode = await invoke('multiplayer_create_room');
    set({ room_code: roomCode, connection_status: 'connected' });
    return roomCode;
  },
  
  connectToRoom: async (roomCode: string) => {
    // Call Tauri command to join room
    await invoke('multiplayer_join_room', { roomCode });
    set({ room_code: roomCode, connection_status: 'connected' });
  },
  
  disconnect: async () => {
    await invoke('multiplayer_disconnect');
    set({ connection_status: 'disconnected', room_code: null });
  },
}));
```

### 7.3 New UI Components

**File**: `src/components/multiplayer/PlayerSelector.tsx`

```tsx
export function PlayerSelector() {
  const { current_player, switchPlayer, is_my_turn } = useGameStore();
  
  return (
    <div className="player-selector">
      <button
        className={current_player === 1 ? 'active' : ''}
        onClick={() => switchPlayer()}
      >
        Player 1
      </button>
      <button
        className={current_player === 2 ? 'active' : ''}
        onClick={() => switchPlayer()}
      >
        Player 2
      </button>
      {!is_my_turn && (
        <span className="waiting">Waiting for opponent...</span>
      )}
    </div>
  );
}
```

**File**: `src/components/multiplayer/RoomCodeDisplay.tsx`

```tsx
export function RoomCodeDisplay() {
  const { room_code, connection_status } = useGameStore();
  
  if (!room_code) return null;
  
  return (
    <div className="room-code-display">
      <span>Room Code:</span>
      <code>{room_code}</code>
      <span className={`status ${connection_status}`}>
        {connection_status}
      </span>
    </div>
  );
}
```

---

## 8. Conflict Resolution

### 8.1 Transfer Bidding

**File**: `crates/domain/src/transfer.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferOffer {
    // Existing
    pub id: String,
    pub player_id: String,
    pub offering_team_id: String,
    pub amount: u64,
    pub expiry_date: String,
    
    // NEW - Multiplayer bidding
    #[serde(default)]
    pub all_bids: Vec<TransferBid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferBid {
    pub player_num: u8,  // Which player made this bid
    pub amount: u64,
    pub timestamp: u64,
}

impl TransferOffer {
    /// Get highest bid
    pub fn highest_bid(&self) -> Option<&TransferBid> {
        self.all_bids.iter().max_by_key(|b| b.amount)
    }
    
    /// Add bid from player
    pub fn add_bid(&mut self, player_num: u8, amount: u64) {
        self.all_bids.push(TransferBid {
            player_num,
            amount,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        });
    }
}
```

### 8.2 Staff Hiring Lock

**File**: `crates/domain/src/staff.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Staff {
    // Existing
    pub id: String,
    pub name: String,
    pub team_id: Option<String>,
    
    // NEW - Multiplayer
    #[serde(default)]
    pub pending_offer_from: Option<u8>,  // Which player made offer
    #[serde(default)]
    pub offer_expiry_day: Option<u32>,   // Day when offer expires
}

impl Staff {
    /// Check if staff is available for hiring
    pub fn is_available(&self, current_day: u32) -> bool {
        self.team_id.is_none()  // Free agent
            && self.pending_offer_from.is_none()  // No pending offer
    }
    
    /// Make offer (locks staff for 24h = 24 game days)
    pub fn make_offer(&mut self, player_num: u8, current_day: u32) {
        self.pending_offer_from = Some(player_num);
        self.offer_expiry_day = Some(current_day + 24);
    }
    
    /// Check if offer has expired
    pub fn check_expiry(&mut self, current_day: u32) {
        if let Some(expiry) = self.offer_expiry_day {
            if current_day >= expiry {
                self.pending_offer_from = None;
                self.offer_expiry_day = None;
            }
        }
    }
}
```

### 8.3 Free Agent Priority

```rust
// When both players want same free agent:
// Use day-based priority (alternates daily)

pub fn get_priority_player(game: &Game) -> u8 {
    let day = game.clock.current_day();
    if day % 2 == 0 { 1 } else { 2 }
}
```

---

## 9. Save/Load System

### 9.1 Host Saves

Host saves to authoritative SQLite database:

```rust
// Host saves normally
#[tauri::command]
pub fn save_game(
    state: State<'_, StateManager>,
    save_name: String,
) -> Result<(), String> {
    let game = state.get_game()?;
    
    // Save to SQLite (includes player2_manager if exists)
    save_manager.save_game(&save_name, &game)?;
    
    // Notify client to save backup
    if game.multiplayer_mode == MultiplayerMode::Online {
        state.notify_client_save().await?;
    }
    
    Ok(())
}
```

### 9.2 Client Backup Save

Client saves backup for disconnect recovery:

```rust
#[tauri::command]
pub fn save_backup(
    state: State<'_, StateManager>,
) -> Result<(), String> {
    let game = state.get_game()?;
    
    // Save to backup location
    let backup_path = get_backup_save_path();
    save_to_file(&backup_path, &game)?;
    
    Ok(())
}

#[tauri::command]
pub fn load_backup(
    state: State<'_, StateManager>,
) -> Result<Game, String> {
    let backup_path = get_backup_save_path();
    let game = load_from_file(&backup_path)?;
    
    // Convert to offline mode
    let mut game = game;
    game.multiplayer_mode = MultiplayerMode::Offline;
    game.network_state = None;
    
    state.set_game(game.clone());
    Ok(game)
}
```

### 9.3 Host Disconnect Handling

```rust
pub async fn on_host_disconnect(
    state: State<'_, StateManager>,
) -> Result<(), String> {
    // Save backup on client side
    save_backup(state.clone()).await?;
    
    // Show dialog to user
    // Options: Continue offline / Wait for host
    
    Ok(())
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

```rust
// crates/ofm_core/src/game.rs

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_can_advance_day_offline() {
        let mut game = create_single_player_game();
        game.player1_day_ready = true;
        assert!(game.can_advance_day());
    }
    
    #[test]
    fn test_can_advance_day_hotseat() {
        let mut game = create_hotseat_game();
        game.player1_day_ready = true;
        game.player2_day_ready = false;
        assert!(!game.can_advance_day());
        
        game.player2_day_ready = true;
        assert!(game.can_advance_day());
    }
    
    #[test]
    fn test_manager_for_player() {
        let game = create_multiplayer_game();
        assert!(game.manager_for_player(1).is_some());
        assert!(game.manager_for_player(2).is_some());
        assert!(game.manager_for_player(3).is_none());
    }
}
```

### 10.2 Integration Tests

```rust
// tests/multiplayer_hotseat.rs

#[test]
fn test_hotseat_full_session() {
    // Create hotseat game
    let mut game = create_hotseat_game();
    
    // Player 1 actions
    game.mark_player_ready(1);
    assert!(!game.can_advance_day());
    
    // Player 2 actions
    game.mark_player_ready(2);
    assert!(game.can_advance_day());
    
    // Advance day
    process_day_multiplayer(&mut game).unwrap();
    game.clock.advance_days(1);
    game.reset_day_readiness();
    
    // Verify both managers processed
    assert!(game.player1_day_ready == false);
    assert!(game.player2_day_ready == false);
}
```

### 10.3 E2E Tests

```rust
// tests/multiplayer_online.rs

#[tokio::test]
async fn test_online_connection() {
    // Start host
    let host = HostClient::new().await;
    let room_code = host.create_room().await;
    
    // Start client
    let client = ClientClient::new().await;
    client.join_room(&room_code).await.unwrap();
    
    // Verify connection
    assert_eq!(host.get_connection_status(), ConnectionStatus::Connected);
    assert_eq!(client.get_connection_status(), ConnectionStatus::Connected);
    
    // Cleanup
    host.disconnect().await;
    client.disconnect().await;
}
```

---

## 11. Implementation Checklist

### Phase 1: Foundation (Days 1-3)

- [ ] Add `player2_manager: Option<Manager>` to `Game` struct
- [ ] Add `multiplayer_mode` enum
- [ ] Add `current_player`, `player1_day_ready`, `player2_day_ready`
- [ ] Add helper methods (`manager_for_player`, `can_advance_day`, etc.)
- [ ] Create database migration V29
- [ ] Update `GamePersistenceReader` and `GamePersistenceWriter`
- [ ] Add serde tests for backward compatibility

### Phase 2: Hotseat Mode (Days 4-14)

- [ ] Add `switch_current_player` command
- [ ] Update `advance_time` to check both ready
- [ ] Add player selector UI component
- [ ] Add "End Turn" button
- [ ] Update game loop to process both managers
- [ ] Add feature flag `MULTIPLAYER_HOTSEAT`
- [ ] Test hotseat full session

### Phase 3: Online Infrastructure (Days 15-35)

- [ ] Add WebRTC dependencies
- [ ] Implement `WebRtcManager`
- [ ] Create signaling server
- [ ] Add `create_room` and `join_room` commands
- [ ] Implement message protocol
- [ ] Add state sync (host → client)
- [ ] Add action forwarding (client → host)
- [ ] Add connection status UI
- [ ] Test connection establishment

### Phase 4: Multiplayer Game Logic (Days 36-56)

- [ ] Refactor `process_day()` for multiple managers
- [ ] Implement transfer bidding system
- [ ] Implement staff hiring locks
- [ ] Implement PvP match handling
- [ ] Add conflict resolution rules
- [ ] Update all team-specific commands with `manager_id`
- [ ] Test PvP matches
- [ ] Test conflict scenarios

### Phase 5: Polish & Release (Days 57-63)

- [ ] Add host disconnect handling
- [ ] Add client backup save
- [ ] Add reconnection logic
- [ ] Performance optimization
- [ ] Documentation
- [ ] Remove feature flag
- [ ] Release notes
- [ ] Final testing

---

## 12. Appendix: Code Analysis

### 12.1 Manager Usage Statistics

Total usages of `game.manager` across codebase: **142+**

| Usage Type | Count | Files |
|------------|-------|-------|
| `game.manager.team_id` | ~80 | All command handlers |
| `game.manager.satisfaction` | ~15 | Board/firing logic |
| `game.manager.fan_approval` | ~8 | Reputation logic |
| `game.manager.career_stats` | ~10 | End-of-season |
| `game.manager.hire()` | ~5 | Job acceptance |
| `game.manager.fire()` | ~2 | Firing logic |

### 12.2 Files Requiring Modification

**Core (12 files)**:
- `crates/ofm_core/src/game.rs`
- `crates/ofm_core/src/turn/mod.rs`
- `crates/ofm_core/src/turn/match.rs` (new)
- `crates/ofm_core/src/transfers.rs`
- `crates/ofm_core/src/staff.rs`
- `crates/ofm_core/src/state.rs`
- `crates/db/src/sql/v029_multiplayer.sql` (new)
- `crates/db/src/migrations.rs`
- `crates/db/src/game_persistence.rs`
- `crates/ofm_core/src/network/webrtc_manager.rs` (new)
- `crates/ofm_core/src/network/mod.rs` (new)

**Commands (15 files)**:
- `src-tauri/src/commands/game.rs`
- `src-tauri/src/commands/time.rs`
- `src-tauri/src/commands/squad.rs`
- `src-tauri/src/commands/transfers.rs`
- `src-tauri/src/commands/staff.rs`
- `src-tauri/src/commands/academy.rs`
- `src-tauri/src/commands/player.rs`
- `src-tauri/src/commands/multiplayer.rs` (new)
- `src-tauri/src/lib.rs`

**Frontend (10 files)**:
- `src/store/types.ts`
- `src/store/gameStore.ts`
- `src/components/multiplayer/PlayerSelector.tsx` (new)
- `src/components/multiplayer/RoomCodeDisplay.tsx` (new)
- `src/components/multiplayer/MultiplayerMenu.tsx` (new)
- `src/pages/MultiplayerLobby.tsx` (new)
- `src/services/network.ts` (new)
- `src/hooks/useMultiplayer.ts` (new)

### 12.3 Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking existing saves | Low | High | `#[serde(default)]`, extensive testing |
| Game loop bugs | Medium | High | Feature flag, gradual rollout |
| Network desync | Medium | Medium | Host-authoritative, periodic full sync |
| Host disconnect | High | Low | Client backup save, offline recovery |
| Performance degradation | Low | Medium | Benchmark before/after |
| Conflict resolution edge cases | Medium | Low | Clear rules, logging |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-30 | @nicodembus | Initial draft |

---

*This document is a living specification and will be updated as implementation progresses.*
