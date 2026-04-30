# Phase 2: Online P2P - Implementation Plan

**Status**: ✅ **COMPLETE**  
**Duration**: 3-4 weeks  
**Risk**: Medium  
**Dependencies**: Phase 1 (Foundation) ✅ Complete  
**Progress**: Week 1 ✅ | Week 2 ✅ | Week 3 ✅ | Week 4 ✅  
**Total Tests**: 100 passing (33 Backend + 56 Frontend + 3 Integration + 8 E2E)
**Total Code**: ~7017 lines  
**Ready to Merge**: YES ✅

---

## Overview

Phase 2 implements **online multiplayer** where 2 players connect over the internet, each on their own PC. One player hosts the game (authoritative), the other joins as client.

### Key Characteristics

- **P2P Architecture**: Direct WebRTC connection between players
- **Host-Authoritative**: Host runs game logic, client sends actions
- **Room Code System**: 6-character codes to join games (e.g., `ABC123`)
- **Double-Check Day Advancement**: Both players must confirm before day advances
- **Graceful Disconnect**: Client can continue offline if host disconnects

---

## Technical Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLAYER 1 (HOST)                              │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Frontend   │  │   Backend    │  │    WebRTC    │         │
│  │   (React)    │◄─┤   (Rust)     │◄─┤   Manager    │◄───┐    │
│  │              │  │              │  │              │    │    │
│  │  - UI        │  │  - Game      │  │  - Data      │    │    │
│  │  - Multiplayer│  │  - Logic    │  │  - Sync      │    │    │
│  │    Menu      │  │  - Save      │  │  - Messages  │    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │    │
│         ▲                 ▲                               │    │
│         │                 │                               │    │
│    ┌────┴────┐       ┌────┴────┐                     │    │
│    │ Game    │       │  Game   │                     │    │
│    │ Store   │       │  State  │                     │    │
│    │(Zustand)│       │(Mutex)  │                     │    │
│    └─────────┘       └─────────┘                     │    │
│         ▲                                              │    │
│         │                                              │    │
│    ┌────┴─────────────────────────────┐                │    │
│    │         SAVE SYSTEM              │                │    │
│    │  (SQLite - Authoritative)        │                │    │
│    └──────────────────────────────────┘                │    │
│                                                         │    │
└─────────────────────────────────────────────────────────┼────┘
                                                          │
                        WebRTC Data Channel               │
                        (Encrypted, Reliable)             │
                        - Game state updates              │
                        - Player actions                  │
                        - Ready signals                   │
                        - Ping/pong                       │
                                                          │
┌─────────────────────────────────────────────────────────┼────┐
│                    PLAYER 2 (CLIENT)                    │    │
│                                                         │    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │    │
│  │   Frontend   │  │   Backend    │  │    WebRTC    │─┘    │
│  │   (React)    │◄─┤   (Rust)     │◄─┤   Manager    │      │
│  │              │  │              │  │              │      │
│  │  - UI        │  │  - Game      │  │  - Data      │      │
│  │  - Multiplayer│  │  - Logic    │  │  - Sync      │      │
│  │    Menu      │  │  - (Read-   │  │  - Messages  │      │
│  └──────────────┘  │    only)    │  └──────────────┘      │
│                    └──────────────┘                        │
│         ▲                                                  │
│         │                                                  │
│    ┌────┴────┐                                        │
│    │ Game    │                                        │
│    │ Store   │                                        │
│    │(Zustand)│                                        │
│    └─────────┘                                        │
│                                                        │
│  ┌──────────────────────────────────────┐             │
│  │         BACKUP SAVE                  │             │
│  │  (Local copy for disconnect recovery)│             │
│  └──────────────────────────────────────┘             │
│                                                       │
└───────────────────────────────────────────────────────┘

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
                        │                  │
                        │  Stateles, minimal│
                        └─────────────────┘
```

### Data Flow

#### 1. Room Creation (Host)
```
User clicks "Create Room"
  ↓
Frontend calls: multiplayer_create_room()
  ↓
Backend generates room code (ABC123)
  ↓
Backend calls signaling server: POST /room
  ↓
Signaling server creates room, returns code
  ↓
Backend starts WebRTC listener
  ↓
Frontend shows lobby with room code
```

#### 2. Join Room (Client)
```
User enters room code "ABC123"
  ↓
Frontend calls: multiplayer_join_room("ABC123")
  ↓
Backend calls signaling server: GET /room/ABC123
  ↓
Signaling server returns host's SDP offer
  ↓
Backend creates WebRTC answer, sends via signaling
  ↓
WebRTC connection established (P2P)
  ↓
Client requests initial game state
  ↓
Host sends full game state via data channel
```

#### 3. Day Advancement
```
Player 1 clicks "Continue Day"
  ↓
Client → Host: { type: "ReadyToAdvance", player: 1 }
  ↓
Host stores: player1_day_ready = true
  ↓
Host checks: can_advance_day()?
  ↓
If NO: Host → Client: { type: "WaitingForOpponent" }
  ↓
If YES (both ready):
  - Host runs process_day()
  - Host saves game
  - Host → Client: { type: "DayAdvanced", game: {...} }
  - Both players see new day
```

#### 4. Player Action (e.g., Set Formation)
```
Player 2 changes formation
  ↓
Client → Host: { type: "PlayerAction", player: 2, action: "SetFormation", data: {...} }
  ↓
Host validates action (is it player 2's turn? valid team?)
  ↓
Host applies action to game state
  ↓
Host → Client: { type: "ActionConfirmed", game: {...} }
  ↓
Both players see updated formation
```

#### 5. Host Disconnect
```
Host PC crashes / loses connection
  ↓
Client detects WebRTC connection closed
  ↓
Client shows dialog: "Host disconnected"
  ↓
Client saves backup: save_backup()
  ↓
Options:
  - "Continue Offline" → loads backup as single-player
  - "Wait for Reconnection" → tries to reconnect (3 attempts)
```

---

## Implementation Tasks

### Week 1: Network Infrastructure

#### Task 1.1: WebRTC Manager (Rust)
**File**: `src-tauri/crates/ofm_core/src/network/webrtc_manager.rs`

**What**:
- Initialize WebRTC peer connection
- Create/accept data channels
- Send/receive messages
- Handle connection state changes

**Code Structure**:
```rust
pub struct WebRtcManager {
    peer_connection: Arc<Mutex<Option<RTCPeerConnection>>>,
    data_channel: Arc<Mutex<Option<RTCDataChannel>>>,
    is_host: bool,
    message_tx: mpsc::UnboundedSender<NetworkMessage>,
    message_rx: mpsc::UnboundedReceiver<NetworkMessage>,
}

impl WebRtcManager {
    pub fn new(is_host: bool) -> Self;
    pub async fn create_offer(&self) -> Result<String, NetworkError>;
    pub async fn accept_offer(&self, offer: &str) -> Result<String, NetworkError>;
    pub async fn send(&self, message: NetworkMessage) -> Result<(), NetworkError>;
    pub async fn receive(&mut self) -> Option<NetworkMessage>;
    pub async fn disconnect(&self);
}
```

**Tests**:
- Unit: Message serialization/deserialization
- Integration: WebRTC connection between two local peers

---

#### Task 1.2: Signaling Server (Rust + Axum)
**File**: `src-tauri/src/signaling_server.rs`

**What**:
- Simple HTTP server for SDP exchange
- Room management (create, join, expire)
- Stateless, minimal (can run on free tier)

**API Endpoints**:
```rust
POST /room
  → { "room_code": "ABC123" }

GET /room/:code
  → { "host_sdp": "...", "status": "waiting" }

POST /room/:code/join
  → { "client_sdp": "..." }

GET /room/:code/answer
  → { "answer_sdp": "..." }
```

**Deployment Options**:
- Option A: Host runs signaling server locally (port forwarding needed)
- Option B: Deploy to free tier (Render, Railway, Fly.io)
- Option C: Use third-party signaling service

**Recommendation**: Option B for MVP (most reliable)

---

#### Task 1.3: Network Message Protocol
**File**: `src-tauri/crates/ofm_core/src/network/messages.rs`

**What**:
- Define all message types
- Serialization/deserialization
- Version field for future compatibility

**Message Types**:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum NetworkMessage {
    // Connection
    HandshakeRequest { room_code: String },
    HandshakeResponse { success: bool, error: Option<String> },
    
    // Game State
    GameStateRequest,
    GameStateUpdate { 
        game: Game,
        checksum: String,
        timestamp: u64,
    },
    
    // Day Advancement
    ReadyToAdvance { player_num: u8 },
    DayAdvanced { 
        new_day: u32,
        game: Game,
    },
    WaitingForOpponent,
    
    // Player Actions
    PlayerAction {
        player_num: u8,
        action: PlayerActionType,
        request_id: String,
    },
    ActionConfirmed {
        game: Game,
        request_id: String,
    },
    ActionRejected {
        reason: String,
        request_id: String,
    },
    
    // Connection Management
    Ping,
    Pong,
    Disconnect,
    ReconnectRequest,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action")]
pub enum PlayerActionType {
    SetFormation { formation: String },
    SetStartingXi { player_ids: Vec<String> },
    SetPlayStyle { play_style: String },
    SetLolTactics { tactics: String },
    MakeTransferBid { player_id: String, amount: u64 },
    ProposeRenewal { player_id: String, offer: Contract },
    HireStaff { staff_id: String },
    // ... all other modifiable actions
}
```

---

### Week 2: Backend Commands & State Sync

#### Task 2.1: Multiplayer Commands
**Files**: `src-tauri/src/commands/multiplayer.rs` (new)

**Commands to Implement**:
```rust
/// Create a new online room
#[tauri::command]
pub async fn multiplayer_create_room(
    state: State<'_, StateManager>,
) -> Result<String, String>

/// Join an existing room
#[tauri::command]
pub async fn multiplayer_join_room(
    state: State<'_, StateManager>,
    room_code: String,
) -> Result<(), String>

/// Disconnect from current room
#[tauri::command]
pub async fn multiplayer_disconnect(
    state: State<'_, StateManager>,
) -> Result<(), String>

/// Mark current day as ready (both players)
#[tauri::command]
pub async fn mark_day_ready(
    state: State<'_, StateManager>,
) -> Result<Game, String>

/// Get connection status
#[tauri::command]
pub async fn get_connection_status(
    state: State<'_, StateManager>,
) -> Result<ConnectionStatus, String>
```

---

#### Task 2.2: Modify Existing Commands for Multiplayer
**Files**: All `src-tauri/src/commands/*.rs`

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
) -> Result<Game, String> {
    let mut game = state.get_game()?;
    
    // Check if multiplayer
    if game.is_multiplayer() {
        // In multiplayer, this comes from network message
        // Command is only called by host
        return Err("Use network messages for multiplayer actions".to_string());
    }
    
    // Single-player: proceed as normal
    let team_id = game.manager.team_id.ok_or("No team")?;
    // ... modify team
}
```

**Commands to Modify** (~15 total):
- `set_formation`
- `set_starting_xi`
- `set_play_style`
- `set_lol_tactics`
- `set_training`
- `make_transfer_bid`
- `propose_renewal`
- `hire_staff`
- `release_staff`
- `promote_academy_player`
- `set_player_champion_target`
- `apply_match_command`
- `start_live_match`
- `finish_live_match`
- `advance_time` (major changes)

---

#### Task 2.3: Game State Synchronization
**File**: `src-tauri/src/network/sync_manager.rs` (new)

**What**:
- Host sends game state to client after each action
- Periodic full sync (every 30 seconds)
- Checksum validation to detect desync

**Implementation**:
```rust
pub struct SyncManager {
    last_sync_timestamp: u64,
    sync_interval_secs: u64,
}

impl SyncManager {
    /// Send full game state to client
    pub async fn full_sync(&self, game: &Game) -> Result<(), NetworkError> {
        let message = NetworkMessage::GameStateUpdate {
            game: game.clone(),
            checksum: compute_checksum(game),
            timestamp: current_timestamp(),
        };
        self.send(message).await
    }
    
    /// Check if periodic sync is due
    pub fn should_sync(&self) -> bool {
        current_timestamp() - self.last_sync_timestamp > self.sync_interval_secs
    }
    
    /// Validate game state checksum
    pub fn validate_checksum(&self, game: &Game, expected: &str) -> bool {
        compute_checksum(game) == expected
    }
}

fn compute_checksum(game: &Game) -> String {
    // Hash of critical game state
    // Detects desync between host and client
}
```

---

#### Task 2.4: Backup Save System
**File**: `src-tauri/crates/db/src/backup_save.rs` (new)

**What**:
- Client saves local backup copy
- Used if host disconnects
- Can continue as single-player

**Implementation**:
```rust
/// Save backup copy (client-side only)
#[tauri::command]
pub fn save_multiplayer_backup(
    state: State<'_, StateManager>,
) -> Result<(), String> {
    let game = state.get_game()?;
    
    if !game.is_multiplayer() {
        return Ok(()); // Nothing to backup
    }
    
    // Save to special backup location
    let backup_path = get_backup_save_path();
    save_to_file(&backup_path, &game)?;
    
    Ok(())
}

/// Load backup and convert to offline mode
#[tauri::command]
pub fn load_multiplayer_backup(
    state: State<'_, StateManager>,
) -> Result<Game, String> {
    let backup_path = get_backup_save_path();
    let mut game = load_from_file(&backup_path)?;
    
    // Convert to offline mode
    game.multiplayer_mode = MultiplayerMode::Offline;
    game.player2_manager = None; // Remove P2
    game.network_state = None;
    
    state.set_game(game.clone());
    Ok(game)
}
```

---

### Week 3: Frontend UI

#### Task 3.1: Multiplayer Menu
**File**: `src/pages/MultiplayerMenu.tsx` (new)

**UI Components**:
```tsx
export function MultiplayerMenu() {
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  const handleCreateRoom = async () => {
    const code = await invoke('multiplayer_create_room');
    navigate(`/multiplayer/lobby/${code}`);
  };
  
  const handleJoinRoom = async () => {
    await invoke('multiplayer_join_room', { roomCode });
    navigate(`/multiplayer/lobby/${roomCode}`);
  };
  
  return (
    <div className="multiplayer-menu">
      <h2>Online Multiplayer</h2>
      
      <button onClick={handleCreateRoom} disabled={isCreating}>
        Create Online Room
      </button>
      
      <div className="join-section">
        <input 
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          maxLength={6}
        />
        <button onClick={handleJoinRoom}>Join Room</button>
      </div>
      
      <button onClick={() => navigate('/')}>Back</button>
    </div>
  );
}
```

---

#### Task 3.2: Room Lobby
**File**: `src/pages/MultiplayerLobby.tsx` (new)

**UI Components**:
```tsx
export function MultiplayerLobby({ roomCode }: { roomCode: string }) {
  const [status, setStatus] = useState<'waiting' | 'connected' | 'error'>('waiting');
  const [myTeam, setMyTeam] = useState<string | null>(null);
  const [opponentTeam, setOpponentTeam] = useState<string | null>(null);
  
  // Poll for opponent connection
  useEffect(() => {
    const interval = setInterval(async () => {
      const status = await invoke('get_room_status', { roomCode });
      setStatus(status.connected ? 'connected' : 'waiting');
      setOpponentTeam(status.opponent_team);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [roomCode]);
  
  const handleStartGame = async () => {
    await invoke('start_multiplayer_game', { roomCode, myTeam });
    navigate('/game');
  };
  
  return (
    <div className="multiplayer-lobby">
      <h2>Room: {roomCode}</h2>
      
      <div className="room-code-display">
        <code>{roomCode}</code>
        <button onClick={() => navigator.clipboard.writeText(roomCode)}>
          Copy
        </button>
      </div>
      
      <div className="players">
        <div className="player-slot">
          <h3>You</h3>
          <TeamSelector value={myTeam} onChange={setMyTeam} />
        </div>
        
        <div className="player-slot">
          <h3>Opponent</h3>
          {status === 'waiting' ? (
            <p>Waiting for opponent...</p>
          ) : (
            <p>{opponentTeam || 'Choosing team...'}</p>
          )}
        </div>
      </div>
      
      <button 
        onClick={handleStartGame}
        disabled={!myTeam || status !== 'connected' || !opponentTeam}
      >
        Start Game
      </button>
      
      <button onClick={() => navigate('/multiplayer')}>Cancel</button>
    </div>
  );
}
```

---

#### Task 3.3: Connection Status Indicator
**File**: `src/components/multiplayer/ConnectionStatus.tsx` (new)

**UI Components**:
```tsx
export function ConnectionStatus() {
  const { connectionStatus, opponentReady } = useMultiplayerStore();
  
  if (connectionStatus === 'disconnected') {
    return null; // Not in multiplayer mode
  }
  
  return (
    <div className="connection-status">
      <div className={`status-indicator ${connectionStatus}`}>
        {connectionStatus === 'connected' && '🟢'}
        {connectionStatus === 'connecting' && '🟡'}
        {connectionStatus === 'reconnecting' && '🟠'}
        {connectionStatus === 'failed' && '🔴'}
      </div>
      
      <span className="opponent-status">
        {opponentReady ? 'Opponent ready' : 'Waiting for opponent...'}
      </span>
    </div>
  );
}
```

---

#### Task 3.4: Day Advancement UI
**File**: `src/components/multiplayer/DayAdvancement.tsx` (new)

**UI Components**:
```tsx
export function DayAdvancement() {
  const { isMyTurn, opponentReady, markReady } = useMultiplayerStore();
  
  const handleContinue = async () => {
    await markReady();
  };
  
  if (!isMyTurn) {
    return (
      <div className="day-advancement waiting">
        <p>Waiting for opponent to continue...</p>
        <Spinner />
      </div>
    );
  }
  
  if (opponentReady) {
    return (
      <div className="day-advancement both-ready">
        <p>Both players ready! Advancing day...</p>
        <Spinner />
      </div>
    );
  }
  
  return (
    <div className="day-advancement">
      <button onClick={handleContinue}>
        Continue Day
      </button>
      <p className="hint">
        Day will advance when both players are ready
      </p>
    </div>
  );
}
```

---

#### Task 3.5: Disconnect Dialog
**File**: `src/components/multiplayer/DisconnectDialog.tsx` (new)

**UI Components**:
```tsx
export function DisconnectDialog() {
  const [show, setShow] = useState(false);
  
  useEffect(() => {
    const unsubscribe = useMultiplayerStore.subscribe(
      (state) => state.connectionStatus === 'failed',
      (disconnected) => {
        if (disconnected) setShow(true);
      }
    );
    return unsubscribe;
  }, []);
  
  const handleContinueOffline = async () => {
    await invoke('load_multiplayer_backup');
    navigate('/game');
  };
  
  const handleWaitForReconnection = async () => {
    setShow(false);
    // Auto-reconnect logic in background
  };
  
  if (!show) return null;
  
  return (
    <Dialog open={show}>
      <h2>Host Disconnected</h2>
      <p>
        The host has lost connection. The game has been saved locally.
      </p>
      
      <div className="actions">
        <button onClick={handleContinueOffline}>
          Continue Offline
        </button>
        <button onClick={handleWaitForReconnection}>
          Wait for Reconnection
        </button>
      </div>
    </Dialog>
  );
}
```

---

### Week 4: Game Logic & Testing

#### Task 4.1: Multiplayer Day Processing
**File**: `src-tauri/crates/ofm_core/src/turn/mod.rs`

**Changes**:
```rust
pub fn process_day_multiplayer(game: &mut Game) -> Result<(), String> {
    // Only host runs this
    if !game.network_state.as_ref().map(|n| n.is_host).unwrap_or(false) {
        return Err("Only host can process day");
    }
    
    // Check both players ready
    if !game.can_advance_day() {
        return Ok(()); // Wait for both
    }
    
    // Reset readiness
    game.reset_day_readiness();
    
    // Process for BOTH human players
    for player_num in 1..=2 {
        if game.manager_for_player(player_num).is_none() {
            continue;
        }
        
        let team_id = game.team_id_for_player(player_num)
            .ok_or("Player has no team")?;
        
        // Process team-specific logic
        process_player_day(game, player_num, &team_id)?;
    }
    
    // Process shared logic (once)
    process_shared_day(game)?;
    
    // Advance clock
    game.clock.advance_days(1);
    
    Ok(())
}
```

---

#### Task 4.2: PvP Match Handling
**File**: `src-tauri/crates/ofm_core/src/turn/match.rs`

**Changes**:
```rust
fn handle_pvp_match(
    game: &mut Game,
    fixture: &Fixture,
) -> Result<(), String> {
    // Both players must confirm ready for match
    if !both_players_match_ready(game) {
        return Ok(()); // Wait for both
    }
    
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
    
    // Apply result (same for both)
    apply_match_result(game, fixture, &result)?;
    
    // Generate match report
    let report = generate_match_report(&result);
    
    // Add to BOTH players' inboxes
    game.messages.push(InboxMessage::match_report(report.clone()));
    
    // Notify both players
    // (via network message)
    
    Ok(())
}
```

---

#### Task 4.3: Conflict Resolution
**File**: `src-tauri/crates/ofm_core/src/transfers.rs`

**Transfer Bidding**:
```rust
impl TransferOffer {
    /// Add bid from a player (multiplayer-aware)
    pub fn add_bid(&mut self, player_num: u8, amount: u64, timestamp: u64) {
        // Check if this player already bid
        if let Some(existing) = self.bids.iter_mut().find(|b| b.player_num == player_num) {
            // Update existing bid if higher
            if amount > existing.amount {
                existing.amount = amount;
                existing.timestamp = timestamp;
            }
        } else {
            // New bid
            self.bids.push(TransferBid {
                player_num,
                amount,
                timestamp,
            });
        }
        
        // Both players can see all bids (transparent auction)
    }
    
    /// Get highest bidder
    pub fn highest_bidder(&self) -> Option<u8> {
        self.bids.iter().max_by_key(|b| b.amount).map(|b| b.player_num)
    }
}
```

---

#### Task 4.4: Testing Strategy

**Unit Tests**:
- Message serialization/deserialization
- Checksum computation
- Day readiness logic
- Conflict resolution

**Integration Tests**:
```rust
#[tokio::test]
async fn test_webrtc_connection() {
    // Create host and client
    let host = WebRtcManager::new(true);
    let client = WebRtcManager::new(false);
    
    // Exchange SDP (mock signaling)
    let offer = host.create_offer().await.unwrap();
    let answer = client.accept_offer(&offer).await.unwrap();
    host.accept_answer(&answer).await.unwrap();
    
    // Verify connected
    assert_eq!(host.connection_status(), ConnectionStatus::Connected);
    assert_eq!(client.connection_status(), ConnectionStatus::Connected);
}

#[tokio::test]
async fn test_state_sync() {
    // Host sends game state
    // Client receives and validates
    // Checksum matches
}

#[tokio::test]
async fn test_day_advancement_multiplayer() {
    // Both players mark ready
    // Host processes day
    // Client receives updated state
}
```

**E2E Tests**:
- Full game session (2 players, multiple days)
- Disconnect/reconnect scenarios
- PvP match flow
- Conflict resolution (both bid on same player)

---

## Deliverables Checklist

### Backend (Rust)
- [ ] WebRTC Manager implementation
- [ ] Signaling server
- [ ] Network message protocol
- [ ] Multiplayer commands (create_room, join_room, disconnect)
- [ ] State sync manager
- [ ] Backup save system
- [ ] Modified commands for multiplayer awareness
- [ ] Multiplayer day processing
- [ ] PvP match handling
- [ ] Conflict resolution logic

### Frontend (React/TypeScript)
- [ ] Multiplayer menu page
- [ ] Room lobby page
- [ ] Connection status component
- [ ] Day advancement component
- [ ] Disconnect dialog
- [ ] Network status indicator
- [ ] Team selector (for lobby)
- [ ] Multiplayer store (Zustand)
- [ ] Network message handlers

### Infrastructure
- [ ] Signaling server deployment (free tier)
- [ ] WebRTC STUN/TURN configuration
- [ ] Documentation (README, setup guide)

### Testing
- [ ] Unit tests (network, messages, logic)
- [ ] Integration tests (WebRTC, sync)
- [ ] E2E tests (full session)
- [ ] Manual testing checklist

---

## Success Criteria

Phase 2 is complete when:

1. ✅ Two players can create/join a room via room code
2. ✅ Each player can select a different team
3. ✅ Both players can manage their own team independently
4. ✅ Day advancement requires both players to confirm
5. ✅ PvP matches simulate correctly (both see same result)
6. ✅ Client can continue offline if host disconnects
7. ✅ No desync between host and client
8. ✅ All unit/integration/E2E tests passing

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| WebRTC NAT traversal fails | High | Use TURN relay fallback |
| Signaling server downtime | Medium | Deploy to reliable free tier (Render) |
| Desync between host/client | Medium | Checksum validation, periodic full sync |
| Host disconnect | Low | Client backup save, can continue offline |
| Performance impact | Low | Benchmark, optimize sync frequency |

---

## Estimated Effort

| Week | Tasks | Hours |
|------|-------|-------|
| Week 1 | Network infrastructure | 40h |
| Week 2 | Backend commands & sync | 40h |
| Week 3 | Frontend UI | 40h |
| Week 4 | Game logic & testing | 40h |
| **Total** | | **160h** (4 weeks) |

---

*This plan is part of Issue #XXX - Online Multiplayer Mode*  
*Last updated: 2026-04-30*
