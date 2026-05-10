# Proposal: Replace PlayStyle enum with LoL DraftStrategy

## Intent

The current `PlayStyle` enum is football-specific (Attacking, Defensive, Possession, Counter, HighPress). As the game transitions to a League of Legends-themed manager, we need a LoL-appropriate draft strategy enum that reflects competitive LoL concepts. This change will replace `PlayStyle` with `DraftStrategy`, mapping existing values to LoL equivalents and adding a new `PriorityBans` variant. This aligns the domain model with the new thematic direction.

## Scope

### In Scope
- Add new `DraftStrategy` enum in `domain/src/team.rs` with variants: `Balanced`, `Aggressive`, `Passive`, `Scaling`, `CounterPick`, `PriorityBans`.
- Rename `Team.play_style` field to `draft_strategy` with serde alias `"play_style"` for backward compatibility.
- Mirror the enum in `engine/types.rs` (replace `PlayStyle` with `DraftStrategy`).
- Update all Rust references (173+ matches across `ofm_core`, `engine`, `db`, `commands`).
- Update frontend `PLAY_STYLES` constant and adjust simulation logic that depends on play style strings.
- Ensure backward compatibility for existing save files via serde aliases.

### Out of Scope
- Changing the simulation logic beyond adapting to the new enum (i.e., no rebalancing of modifiers).
- Adding new UI components for draft strategy selection.
- Database migrations (future work tracked in DATA_MIGRATION_PLAN.md).

## Capabilities

### New Capabilities
- `<draft-strategy>`: Replaces the football-specific play style with LoL draft strategies, affecting match simulation, team tactics, and AI behavior.

### Modified Capabilities
- `<team-tactics>`: The `Team` struct now uses `draft_strategy` instead of `play_style`; existing saves with `play_style` will deserialize correctly via alias.

## Approach

1. **Define `DraftStrategy` enum** with serde serialization that preserves old variant names for backward compatibility (using `#[serde(rename = "...")]`).
2. **Update `Team` struct**: rename field to `draft_strategy`, add `#[serde(alias = "play_style")]`.
3. **Update engine mirror**: replace `PlayStyle` in `engine/types.rs` with `DraftStrategy`.
4. **Update all Rust code**: replace `PlayStyle` with `DraftStrategy`, map old variants to new names (Attacking→Aggressive, Defensive→Passive, Possession→Scaling, Counter→CounterPick, HighPress→Aggressive). Adjust any logic that differentiates between Attacking and HighPress (e.g., in `engine/shared.rs` we will assign Aggressive the combined modifiers of both former variants).
5. **Update frontend**: replace `PLAY_STYLES` constant with new IDs/labels; update simulation references (`simulation.ts`, `TacticsTab.helpers.ts`) to use new strings; adjust `styleAggro` mapping for `Aggressive`.
6. **Add serde aliases** for old field and variant names to ensure existing JSON saves load without migration.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src-tauri/crates/domain/src/team.rs` | Modified | Add `DraftStrategy` enum, rename field in `Team`. |
| `src-tauri/crates/engine/src/types.rs` | Modified | Replace `PlayStyle` with `DraftStrategy`. |
| `src-tauri/crates/engine/src/shared.rs` | Modified | Update `play_style_modifier` match arms for new enum. |
| `src-tauri/crates/ofm_core/**/*.rs` | Modified | Update imports and usage of `PlayStyle` (≈173 references). |
| `src-tauri/crates/db/**/*.rs` | Modified | Update deserialization logic. |
| `src-tauri/src/commands/**/*.rs` | Modified | Update command handlers. |
| `src/components/match/types.ts` | Modified | Update `PLAY_STYLES` constant. |
| `src/components/match/lol-prototype/engine/simulation.ts` | Modified | Update `style` comparisons and `styleAggro` mapping. |
| `src/components/tactics/TacticsTab.helpers.ts` | Modified | Update HighPress reference. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breaking existing saves | Medium | Use serde aliases for field and variant names; thorough deserialization tests. |
| Frontend simulation regression | Medium | Update simulation logic and add unit tests for new enum values. |
| Missing references (173+ matches) | Low | Use global search/replace with careful review; run full test suite after changes. |

## Rollback Plan

Revert the branch; the change is self-contained and does not affect database schemas. Existing saves that already use the new enum will not load after rollback, but that's acceptable for a pre-release change.

## Dependencies

- None (this is a standalone refactor).

## Success Criteria

- [ ] All Rust code compiles with `DraftStrategy` replacing `PlayStyle`.
- [ ] Existing save files (with `play_style` field and old variant names) load correctly.
- [ ] Frontend simulation behaves identically (or with documented adjustments) for all six draft strategies.
- [ ] All existing tests pass; new tests added for enum mapping.
- [ ] No references to `PlayStyle` remain in the codebase (except serde aliases).