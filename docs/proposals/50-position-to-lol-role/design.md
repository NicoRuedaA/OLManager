# Design: Replace Position Enum with LoL Role Enum

## Technical Approach

Consolidate the domain model from 19 football-specific positions to 5 LoL roles (+ Unknown) by replacing the `Position` enum with the existing `LolRole` enum across the entire stack. This eliminates the need for ad-hoc position-to-role mapping functions and aligns the codebase with the LoL esports management gameplay.

The approach follows a **destructive consolidation** strategy: remove `Position` enum entirely, migrate all usages to `LolRole`, update serialization for backward compatibility, and simplify rating algorithms from 19 position-specific weight maps to 5 role-specific maps.

## Architecture Decisions

### Decision 1: Consolidate on Existing LolRole Enum

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Use existing `LolRole` from `domain::stats` | Minimal changes to engine; already used in match stats | ✅ **CHOSEN** |
| Create new unified Role enum | More work; creates third enum variant | Rejected - unnecessary complexity |
| Keep both enums with mapping | Maintains tech debt we're eliminating | Rejected - defeats purpose |

**Rationale**: The `LolRole` enum already exists, is used by the match engine, and has the correct 5 variants plus Unknown for edge cases. No need to reinvent.

### Decision 2: Remove Position Enum Completely (Not Deprecate)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Delete Position enum entirely | Breaking change forces complete migration | ✅ **CHOSEN** |
| Mark Position deprecated, keep both | Allows gradual migration; more code maintenance | Rejected - prolongs the pain |
| Keep Position for saves only | Database migration handles this better | Rejected - adds complexity |

**Rationale**: A clean break is better than lingering technical debt. The compiler will enforce complete migration.

### Decision 3: Database Migration via Serde Deserialization

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Custom deserializer mapping old Position strings | Handles migration transparently | ✅ **CHOSEN** |
| SQL migration script | Requires db version tracking; risky for existing saves | Rejected - too invasive |
| Manual save upgrade tool | User friction; easy to miss saves | Rejected - poor UX |

**Rationale**: Implement a custom `Deserialize` implementation for `LolRole` that accepts both old Position strings (mapped to roles) and new LolRole strings. Transparent to users.

### Decision 4: Player Rating Algorithm Simplification

| Option | Tradeoff | Decision |
|--------|----------|----------|
| 5 role-specific weight maps | Dramatically simpler; 14 fewer weight maps | ✅ **CHOSEN** |
| Keep granular position weights | More accurate but complex; not needed for LoL | Rejected - over-engineering |
| Dynamic weight calculation | Flexible but adds runtime complexity | Rejected - YAGNI |

**Rationale**: LoL gameplay doesn't need the granularity of 19 positions. 5 well-tuned role maps provide sufficient depth while dramatically simplifying the code.

### Decision 5: Remove Side-Based Penalties (Left/Right)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Remove footedness/weak-foot penalties entirely | Simplifies code; LoL roles are lane-agnostic | ✅ **CHOSEN** |
| Keep penalties for flavor | Adds complexity without gameplay value | Rejected - unnecessary |
| Replace with role-specific penalties | Could work but needs design | Rejected - out of scope |

**Rationale**: LoL roles don't have a "left/right" concept like football positions. The penalty system doesn't translate meaningfully.

### Decision 6: Engine Position Enum Unification

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Replace engine `Position` with `LolRole` | Single enum across domain and engine | ✅ **CHOSEN** |
| Keep engine Position as 4-variant | Requires mapping layer | Rejected - adds friction |
| Merge engine Position into domain LolRole | Clean but more changes | Considered - same as option 1 |

**Rationale**: The engine's 4-variant Position enum (Goalkeeper, Defender, Midfielder, Forward) is an artifact of the football engine. Replace with LolRole for consistency.

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA FLOW: Player Role                         │
└─────────────────────────────────────────────────────────────────────┘

Legacy Save File
       │
       │ (JSON with old Position strings)
       ▼
┌──────────────┐     Custom Deserialize     ┌──────────────┐
│   Database   │ ─────────────────────────► │  LolRole     │
│   Layer      │  (Position→LolRole map)    │  Enum        │
└──────────────┘                            └──────────────┘
       │                                           │
       │                                           │
       ▼                                           ▼
┌──────────────┐                          ┌──────────────┐
│  Domain      │◄─────────────────────────│  Player      │
│  (player.rs) │     LolRole fields       │  Struct      │
└──────────────┘                          └──────────────┘
       │
       │ Role-based OVR calculation
       ▼
┌──────────────┐     Role weights         ┌──────────────┐
│  Rating      │◄─────────────────────────│  5 role      │
│  Engine      │                          │  weight maps │
│  (player_    │                          └──────────────┘
│  rating.rs)  │
└──────────────┘
       │
       │ Serialized as string
       ▼
┌──────────────┐     JSON/Tauri API       ┌──────────────┐
│  Commands    │────────────────────────►│  Frontend    │
│  Layer       │  (LolRole string)        │  (TS types)  │
└──────────────┘                          └──────────────┘
       │                                           │
       │                                           │
       ▼                                           ▼
┌──────────────┐                          ┌──────────────┐
│  Live Match  │                          │  UI Display  │
│  Engine      │                          │  (badges,    │
│  (engine)    │                          │  filters)    │
└──────────────┘                          └──────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src-tauri/crates/domain/src/player.rs` | Modify | Remove `Position` enum; change `position`, `natural_position`, `alternate_positions` to `LolRole` |
| `src-tauri/crates/domain/src/stats.rs` | Modify | Add custom `Deserialize` for `LolRole` handling legacy Position strings |
| `src-tauri/crates/domain/src/team.rs` | Modify | Update `TeamComposition::position_rows()` to return `Vec<Vec<LolRole>>` |
| `src-tauri/crates/engine/src/types.rs` | Modify | Replace `Position` enum with `LolRole`; update `PlayerData`, `TeamData` |
| `src-tauri/crates/ofm_core/src/player_rating.rs` | Modify | Replace 19 position weight maps with 5 role maps; remove side-based penalties |
| `src-tauri/crates/ofm_core/src/live_match_manager/team_builder.rs` | Modify | Remove `map_position_to_lol_role`; use `LolRole` directly |
| `src-tauri/src/application/time_blockers.rs` | Modify | Delete `lol_role_for_position` function |
| `src-tauri/src/commands/squad.rs` | Modify | Update default position literals to LolRole variants |
| `src-tauri/src/commands/world.rs` | Modify | Update player generation position assignments |
| `src-tauri/crates/db/src/entities/player.rs` | Modify | Ensure `LolRole` serializes to string correctly |
| `src/store/types.ts` | Modify | Update `PlayerData.position` to `LolRole` union type |
| `src/lib/playerRating.ts` | Modify | Replace 19-position logic with 5-role weights; remove position helpers |
| `src/components/squad/SquadTab.helpers.ts` | Modify | Update `getLolRoleFromPosition` → direct `LolRole` usage |
| `src/lib/lolIdentity.ts` | Modify | Simplify role resolution (now direct) |
| `src/utils/backendI18n.ts` | Modify | Add role translation keys: `role.top`, `role.jungle`, etc. |
| `public/locales/*/common.json` | Modify | Add LoL role translations |
| `src-tauri/crates/ofm_core/tests/` | Modify | Update all test fixtures to use `LolRole` |

## Interfaces / Contracts

### Rust: Player Struct Changes

```rust
// BEFORE (player.rs)
pub struct Player {
    pub position: Position,                    // 19-variant enum
    pub natural_position: Position,
    pub alternate_positions: Vec<Position>,
}

// AFTER (player.rs)
pub struct Player {
    pub position: LolRole,                     // 6-variant enum (5 + Unknown)
    pub natural_position: LolRole,
    pub alternate_positions: Vec<LolRole>,
}
```

### Rust: LolRole with Backward Compatibility

```rust
// stats.rs - Custom deserialization for migration
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum LolRole {
    Top,
    Jungle,
    Mid,
    Adc,
    Support,
    #[default]
    Unknown,
}

// Custom deserialize implementation handles legacy Position strings:
// "Goalkeeper" | "DefensiveMidfielder" → Support
// "Defender" | "RightBack" | "LeftBack" | "CenterBack" | "WingBacks" → Top
// "Midfielder" | "CentralMidfielder" → Jungle
// "AttackingMidfielder" | "RightMidfielder" | "LeftMidfielder" → Mid
// "Forward" | "Striker" | "RightWinger" | "LeftWinger" → Adc
```

### TypeScript: PlayerData Type Update

```typescript
// BEFORE
export interface PlayerData {
  position: string;  // 19 possible football positions
  natural_position: string;
  alternate_positions: string[];
}

// AFTER
export type LolRole = "Top" | "Jungle" | "Mid" | "ADC" | "Support" | "Unknown";

export interface PlayerData {
  position: LolRole;
  natural_position: LolRole;
  alternate_positions: LolRole[];
}
```

### Role-Specific Weight Maps (5 instead of 19)

```rust
// player_rating.rs - NEW simplified weights
fn weighted_score_for_role(player: &Player, role: &LolRole) -> f64 {
    let attrs = &player.attributes;
    match role {
        LolRole::Top => weighted_average(&[          // Frontline tank
            (attrs.defending, 22),
            (attrs.strength, 18),
            (attrs.tackling, 16),
            (attrs.positioning, 14),
            (attrs.stamina, 12),
            (attrs.passing, 10),
            (attrs.decisions, 8),
        ]),
        LolRole::Jungle => weighted_average(&[       // Map control
            (attrs.decisions, 20),
            (attrs.vision, 16),
            (attrs.positioning, 14),
            (attrs.stamina, 14),
            (attrs.tackling, 12),
            (attrs.passing, 12),
            (attrs.strength, 8),
            (attrs.dribbling, 4),
        ]),
        LolRole::Mid => weighted_average(&[          // Playmaker
            (attrs.vision, 22),
            (attrs.passing, 18),
            (attrs.decisions, 16),
            (attrs.dribbling, 12),
            (attrs.positioning, 10),
            (attrs.shooting, 10),
            (attrs.stamina, 8),
            (attrs.teamwork, 4),
        ]),
        LolRole::Adc => weighted_average(&[          // Damage carry
            (attrs.shooting, 24),
            (attrs.positioning, 18),
            (attrs.decisions, 14),
            (attrs.dribbling, 12),
            (attrs.pace, 12),
            (attrs.vision, 10),
            (attrs.composure, 6),
            (attrs.stamina, 4),
        ]),
        LolRole::Support => weighted_average(&[      // Enabler
            (attrs.vision, 20),
            (attrs.positioning, 18),
            (attrs.teamwork, 16),
            (attrs.passing, 14),
            (attrs.decisions, 14),
            (attrs.tackling, 10),
            (attrs.stamina, 8),
        ]),
        LolRole::Unknown => player.overall(),  // Fallback to mean
    }
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| **Unit** | Legacy Position → LolRole deserialization | Test each of the 19 legacy positions maps to correct role |
| **Unit** | Role-based OVR calculation | Verify each role uses correct weights; test boundary conditions |
| **Unit** | Compatibility penalty logic | Primary role = 0, alternate = 4.0, different role = 14.0 |
| **Integration** | Full player save/load cycle | Create player with Position, save, load, verify LolRole |
| **Integration** | Squad building with roles | Verify role coverage detection works with 5 roles |
| **E2E** | Frontend role display | Verify badges render correct colors; filters work |
| **E2E** | Rating display accuracy | Compare pre/post migration OVR values for same player attrs |

### Critical Test Cases

```rust
// Test: Legacy position deserialization
#[test]
fn legacy_striker_maps_to_adc() {
    let json = r#""Striker""#;
    let role: LolRole = serde_json::from_str(json).unwrap();
    assert_eq!(role, LolRole::Adc);
}

#[test]
fn legacy_goalkeeper_maps_to_support() {
    let json = r#""Goalkeeper""#;
    let role: LolRole = serde_json::from_str(json).unwrap();
    assert_eq!(role, LolRole::Support);
}

#[test]
fn new_lolrole_string_deserializes_directly() {
    let json = r#""Top""#;
    let role: LolRole = serde_json::from_str(json).unwrap();
    assert_eq!(role, LolRole::Top);
}
```

## Migration Plan

### Phase 1: Backend Domain (Day 1-2)
1. Update `LolRole` with custom deserializer for legacy positions
2. Remove `Position` enum from `player.rs`
3. Update `Player` struct fields to use `LolRole`
4. Fix compilation errors in dependent crates

### Phase 2: Rating Engine (Day 2-3)
1. Replace 19 position weight maps with 5 role maps
2. Remove side-based penalty logic
3. Update all rating functions to accept `LolRole`
4. Update tests

### Phase 3: Engine & Commands (Day 3-4)
1. Replace engine `Position` with `LolRole`
2. Remove `map_position_to_lol_role` functions
3. Update command handlers
4. Update world generation

### Phase 4: Frontend (Day 4-5)
1. Update TypeScript types to use `LolRole` union
2. Replace position helpers with role helpers
3. Update i18n keys
4. Update UI components (badges, filters)

### Phase 5: Data Migration (Day 5-6)
1. Test save file migration on sample data
2. Verify OVR calculations produce reasonable values
3. Run full test suite
4. Manual QA on squad management UI

### Rollback Plan

If critical issues are found post-deployment:

1. **Immediate**: Revert the enum change via git revert
2. **Data**: Existing saves will have `LolRole` strings that won't deserialize to old `Position` enum - this is a one-way migration
3. **Mitigation**: Before merging, create backup branch and run extended QA

**Note**: This is intentionally a one-way migration. The only rollback is reverting code before deployment. Once deployed to users, old saves cannot be restored to Position-based format without data loss.

## Open Questions

- [ ] **Weight tuning**: Are the proposed role weights balanced? Need gameplay testing.
- [ ] **Unknown role handling**: What happens when a player's role is Unknown? Fallback logic needed.
- [ ] **Team composition validation**: Should we enforce exactly 5 roles per team (one of each)?
- [ ] **Champion training**: Currently uses position-based logic - update to role-based?

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing saves | High | Critical | Custom deserializer handles legacy Position strings transparently |
| Player rating imbalance | Medium | High | Carefully tune 5 role weight maps; run simulation tests before release |
| Compilation errors in 752+ locations | High | Medium | Fix systematically by crate; compiler guides remaining issues |
| Frontend type mismatches | Medium | Medium | TypeScript will catch most issues; manual review of helper functions |
| Loss of gameplay depth | Medium | Medium | Intentional simplification - 5 roles is sufficient for LoL gameplay |
| Migration edge cases (e.g., custom positions) | Low | Medium | Comprehensive test suite covering all 19 position mappings |
| User confusion from role name changes | Low | Low | Clear UI labels and tooltips; i18n strings updated |
| Performance regression | Low | Low | Simpler code = likely faster; profile if issues arise |

---

**Size Budget Check**: This document is approximately 1,200 words. The critical sections (Architecture Decisions as tables, File Changes, Testing Strategy) are concise while still capturing necessary technical detail.
