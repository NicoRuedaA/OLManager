# Multiplayer Architecture Compatibility Analysis Report

## Executive Summary

**Overall Risk Assessment: MEDIUM-HIGH**

The proposed multiplayer changes are **NOT 100% backward compatible** with the existing single-player architecture. While the serialization system is well-designed for forward compatibility, the codebase has **pervasive single-player assumptions** that require significant refactoring.

---

## 1. Breaking Change Risk Assessment

### 1.1 Game Struct Serialization - Risk: LOW

**Current State:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Game {
    pub clock: GameClock,
    pub manager: Manager,  // <-- Single player assumption
    pub teams: Vec<Team>,
    // ... other fields with #[serde(default)]
}
```

**Why LOW Risk:**
- Uses `#[serde(default)]` extensively for backward compatibility
- Old saves WILL load with new struct if new fields have `#[serde(default)]`
- New saves with extra `player2_manager: Option<Manager>` would be readable by old code (field ignored)

**Concern:**
- Serialization is safe, but GAMEPLAY logic assumes only ONE manager

### 1.2 Database Schema - Risk: MEDIUM

**Current State:**
- `game_meta` table stores ONE manager_id (line 7 of v001_initial_schema.sql)
- 28 migrations exist using ALTER TABLE pattern
- Manager table has single-row-per-manager design

**Migration Required:**
```sql
-- V29 would need:
ALTER TABLE game_meta ADD COLUMN player2_manager_id TEXT;
```

**Why MEDIUM Risk:**
- Migration system is mature (rusqlite_migration)
- Additive migrations don't break old saves
- But single-row design of game_meta is not ideal for multiple managers

### 1.3 Command Handler Patterns - Risk: HIGH

**Current State:**
```rust
// From time.rs line 86:
let user_team_id = game.manager.team_id.clone().ok_or("No team assigned")?;
```

**142 occurrences** of `game.manager.team_id` access across codebase.

**Why HIGH Risk:**
- Every command assumes SINGLE `game.manager`
- No "current player context" abstraction exists
- Commands would need refactoring for `manager_id` parameter
- Tauri command signatures don't include player identification

**Commands Affected:**
- `advance_time`, `set_formation`, `make_transfer_bid`, `start_live_match`, `skip_to_match_day`

### 1.4 Game Loop (`process_day()`) - Risk: HIGH

**Critical Findings in turn/mod.rs:**

1. **Line 242-244**: Academy tied to `game.manager.team_id`
2. **Line 560-562**: Parallel academy leagues tied to manager
3. **Line 65-70**: Match detection assumes single player context

**Single-Player Assumptions:**
- `finances::process_weekly_finances(game)` - for manager's team only
- `transfers::generate_incoming_transfer_offers(game)` - for manager's team
- `firing::check_manager_firing(game)` - checks THE manager
- `job_offers::check_job_offers(game)` - for THE manager
- `board_objectives::generate_objectives(game)` - for manager's team

**Why HIGH Risk:**
- `process_day()` assumes single human manager context
- Multiple players need their own processing loops
- Academy, transfers, finances all tied to single manager.team_id

### 1.5 Match Simulation - Risk: MEDIUM

**Current State:**
```rust
fn simulate_matchday_with_capture<F>(game: &mut Game, today: &str, ...) {
    simulate_other_matches_with_capture(game, today, None, on_capture);
}
```

**Why MEDIUM Risk:**
- Match engine (`engine::simulate`) is pure function - no player assumptions
- Can simulate any two teams
- BUT `simulate_other_matches` skips "user's" match - assumes single user fixture

### 1.6 Frontend State Management - Risk: MEDIUM

**Current State:**
```typescript
interface GameStateData {
  manager: {  // Single manager object
    id: string;
    team_id: string | null;
  };
}
```

**Why MEDIUM Risk:**
- `GameStateData.manager` is single object, not array
- Frontend assumes single manager throughout UI
- BUT TypeScript allows adding `player2_manager?: ManagerData` non-breakingly

### 1.7 Existing Multi-Entity Patterns - Reference

**Already Handles:**
- Multiple teams with `team.manager_id` (nullable)
- Multiple players, staff, messages, news
- AI teams have `team.manager_id = None`

**Pattern:**
```rust
// When team.manager_id == game.manager.id, it's "your" team
```

---

## 2. Serialization Compatibility Summary

### Old Saves with New Game Struct
**Status: COMPATIBLE** (with `#[serde(default)]`)

Adding `player2_manager: Option<Manager>` with `#[serde(default)]`:
- Old saves load: Missing field → `None` (default)
- Old code reading new saves: Extra field ignored

### New Saves with Old Code
**Status: COMPATIBLE**

Serde ignores unknown fields by default. Old code reading save with `player2_manager` will:
- Load successfully
- Ignore the extra field
- Work as single-player game

---

## 3. Database Migration Needed?

**YES - Migration V29 Required**

```sql
-- Option A: Add column to game_meta (minimal change)
ALTER TABLE game_meta ADD COLUMN player2_manager_id TEXT;

-- Option B: Create new table for multiplayer saves (cleaner)
CREATE TABLE save_players (
    save_id TEXT NOT NULL,
    player_index INTEGER NOT NULL,
    manager_id TEXT NOT NULL,
    team_id TEXT NOT NULL,
    PRIMARY KEY (save_id, player_index)
);
```

**Migration Pattern to Follow:**
See existing migrations in `crates/db/src/sql/v*.sql` - all use additive changes.

---

## 4. Command Contract Analysis

### Current Tauri Command Signatures
```rust
#[tauri::command]
pub fn advance_time(state: State<'_, StateManager>) -> Result<Game, String>

#[tauri::command]
pub fn set_formation(
    state: State<'_, StateManager>,
    formation: String,
) -> Result<Game, String>
```

### Multiplayer Requires
```rust
#[tauri::command]
pub fn advance_time(
    state: State<'_, StateManager>,
    manager_id: String,  // NEW PARAMETER
) -> Result<Game, String>
```

**Breaking Change?** 
- Adding parameter IS breaking for frontend calls
- But can be mitigated with default/optional parameters

---

## 5. Game Loop Assumptions Deep Dive

### `process_day()` Single-Player Assumptions Found:

1. **Line 55-111**: No player context parameter
2. **Line 242**: `game.manager.team_id` for academy
3. **Line 339-341**: Academy player filtering by manager's team
4. **Line 388-392**: Main team comparison to academy
5. **Line 560-562**: Parallel league processing by manager
6. **Line 608-622**: Academy league rebuild by manager

### Functions Requiring Multiplayer Refactor:
- `process_day()` → needs `manager_id` parameter
- `process_weekly_finances()` → needs team filter
- `generate_incoming_transfer_offers()` → needs team filter
- `check_manager_firing()` → needs manager context
- `check_job_offers()` → needs manager context
- All academy functions → need player context

---

## 6. Safe Implementation Path

### Phase 1: Non-Breaking Foundation (Safe)
1. Add `player2_manager: Option<Manager>` to Game struct with `#[serde(default)]`
2. Create V29 migration (additive only)
3. Update `GamePersistenceReader` to load both managers (old code ignores new field)
4. Add TypeScript `player2_manager?: ManagerData` (optional)

### Phase 2: Abstraction Layer (Non-Breaking)
1. Create `PlayerContext` struct to wrap manager + team
2. Refactor commands to accept `Option<manager_id>` - default to `game.manager`
3. Add `current_player_index` to Game struct
4. Frontend: Add player switching UI (behind feature flag)

### Phase 3: Multiplayer Logic (Breaking without flag)
1. Refactor `process_day()` to iterate over players
2. Update match simulation to handle multiple human fixtures
3. Enable multiplayer mode only via feature flag/new game type

### Phase 4: Full Release
1. Enable multiplayer UI when `player2_manager.is_some()`
2. Remove feature flag

---

## 7. Rollback Strategy

### If Database Migration Breaks:
```bash
# Downgrade migration
sqlite3 save.db "PRAGMA user_version = 28;"
```

### If Code Breaks:
1. Revert to commit before multiplayer changes
2. Old code will:
   - Load saves with extra `player2_manager` field (ignored)
   - Work as single-player game
   - Not corrupt saves

### Save Corruption Prevention:
- Always use `#[serde(default)]` on new fields
- Keep `manager` field as primary (backward compatibility)
- New saves remain loadable by old code

---

## 8. Key Recommendations

### DO:
1. Use `#[serde(default)]` on ALL new fields
2. Keep `game.manager` as the "primary" player for backward compatibility
3. Add `player2_manager: Option<Manager>` as secondary
4. Create abstraction layer for "current player context"
5. Use feature flag for multiplayer UI
6. Add migration tests before releasing

### DON'T:
1. Change `game.manager` type (would break everything)
2. Remove `manager` field from GameStateData
3. Require player_id parameter in commands immediately (add as optional first)
4. Refactor game loop without extensive testing

### CONSIDER:
1. **Hotseat Mode**: Players take turns on same machine (simpler than networked)
2. **AI for Player 2**: Let player 2 be AI-controlled initially
3. **New Game Type**: Create separate "MultiplayerGame" mode instead of retrofitting

---

## 9. Conclusion

**The architecture CAN support multiplayer, but:**

1. **Serialization**: Safe with `#[serde(default)]` pattern
2. **Database**: Safe with additive migrations
3. **Game Loop**: Requires significant refactoring (142+ touch points)
4. **Commands**: Need abstraction layer for player context
5. **Frontend**: Needs new state management for multiple managers

**Estimated Effort:**
- Phase 1 (Foundation): 2-3 days
- Phase 2 (Abstraction): 1-2 weeks
- Phase 3 (Multiplayer Logic): 2-3 weeks
- Phase 4 (Polish): 1 week

**Total: 5-7 weeks** for proper multiplayer support without breaking single-player.

---

## 10. Critical Files Requiring Changes

**Core:**
- `crates/ofm_core/src/game.rs` - Add player2_manager field
- `crates/ofm_core/src/turn/mod.rs` - Refactor process_day
- `crates/ofm_core/src/state.rs` - Add player context

**Database:**
- `crates/db/src/sql/v029_multiplayer.sql` - New migration
- `crates/db/src/migrations.rs` - Add migration
- `crates/db/src/game_persistence.rs` - Load/save player2

**Commands:**
- `src-tauri/src/commands/*.rs` - Add player context
- `src-tauri/src/lib.rs` - Update command signatures

**Frontend:**
- `src/store/types.ts` - Add player2_manager
- `src/store/gameStore.ts` - Handle multiple managers
- All components using `gameState.manager` - Add player selection

---

*Report generated from analysis of OLManager codebase*
