# Proposal: Replace Position Enum with LoL Role Enum

## Intent

The game is transitioning from football management to League of Legends esports management. The current `Position` enum (19 football-specific variants) is misaligned with the LoL‑centric match simulation already using `LolRole` (5 roles + Unknown). This change consolidates the domain model to reflect LoL roles, simplifies the codebase, and removes the need for ad‑hoc mapping between football positions and LoL roles.

## Scope

### In Scope
- Replace `Position` enum with `LolRole` enum (from `domain::stats`) across the entire stack
- Update all Rust backend references (domain, engine, core, db, commands)
- Update all frontend references (TypeScript types, UI labels, i18n keys)
- Adapt player rating calculations to work with 5 roles instead of 19 positions
- Update database schema and migration (if needed)
- Remove football‑specific mapping functions (e.g., `lol_role_for_position`)
- Update test suites and sample data

### Out of Scope
- Adding sub‑roles or new gameplay mechanics beyond the enum replacement
- Changing the underlying player attribute system (pace, shooting, etc.)
- Introducing new LoL‑specific attributes (e.g., “last‑hitting”, “map awareness”)
- Frontend UI redesign beyond label updates

## Capabilities

### New Capabilities
None – we are replacing an existing enum, not introducing new domain concepts.

### Modified Capabilities
- `player`: The player specification now uses `LolRole` for `position`, `natural_position`, and `alternate_positions`. The delta spec will document the new enum variants and removal of football‑specific grouping methods.
- `team`: Team composition and squad building logic that previously relied on granular positions must adapt to LoL roles.
- `rating`: Player rating algorithm must map LoL roles to attribute weights (replacing the position‑specific weighting).
- `squad`: Squad management UI and filtering must display LoL roles instead of football positions.

## Approach

1. **Define `LolRole` as the primary role enum** in `domain/src/stats.rs` (already exists). Remove the `Position` enum from `domain/src/player.rs`.
2. **Update `Player` struct**: change `position`, `natural_position`, and `alternate_positions` fields to use `LolRole`.
3. **Remove football‑specific methods** (`is_legacy_bucket`, `to_group_position`) and replace with LoL‑role helpers if needed.
4. **Update `player_rating.rs`**: replace position‑specific weight maps with role‑specific weights (5 roles). Remove side‑based penalties (left/right) as LoL roles are side‑agnostic.
5. **Update `time_blockers.rs`**: delete `lol_role_for_position` and use `LolRole` directly.
6. **Update `live_match.rs` and engine mapping**: ensure engine’s `LolRole` enum aligns with domain `LolRole` (they are identical; may need type unification).
7. **Update database layer**: adjust serialization/deserialization of `LolRole` (string representation). Create migration if column types change.
8. **Update frontend**: replace Position type union with `LolRole` union, update i18n keys, adjust UI components (position filters, player cards, squad roster).
9. **Update tests**: adjust all test fixtures and assertions to use LoL roles.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src-tauri/crates/domain/src/player.rs` | Modified | Remove `Position` enum, update `Player` struct fields |
| `src-tauri/crates/domain/src/stats.rs` | Modified | Ensure `LolRole` is the canonical role enum (already exists) |
| `src-tauri/crates/ofm_core/src/player_rating.rs` | Modified | Replace position‑based weighting with role‑based weighting |
| `src-tauri/src/application/time_blockers.rs` | Modified | Remove `lol_role_for_position` function |
| `src-tauri/src/application/live_match.rs` | Modified | Align domain and engine `LolRole` types |
| `src-tauri/crates/engine/src/live_match/lol_map.rs` | Modified | Possibly unify `LolRole` with domain version |
| `src-tauri/crates/db/src/repositories/stats_repo.rs` | Modified | Ensure serialization/deserialization of `LolRole` works |
| `src-tauri/crates/db/src/save_manager.rs` | Modified | Update player save data structure |
| `src-tauri/src/commands/squad.rs` | Modified | Update squad queries and default positions |
| `src-tauri/src/commands/world.rs` | Modified | Update world generation JSON literals |
| `src-tauri/crates/ofm_core/tests/` | Modified | Update test fixtures |
| `src/components/` (multiple) | Modified | Update UI components that display positions |
| `src/lib/playerRating.ts` | Modified | Replace position‑specific logic with role‑specific logic |
| `src/lib/lolIdentity.ts` | Modified | Simplify mapping (now direct) |
| `src/utils/backendI18n.ts` | Modified | Update i18n keys for roles |
| `src/components/squad/SquadTab.helpers.ts` | Modified | Update position translation and filtering |
| `src/components/match/ChampionDraft.tsx` | Modified | Adjust role mapping for draft |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breaking existing save files | High | Provide data‑migration script that maps football positions to LoL roles (using `lol_role_for_position` mapping) |
| Player rating imbalance | Medium | Carefully tune role‑specific attribute weights; run simulation tests |
| Frontend confusion | Low | Update i18n strings and tooltips to reflect new role names |
| Loss of granularity | High (by design) | Accept that 5 roles replace 19 positions; this is the intended simplification |

## Rollback Plan

Revert the enum change, restore `Position` enum, and revert all referencing files. Use `git revert` on the commit that introduces this change.

## Dependencies

None (self‑contained change).

## Success Criteria

- [ ] All Rust code compiles with `LolRole` replacing `Position`
- [ ] All frontend TypeScript code compiles with `LolRole` type
- [ ] Player rating calculations produce reasonable values for each LoL role
- [ ] All existing tests pass (or are updated)
- [ ] No references to football‑specific positions remain in the codebase
- [ ] UI labels show LoL role names (Top, Jungle, Mid, ADC, Support)
- [ ] Save‑file migration script works for existing pre‑alpha saves