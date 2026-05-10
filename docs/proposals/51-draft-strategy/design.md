# Design: Replace PlayStyle enum with LoL DraftStrategy

## Technical Approach

Replace the football‑specific `PlayStyle` enum (6 variants) with a LoL‑themed `DraftStrategy` enum (6 new variants) across the entire stack (Rust backend, TypeScript frontend). The change includes renaming the `Team.play_style` field to `draft_strategy` while preserving backward compatibility via serde aliases. All 173+ Rust references and frontend constants/logic will be updated to use the new enum.

## Architecture Decisions

### Decision: Enum Variant Mapping

**Choice**: Map old variants to new ones as follows:
- Balanced → Balanced
- Attacking → Aggressive
- Defensive → Passive
- Possession → Scaling
- Counter → CounterPick
- HighPress → Aggressive (merge with Attacking)

**Alternatives considered**:
1. Keep HighPress as a separate variant (e.g., `HighPress`).
2. Create a new variant `HighPress` but rename to `AggressivePress`.
3. Merge Attacking and HighPress into `Aggressive` but retain different simulation modifiers.

**Rationale**: The DATA_MIGRATION_PLAN.md already defines this mapping, and the frontend simulation treats both Attacking and HighPress identically for jungle start. Merging simplifies the enum and aligns with LoL draft strategy concepts. Simulation modifiers will be adjusted to preserve the stronger HighPress bonuses for Aggressive.

### Decision: Backward Compatibility via Serde

**Choice**: Use `#[serde(alias = "play_style")]` on the `draft_strategy` field and `#[serde(rename = "...")]` on each variant to keep JSON serialization unchanged (old variant names are preserved).

**Alternatives considered**:
1. Implement custom `Deserialize` that maps old strings to new variants.
2. Break backward compatibility and require a migration script.

**Rationale**: Serde aliases are lightweight, zero‑cost, and allow existing saves to load without modification. The rename ensures the JSON representation stays the same, so the frontend can continue sending/receiving the old strings until it is updated.

### Decision: Engine Mirror Synchronization

**Choice**: Replace `engine::PlayStyle` with `engine::DraftStrategy` that exactly mirrors the domain enum (same variant names, same serde rename attributes).

**Alternatives considered**:
1. Keep the engine enum as `PlayStyle` and convert at the boundary.
2. Use a type alias.

**Rationale**: Having identical enums in both crates eliminates conversion code and prevents drift. The engine already mirrors the domain; we continue that pattern.

## Data Flow

```
Frontend (TypeScript)
    ↓ JSON { "play_style": "Attacking" }
Serde deserialize (alias: draft_strategy, rename: Aggressive)
Domain Team struct (draft_strategy: DraftStrategy::Aggressive)
    ↓ conversion in ofm_core/turn
Engine TeamData (draft_strategy: DraftStrategy::Aggressive)
    ↓ simulation modifiers
Match engine (attack/press/defense phases)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src-tauri/crates/domain/src/team.rs` | Modify | Add `DraftStrategy` enum, rename field, add aliases. |
| `src-tauri/crates/engine/src/types.rs` | Modify | Replace `PlayStyle` with `DraftStrategy`. |
| `src-tauri/crates/engine/src/shared.rs` | Modify | Update `play_style_modifier` match arms for new enum. |
| `src-tauri/crates/ofm_core/src/generator/generation.rs` | Modify | Update `play_style_from_str` mapping. |
| `src-tauri/crates/ofm_core/src/turn/mod.rs` | Modify | Update conversion from domain to engine enum. |
| `src-tauri/crates/ofm_core/src/live_match_manager/team_builder.rs` | Modify | Update conversion. |
| `src-tauri/crates/db/src/repositories/team_repo.rs` | Modify | Update `parse_play_style` mapping. |
| `src-tauri/crates/ofm_core/**/*.rs` (≈170 other files) | Modify | Replace `PlayStyle` with `DraftStrategy` in imports and usage. |
| `src/components/match/types.ts` | Modify | Update `PLAY_STYLES` constant with new IDs/labels. |
| `src/components/match/lol-prototype/engine/simulation.ts` | Modify | Update `style` comparisons and `styleAggro` mapping. |
| `src/components/tactics/TacticsTab.helpers.ts` | Modify | Update `HighPress` reference. |
| `src/components/match/helpers.test.ts` | Modify | Update test data strings. |
| Various test files | Modify | Update test data to use new enum values. |

## Interfaces / Contracts

```rust
// domain/src/team.rs
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub enum DraftStrategy {
    #[default]
    Balanced,
    #[serde(rename = "Attacking")]
    Aggressive,
    #[serde(rename = "Defensive")]
    Passive,
    #[serde(rename = "Possession")]
    Scaling,
    #[serde(rename = "Counter")]
    CounterPick,
    #[serde(rename = "HighPress")]
    PriorityBans, // note: HighPress maps to Aggressive; PriorityBans is new
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Team {
    #[serde(alias = "play_style")]
    pub draft_strategy: DraftStrategy,
    // ... other fields
}
```

```typescript
// src/components/match/types.ts
export const PLAY_STYLES = [
  { id: "Balanced", label: "Balanced" },
  { id: "Aggressive", label: "Aggressive" },
  { id: "Passive", label: "Passive" },
  { id: "Scaling", label: "Scaling" },
  { id: "CounterPick", label: "Counter Pick" },
  { id: "PriorityBans", label: "Priority Bans" },
];
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Enum serialization/deserialization (Rust) | Add serde tests for aliases and renames. |
| Unit | Mapping functions (`play_style_from_str`) | Update existing tests, add new cases. |
| Integration | Domain → engine conversion | Update existing integration tests. |
| Frontend | Simulation modifiers for new enum values | Add Jest tests for `styleAggro` and jungle start. |
| E2E | Load existing save file | Ensure team draft strategy is correctly mapped. |

## Migration / Rollout

No database migration required; serde aliases handle existing JSON. Frontend must be updated simultaneously with backend to avoid mismatch (both shipped in same release). Feature flag not needed.

## Open Questions

- [ ] Should `PriorityBans` have any simulation effect in this iteration, or be a placeholder?
- [ ] What numeric modifiers should `Aggressive` receive for defense phase (currently 0.95 from HighPress, 0.93 from Attacking)? Decision: use 0.95 (HighPress) as Aggressive is more aggressive.
- [ ] Should the frontend label for `CounterPick` be "Counter Pick" or "Counter‑Pick"? Decision: "Counter Pick".