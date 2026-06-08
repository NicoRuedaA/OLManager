# Tasks: Replace Position Enum with LoL Role Enum

## Phase 1: Foundation — LolRole Enum & Rating Engine

- [x] 1.1 Update `src-tauri/crates/domain/src/stats.rs`: Add custom `Deserialize` impl for `LolRole` to handle legacy Position strings (Goalkeeper→Support, Defender→Top, etc.)
- [x] 1.2 Update `src-tauri/crates/ofm_core/src/player_rating.rs`: Replace 19 position weight maps with 5 role weight maps (Top/Jungle/Mid/Adc/Support per design spec)
- [x] 1.3 Update `src-tauri/crates/ofm_core/src/player_rating.rs`: Remove side-based penalty logic (left/right footedness)
- [x] 1.4 Update `src-tauri/crates/ofm_core/src/player_rating.rs`: Replace all rating functions to accept `LolRole` instead of `Position`

## Phase 2: Core Domain — Player & Team

- [x] 2.1 Update `src-tauri/crates/domain/src/player.rs`: Remove `Position` enum entirely
- [x] 2.2 Update `src-tauri/crates/domain/src/player.rs`: Change `position`, `natural_position`, `alternate_positions` fields from `Position` to `LolRole`
- [x] 2.3 Update `src-tauri/crates/domain/src/player.rs`: Remove `is_legacy_bucket()`, `to_group_position()` methods
- [x] 2.4 Update `src-tauri/crates/domain/src/team.rs`: Update `TeamComposition::position_rows()` to return `Vec<Vec<LolRole>>`
- [x] 2.5 Update `src-tauri/crates/domain/src/team.rs`: Remove defender_line(), midfield_line(), forward_line() helpers
- [x] 2.6 Fix compilation in `src-tauri/crates/domain/src/` dependent files (run `cargo build` to find errors)

## Phase 3: Engine Types

- [x] 3.1 Update `src-tauri/crates/engine/src/types.rs`: Replace engine `Position` enum with `LolRole`; update `PlayerData`, `TeamData` structs
- [x] 3.2 Update `src-tauri/crates/engine/src/live_match/lol_map.rs`: Unify with domain `LolRole`
- [x] 3.3 Fix compilation in engine crate (752+ Rust refs will surface as compilation errors)

## Phase 4: Commands & Application Layer

- [x] 4.1 Update `src-tauri/src/application/time_blockers.rs`: Delete `lol_role_for_position` function
- [x] 4.2 Update `src-tauri/src/commands/squad.rs`: Replace default position literals with `LolRole` variants
- [x] 4.3 Update `src-tauri/src/commands/world.rs`: Update player generation position assignments to use `LolRole`
- [x] 4.4 Update `src-tauri/crates/ofm_core/src/live_match_manager/team_builder.rs`: Remove `map_position_to_lol_role`; use `LolRole` directly
- [x] 4.5 Update `src-tauri/crates/db/src/entities/player.rs`: Ensure `LolRole` serializes to string correctly
- [x] 4.6 Fix remaining Position refs in main binary: application/live_match.rs, application/time_blockers.rs, commands/squad.rs, commands/game.rs

## Phase 5: Database & Migration

- [ ] 5.1 Create database migration V31: Add version tracking for player position→role migration
- [ ] 5.2 Update `src-tauri/crates/db/src/repositories/player_repo.rs`: Ensure `LolRole` deserialize handles legacy saves
- [ ] 5.3 Update `src-tauri/crates/db/src/save_manager.rs`: Verify player save data structure handles `LolRole` correctly

## Phase 6: Frontend TypeScript

- [x] 6.1 Update `src/store/types.ts`: Change `PlayerData.position` from string to `LolRole` union type
- [x] 6.2 Update `src/lib/playerRating.ts`: Replace 19-position weight logic with 5-role weights; remove position helpers
- [x] 6.3 Update `src/components/squad/SquadTab.helpers.ts`: Remove `getLolRoleFromPosition`; use `LolRole` directly
- [x] 6.4 Update `src/lib/lolIdentity.ts`: Simplify role resolution (now direct, no mapping)
- [x] 6.5 Update `src/i18n/locales/en.json`: Add role translation keys: role.top, role.jungle, role.mid, role.adc, role.support
- [x] 6.6 Update `src/i18n/locales/en.json`: Add LoL role translations
- [x] 6.7 Update `src/i18n/locales/es.json`: Add LoL role translations
- [ ] 6.8 Fix remaining TypeScript compilation errors (test files need LolRole mock data)

## Phase 7: Testing

- [ ] 7.1 Update `src-tauri/crates/ofm_core/tests/`: Update all test fixtures from Position to `LolRole`
- [ ] 7.2 Add unit test: Legacy position string → `LolRole` deserialization (all 19 positions)
- [ ] 7.3 Add unit test: Role-based OVR calculation for each role (Top/Jungle/Mid/Adc/Support)
- [ ] 7.4 Add unit test: Compatibility penalty logic (primary=0, alternate=4.0, different=14.0)
- [ ] 7.5 Add integration test: Full player save/load cycle with legacy Position
- [ ] 7.6 Add integration test: Squad building role coverage detection
- [ ] 7.7 Update frontend tests: Role badge colors, filter functionality
- [ ] 7.8 Run full test suite and verify all tests pass

## Phase 8: Cleanup

- [ ] 8.1 Verify no remaining `Position` references in Rust codebase (`grep -r "Position" src-tauri/`)
- [ ] 8.2 Verify no remaining `"position"` string literals in TypeScript (`grep -r "position" src/`)
- [ ] 8.3 Update any remaining comments/docs referencing football positions
- [ ] 8.4 Run `cargo clippy` and fix any warnings
- [ ] 8.5 Final verification: build succeeds, tests pass, no dead code