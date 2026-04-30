# RFC: Online Multiplayer Mode (2 Players)

**Status**: `Draft`  
**Created**: 2026-04-30  
**Author**: @nicodembus  
**Type**: Feature Proposal  
**Priority**: Medium  
**Labels**: `enhancement`, `multiplayer`, `RFC`

---

## Executive Summary

Implementar un modo online para 2 jugadores donde cada jugador controla un equipo diferente en la misma partida, manteniendo 100% de compatibilidad con el modo single-player existente.

**Propuesta en 2 fases:**
1. **Fase 1 (Foundation)**: ✅ COMPLETADA - Estructura de datos + persistencia
2. **Fase 2 (Online P2P)**: 2 jugadores conectados vía WebRTC (cada uno en su PC)

---

## Problem Statement

### Current State
- El juego soporta **UN SOLO manager** por partida
- Toda la arquitectura asume un único jugador humano
- No existe forma de jugar contra otro humano

### User Need
- Poder jugar contra un amigo en la misma partida
- Cada jugador controla SU equipo (gestión, fichajes, tácticas)
- Mantener las mismas mecánicas del single-player
- Avance de días sincronizado (ambos deben confirmar)

---

## Proposed Solution

### Core Architecture

```rust
// crates/ofm_core/src/game.rs
pub struct Game {
    // Existing (UNCHANGED)
    pub clock: GameClock,
    pub manager: Manager,           // Player 1 (backward compatible)
    pub teams: Vec<Team>,
    // ...
    
    // NEW (Additive, with #[serde(default)])
    #[serde(default)]
    pub player2_manager: Option<Manager>,
    
    #[serde(default)]
    pub multiplayer_mode: MultiplayerMode,  // Offline | Hotseat | Online
    
    #[serde(default)]
    pub player1_day_ready: bool,
    
    #[serde(default)]
    pub player2_day_ready: bool,
}

pub enum MultiplayerMode {
    Offline,    // Single-player (default)
    Hotseat,    // Local, same machine
    Online,     // P2P networked
}
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Keep `game.manager`** | 142+ usages throughout codebase - changing breaks everything |
| **Add `player2_manager: Option<Manager>`** | Additive, backward compatible, serde-safe |
| **Host-authoritative** | Simplifies sync, prevents conflicts |
| **Day readiness system** | Both players must confirm before advancing |
| **Feature flag** | Single-player unaffected, can toggle on/off |

---

## Compatibility Analysis

### ✅ Backward Compatible

| Area | Status | Notes |
|------|--------|-------|
| Serialization | ✅ Safe | `#[serde(default)]` on all new fields |
| Database | ✅ Safe | Additive migration (ALTER TABLE ADD COLUMN) |
| Existing saves | ✅ Load correctly | Missing fields → `None` (default) |
| Old code reading new saves | ✅ Works | Serde ignores unknown fields |

### ⚠️ Requires Refactoring

| Area | Risk | Effort |
|------|------|--------|
| Command handlers | Medium | ~15 commands need player context |
| `process_day()` | Medium | Needs to process both managers |
| Transfer system | Low | Add bidding visibility |
| Frontend UI | Medium | Add player selector, status |

---

## Implementation Plan

### Phase 1: Foundation (Non-Breaking) ✅ COMPLETADA
**Duration**: 2-3 días  
**Risk**: None  
**Status**: ✅ **DONE** (branch `online-mvp`)

- [x] Add `player2_manager: Option<Manager>` to `Game` struct
- [x] Add `multiplayer_mode` enum
- [x] Add `player1_day_ready` / `player2_day_ready` flags
- [x] Create database migration V29 (additive only)
- [x] Update serde serialization tests
- [x] 7 unit tests passing, 4 migration tests passing

### Phase 2: Online P2P Mode
**Duration**: 3-4 semanas  
**Risk**: Medium

#### 2.1 Network Infrastructure
- [ ] WebRTC integration (`webrtc-rs` crate) - P2P directo entre jugadores
- [ ] Signaling server (HTTP simple) - Solo para handshake inicial
- [ ] Room code system - Crear/unirse con código de 6 dígitos
- [ ] Connection management - Reconexión, timeout, disconnect handling

#### 2.2 Host-Client Architecture
- [ ] Host: ejecuta lógica de juego, guarda partida
- [ ] Client: envía acciones, recibe estado actualizado
- [ ] State sync: Host → Client después de cada acción
- [ ] Action forwarding: Client → Host para todas las acciones
- [ ] Backup save en Client: por si Host se desconecta

#### 2.3 Frontend UI Components

**Multiplayer Menu**:
```
┌─────────────────────────────────────────────────┐
│  Multiplayer                                    │
│                                                 │
│  [Create Online Room]                           │
│                                                 │
│  Room Code: _____  [Join Room]                  │
│                                                 │
│  ─────────────────────────────────────────────  │
│  Or play single-player [Back]                   │
└─────────────────────────────────────────────────┘
```

**Room Lobby (Host)**:
```
┌─────────────────────────────────────────────────┐
│  Room: ABC123 (Waiting for opponent...)         │
│                                                 │
│  Your Team: [Select Team ▼]                     │
│                                                 │
│  Opponent: Not connected yet...                 │
│                                                 │
│  Room Code: ABC123 (Share with friend)          │
│  [Copy] [Cancel]                                │
└─────────────────────────────────────────────────┘
```

**Room Lobby (Client)**:
```
┌─────────────────────────────────────────────────┐
│  Joining room: ABC123...                        │
│                                                 │
│  Host: PlayerName                               │
│  Their Team: Fnatic                             │
│                                                 │
│  Your Team: [Select Team ▼]                     │
│  (Cannot select Fnatic - already chosen)        │
│                                                 │
│  [Join Game] [Cancel]                           │
└─────────────────────────────────────────────────┘
```

**Connection Status (In-Game)**:
```
┌─────────────────────────────────────────────────┐
│  Day 15  |  🟢 Opponent connected              │
└─────────────────────────────────────────────────┘

Or if disconnected:
┌─────────────────────────────────────────────────┐
│  Day 15  |  🔴 Opponent disconnected            │
│                                                 │
│  Game saved locally. You can:                  │
│  - [Continue Offline]                           │
│  - [Wait for Reconnection]                      │
└─────────────────────────────────────────────────┘
```

#### 2.4 Game Logic Modifications
- [ ] Day advancement: Ambos jugadores deben marcar "Ready"
- [ ] Host procesa `process_day()` y sync a Client
- [ ] PvP matches: Host simula, ambos ven mismo resultado
- [ ] Transfer market: Ambos ven todas las ofertas
- [ ] Staff hiring: Lock cuando un jugador hace oferta
- [ ] Conflict resolution: Host tiene autoridad final

#### 2.5 Tauri Commands (New)
```rust
// Network
#[tauri::command]
pub fn multiplayer_create_room() -> Result<String, String>  // Returns room code
#[tauri::command]
pub fn multiplayer_join_room(code: String) -> Result<(), String>
#[tauri::command]
pub fn multiplayer_disconnect() -> Result<(), String>

// Game state sync (Host → Client)
#[tauri::command]
pub fn multiplayer_sync_state() -> Result<Game, String>

// Day readiness (both players)
#[tauri::command]
pub fn mark_day_ready() -> Result<Game, String>
// Modified to work for both host and client
```

### Phase 3: Polish & Release
**Duration**: 1 semana  
**Risk**: Low

- [ ] Testing (network conditions, edge cases)
- [ ] Documentation
- [ ] Remove feature flag
- [ ] Release notes

---

## Technical Details

### Day Advancement Flow

```
┌─────────────┐                    ┌─────────────┐
│  Player 1   │                    │  Player 2   │
│  Clicks     │                    │  Clicks     │
│  "Continue" │                    │  "Continue" │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       ▼                                  ▼
┌─────────────────────────────────────────────────┐
│                    HOST                         │
│  Receives: ready_to_advance(player: 1)          │
│  Receives: ready_to_advance(player: 2)          │
│                                                 │
│  Check: player1_ready && player2_ready = TRUE   │
│  Execute: process_day()                         │
│  Sync: Send new game state to both              │
└─────────────────────────────────────────────────┘
       │                                  │
       ▼                                  ▼
┌─────────────┐                    ┌─────────────┐
│  Player 1   │                    │  Player 2   │
│  Sees:      │                    │  Sees:      │
│  "Day 15"   │                    │  "Day 15"   │
└─────────────┘                    └─────────────┘
```

### PvP Match Flow

```
1. Host detects: Team1 vs Team2 scheduled today
2. Host pauses day advancement
3. Both clients: Show "Opponent wants to play" dialog
4. Both confirm → Host starts match simulation
5. Host: engine::simulate(team1, team2, config)
6. Host: Apply result (same for both)
7. Both: See match report
8. Host: Resume day flow
```

### Conflict Resolution Matrix

| Conflict | Resolution |
|----------|------------|
| Both bid on same player | Highest bid wins, both see all offers |
| Both hire same staff | First offer gets 24h (game days) to decide |
| Both want free agent | Priority rotation (alternates daily) |
| Squad management | Isolated - each manages their own team |
| Tactics/formation | Isolated - team-specific data |
| Finances | Isolated - separate budgets |

---

## Database Migration

### V29: Multiplayer Support

```sql
-- Add player2_manager reference
ALTER TABLE game_meta ADD COLUMN player2_manager_id TEXT;

-- Add multiplayer mode
ALTER TABLE game_meta ADD COLUMN multiplayer_mode TEXT DEFAULT 'offline';

-- Add day readiness flags (transient, not persisted)
-- These are runtime-only, reset each day
```

---

## Network Architecture (Online Mode)

```
┌─────────────────────────────────────────┐
│              HOST                       │
│  Frontend ◄─► Backend (Rust) ◄─► WebRTC │
│  (React)      (Tauri)         (P2P)    │
│                     │                   │
│                     ▼                   │
│              SAVE SYSTEM                │
│           (SQLite - authoritative)      │
└─────────────────────────────────────────┘
              ▲       ▲
              │       │ WebRTC Data Channel
              │       │ (state sync)
              ▼       ▼
┌─────────────────────────────────────────┐
│              CLIENT (JOINER)            │
│  Frontend ◄─► Backend (Rust) ◄─► WebRTC │
│  (React)      (Tauri)         (P2P)    │
│                                         │
│  (Local backup save for disconnect)     │
└─────────────────────────────────────────┘

        ┌─────────────────────┐
        │ SIGNALING SERVER    │
        │ (HTTP/WebSocket)    │
        │ - Create room       │
        │ - Exchange SDP      │
        │ - Room code lookup  │
        └─────────────────────┘
```

### Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| P2P Protocol | WebRTC (`webrtc-rs`) | Industry standard, NAT traversal |
| Async Runtime | `tokio` | Already in use, mature |
| Serialization | `serde_json` | Existing, well-tested |
| Signaling | Simple HTTP server | Minimal, only for handshake |

---

## Frontend Changes

### New State (gameStore.ts)

```typescript
interface GameStateData {
  // Existing
  manager: ManagerData;
  // NEW
  player2_manager?: ManagerData;
  multiplayer_mode: 'offline' | 'hotseat' | 'online';
  current_player: 1 | 2;
  is_my_turn: boolean;
  opponent_ready: boolean;
  connection_status: 'disconnected' | 'connecting' | 'connected';
}
```

### New UI Components

- `PlayerSelector` - Switch between players (hotseat)
- `MultiplayerMenu` - Create/join room
- `ConnectionStatus` - Show network state
- `OpponentStatus` - Show if opponent is ready
- `RoomCodeDisplay` - Show room code to share

---

## Testing Strategy

### Unit Tests
- [ ] Serialization/deserialization with new fields
- [ ] Day readiness logic (both players must be ready)
- [ ] Conflict resolution (transfer bidding)

### Integration Tests
- [ ] Hotseat: Both players can complete turns
- [ ] Online: Connection established via WebRTC
- [ ] Online: State sync after day advancement

### E2E Tests
- [ ] Full game session (2 players, multiple days)
- [ ] PvP match simulation
- [ ] Host disconnect → client recovers

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing saves | High | Use `#[serde(default)]`, extensive testing |
| Game loop refactoring bugs | Medium | Feature flag, gradual rollout |
| Network desync | Medium | Host-authoritative, periodic full sync |
| Host disconnect | Low | Client saves backup, can continue offline |
| Conflicts between players | Low | Clear resolution rules, UI shows status |

---

## Success Criteria

- [ ] Single-player mode works exactly as before
- [ ] Two players can start a game, each with their own team
- [ ] Day advancement requires both players to confirm
- [ ] Each player can manage their team independently
- [ ] PvP matches simulate correctly
- [ ] No save corruption or data loss
- [ ] Performance impact < 5%

---

## Alternatives Considered

### Alternative A: `Vec<Manager>`
**Rejected** - Would require refactoring 142+ usages of `game.manager`

### Alternative B: Separate MultiplayerGame Struct
**Rejected** - Code duplication, maintenance burden

### Alternative C: Server-Authoritative (Not P2P)
**Rejected** - Requires dedicated infrastructure, higher cost

---

## Open Questions

1. **Should hotseat be a separate mode or toggle?**
   - Leaning toward toggle (same code path)

2. **Should client save a backup copy?**
   - Leaning toward yes (for host disconnect recovery)

3. **Should transfer bidding be auction-style or first-come?**
   - Leaning toward auction (more engaging)

---

## Appendix: Files to Modify

### Core (Rust)
- `crates/ofm_core/src/game.rs`
- `crates/ofm_core/src/turn/mod.rs`
- `crates/db/src/sql/v029_multiplayer.sql`
- `crates/db/src/migrations.rs`
- `crates/db/src/game_persistence.rs`

### Commands (Rust)
- `src-tauri/src/commands/game.rs`
- `src-tauri/src/commands/time.rs`
- `src-tauri/src/commands/transfers.rs`
- `src-tauri/src/commands/staff.rs`
- `src-tauri/src/lib.rs`

### Frontend (TypeScript)
- `src/store/types.ts`
- `src/store/gameStore.ts`
- `src/pages/MultiplayerMenu.tsx` (new)
- `src/components/ui/PlayerSelector.tsx` (new)

---

## Next Steps

1. **Review & Approve** this RFC
2. **Create tracking issue** with task breakdown
3. **Implement Phase 1** (foundation, non-breaking)
4. **Test Phase 1** thoroughly
5. **Proceed to Phase 2** (hotseat)

---

*This proposal maintains 100% backward compatibility with existing single-player saves and gameplay.*
