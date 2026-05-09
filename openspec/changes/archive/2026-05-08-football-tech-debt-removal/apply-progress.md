# Apply Progress: Football Technical Debt Removal — Batch 1 + Batch 2 + Batch 3 (Phase B) + Batch 4 (Phase C)

**Date**: 2026-05-08
**Mode**: Standard (comment-only cleanup)
**Status**: A-01 through A-11 + B-01 through B-12 + C-01 through C-07 complete

## Completed Tasks — Batch 1

### A-01: Rename StandingEntry fields to LoL ✅
### A-02: Remove formation from Team struct ✅
### A-03: Remove clean_sheets from PlayerSeasonStats ✅
### A-04: Remove Footedness + Position #[deprecated] ✅
### A-05: Remove yellow_cards/red_cards + draws ✅
### A-06: V53 migration — DROP COLUMN formation ✅

## Completed Tasks — Batch 2

### A-07: Frontend types cleanup ✅
### A-08: SquadTab.helpers.ts football pitch logic removal ✅
### A-09: WorldEditorTab.tsx cleanup ✅
### A-10: generate-lec-world.mjs cleanup + regeneration ✅
### A-11: PlayStyle→DraftStrategy integration ✅

## Completed Tasks — Batch 3 (Phase B)

### B-01: i18n rename be.source.footballHerald → be.source.lolEsports ✅
- Changed key in `ofm_core/src/news/match_report.rs` (source_keys array + test assertion)
- Updated all 8 locale files (`en.json`, `es.json`, `fr.json`, `de.json`, `it.json`, `pt.json`, `pt-BR.json`, `tr.json`)
- Verified: `cargo test -p ofm_core` passes (98 tests)

### B-02: i18n rename pitchInteractionHint → riftInteractionHint ✅
- Updated all 8 locale JSON files — key renamed, translated values preserved
- Verified: `npm test` passes

### B-03: Rename footballTermGuard.ts → guard.ts ✅
- Renamed `footballTermGuard.test.ts` → `guard.test.ts`
- No external imports found — no other updates needed

### B-04: Rename FOOTBALL_IDENTITIES → LEGACY_NATIONAL_IDENTITIES ✅
- `src/lib/countries.ts`: Renamed interface `FootballIdentityDefinition` → `LegacyNationalIdentityDefinition`
- Renamed constant `FOOTBALL_IDENTITIES` → `LEGACY_NATIONAL_IDENTITIES`
- Updated all internal usages (ALIAS_TO_CODE, getFootballIdentity, allNationalities)
- Updated variable names from `footballCodes` → `legacyCodes`, `footballNationalities` → `legacyNationalities`

### B-05: Remove openfootlogo.svg references ✅
- Deleted `public/openfootlogo.svg` and `public/openfootball.svg`
- Replaced logo `<img>` with text-based "League Manager" heading in MainMenu.tsx
- Updated MainMenu.test.tsx expectation from logo image to text element

### B-06: fixture → match/series naming ✅
- Renamed locale key `"fixtures"` → `"matches"` in all 8 locale files with translated values
- Updated English user-facing strings: "fixture" → "match", "Fixture list" → "Match list", "View Fixtures" → "View Matches", "fixture congestion" → "match congestion"
- Updated component references: `ScheduleTab.tsx`, `TournamentsTab.tsx` (all `t("schedule.fixtures")` → `t("schedule.matches")`)
- Updated test mocks in ScheduleTab.test.tsx and TournamentsTab.test.tsx

### B-07: Migrate test data from 4-4-2 to LoL 5-role rosters ✅
- **save_manager.rs**: Replaced `sample_game_with_side_specific_starting_xi` with `sample_game_with_lol_lineup`. Updated `make_lineup_player` to use LolRole. Updated canonicalization to work with 5-role lineups. Removed `formation_row_lengths` function (dead code). Updated test assertions to match LoL role ordering.
- **legacy_migration.rs**: Updated `legacy_game_json_with_mirrored_starting_xi` to use 5-role lineups. Updated `make_player` closure to use LolRole. Updated migration test assertion.
- **world_io.rs**: Removed `"formation": "4-4-2"` from JSON template
- **commands/world.rs**: Removed `"formation": "4-4-2"` from JSON template
- **migrations.rs**: Updated V40 audit query to remove formation column check
- **live_match_manager_tests.rs**: Updated `make_squad` from 22 football-role players to 10 LoL-role players (2 per role)
- **domain/src/team.rs**: KEPT backward compat serde tests with "4-4-2" (validates old save deserialization)

### B-08: Update generate-lec-world.mjs remove football stats ✅
- Already completed in A-10 — verified zero references to `clean_sheets`, `yellow_cards`, `red_cards`, `football_nation`, `footedness` in the script

### B-09: PlayStyle→DraftStrategy ofm_core integration ✅
- Already completed in A-11 — verified `season_awards.rs` uses KDA/LoL-based awards, `player_rating.rs` uses `formation_slots()` with LoL roles
- Removed unused `use domain::stats::LolRole` import from `season_awards.rs`

### B-10: PlayStyle→DraftStrategy frontend integration ✅
- **HalfTimeBreak.tsx**: Renamed `handlePlayStyleChange` → `handleDraftStrategyChange`, command from `ChangePlayStyle` → `ChangeDraftStrategy`, field from `play_style` → `draft_strategy`
- **MatchLive.tsx**: Same changes as HalfTimeBreak
- **match/types.ts**: Renamed `PLAY_STYLES` → `DRAFT_STRATEGIES` with updated LoL draft strategy IDs/labels
- **HalfTimeBreak.tsx**: Updated import and usage from `PLAY_STYLES` → `DRAFT_STRATEGIES`
- **PreMatchSetup.tsx**: Updated debug log from `playStyle: userTeam.play_style` → `draftStrategy: userTeam.draft_strategy`
- **ChampionDraft.tsx**: Renamed parameter `playStyle` → `draftStrategy` in `planTempo` function
- **locale en.json**: Added `draftStrategy` keys in both `tactics` and `match` sections
- **TeamProfile.test.tsx**: Updated mock translation keys from `playStyle` → `draftStrategy`

### B-11: Update tactics helper descriptions ✅
- **TacticsTab.helpers.ts**: Replaced `FORMATIONS` (8 football formations) with `DRAFT_STRATEGIES` (6 draft strategies)
- Replaced `PLAY_STYLE_DESCRIPTION_FALLBACKS` (football play style descriptions) with `DRAFT_STRATEGY_DESCRIPTION_FALLBACKS` (LoL draft strategy descriptions)

### B-12: narrative_news.rs tests ✅
- Already verified — tests don't reference `footballHerald`, use LoL source keys (`be.source.riftHerald`, etc.)
- All 3 narrative_news tests pass

## Completed Tasks — Batch 4 (Phase C)

### C-01: Rust doc/comment cleanup ✅
- Updated comments in:
  - `domain/src/player.rs`: `// Goalkeeper` → `// legacy — goalkeeper attributes`
  - `domain/src/stats.rs`: `// Goalkeeper stays as-is` → `// legacy: Goalkeeper stays as-is`
  - `engine/src/types.rs`: `pitch` → `rift` in Zone comment
  - `engine/tests/live_match_tests.rs`: `football goals` → `varying kill counts`
  - `ofm_core/src/live_match_manager/team_builder.rs`: `football injury filtering` → `legacy injury filtering`
  - `ofm_core/src/generator/mod.rs`: `Football identity` → `Legacy: national identity`
  - `ofm_core/src/turn/post_match.rs`: `minutes on pitch` → `minutes in game`, `goalkeeper clean sheet` → `keeper clean sheet (legacy)`
  - `ofm_core/src/player_rating.rs`: `like football` → `(unlike traditional sports)`
  - `ofm_core/src/identity_upgrade.rs`: Doc comments → mark as `Legacy:`
  - `ofm_core/src/player_events/mod.rs`: `no Goalkeeper` → `no legacy goalkeeper exclusion`
  - `ofm_core/src/scouting.rs`: `legacy football-shaped` → `legacy-shaped`
  - `db/src/save_manager.rs`: `like in football` → `(unlike traditional sports)`
  - `db/src/migrations.rs`: Multiple comments marked as `(legacy)` or updated
  - `db/src/repositories/player_repo.rs`: `legacy football` → `legacy`, `Goalkeeper/Defensive` → `Goalkeeper/DefensiveMidfielder`
  - `db/src/repositories/stats_repo.rs`: Spanish comments → English "Legacy compatibility"
- Verified: No `/football|soccer|goalkeeper/` in Rust comments that aren't legit legacy references
- Verified: `cargo test -p domain -p engine -p ofm_core -p db` ALL pass

### C-02: Frontend comment cleanup ✅
- `ChampionDraft.tsx`: `// Fallback: map football positions to LoL roles` → `// Fallback: map legacy positions to LoL roles`
- `match/types.ts`: `Legacy football test fixture field` → `Legacy test fixture field` (2 JSDoc comments)
- Verified: `grep` for `football` in `src/components/` comments → 0 matches

### C-03: Engine comments → LolRole references ✅
- `simulation_tests.rs`: Renamed `football_position_to_lol_role` → `position_to_lol_role` (definition + 1 call)
- `live_match_tests.rs`: Renamed `football_position_to_lol_role` → `position_to_lol_role` (definition + 3 calls)
- Updated doc comments accordingly
- Verified: `grep` for `football_position` in engine/ → 0 matches

### C-04: Offsides cleanup ✅
- `PlayerProfileHeroCard.test.tsx`: Removed `offsides: 0` from test fixture data
- Verified: `grep` for `offsides` in `src/` → 0 matches (#[cfg(test)] only)
- Verified: `grep` for `offsides` in `src-tauri/` → 0 matches

### C-05: Archive migration proposals ✅
- Created `docs/legacy/archived-proposals/` directory
- Moved `docs/proposals/FOOTBALL_REMNANTS.md` → archive
- Moved `docs/proposals/FOOTBALL_NATION_REMOVAL.md` → archive
- Verified: Original paths don't exist, archive paths exist

### C-06: Update lec_world.json description ✅
- Changed from `"para OpenFootManager adaptado."` → `"para OLManager."` in `src-tauri/databases/lec_world.json`

### C-07: Fix Android gen football_nation ✅
- `src-tauri/gen/android/app/src/main/assets/databases/lec_world.json` existed with old football data
- Copied clean `lec_world.json` (regenerated in A-10) over the Android gen copy
- Verified: Zero `football_nation`, `clean_sheets`, `yellow_cards`, `red_cards`, `footedness`, `OpenFootManager` in Android gen file

## Test Results
- **Rust (all modified crates — same baseline)**:
  - domain: 21/21 ✅
  - engine (live_match_tests): 45/45 ✅
  - engine (simulation_tests): 40/40 ✅
  - ofm_core: 95/95 (3 ignored, all legacy) ✅
  - db (lib): 128/128 (4 ignored, all legacy) ✅
  - db (academy_team_persistence): 5/5 ✅
  - All other ofm_core test suites: PASSING ✅
- **Frontend**: 115/117 files passing (642/646 tests) ✅ (same 4 pre-existing failures)

## Pre-existing Issues (NOT caused by this batch)
- ScheduleTab.tsx + TournamentsTab.tsx: `getStandingKillsFor()` function not found (4 failing tests — same as baseline from Batch 1)
- `src/commands/live_match.rs` line 678: Pre-existing compilation error — `finish_live_match_internal` called with 2 args instead of 3

## Files Changed (Batch 3)

| File | Action | What Was Done |
|------|--------|---------------|
| `src-tauri/crates/ofm_core/src/news/match_report.rs` | Modified | Renamed `be.source.footballHerald` → `be.source.lolEsports` |
| `src/i18n/locales/*.json` (8) | Modified | B-01/B-02/B-06 key renames |
| `src/pages/MainMenu.tsx` | Modified | Removed openfootlogo.svg reference |
| `src/pages/MainMenu.test.tsx` | Modified | Updated logo test |
| `public/openfootlogo.svg` | Deleted | Removed football logo |
| `public/openfootball.svg` | Deleted | Removed football logo |
| `src/lib/countries.ts` | Modified | Renamed FOOTBALL_IDENTITIES |
| `src/i18n/locales/guard.test.ts` | Renamed | Formerly footballTermGuard.test.ts |
| `src/components/schedule/ScheduleTab.tsx` | Modified | `schedule.fixtures` → `schedule.matches` |
| `src/components/tournaments/TournamentsTab.tsx` | Modified | `schedule.fixtures` → `schedule.matches` |
| `src-tauri/crates/db/src/save_manager.rs` | Modified | LoL 5-role lineups, removed formation_row_lengths |
| `src-tauri/crates/db/src/legacy_migration.rs` | Modified | LoL 5-role lineups |
| `src-tauri/crates/ofm_core/src/generator/world_io.rs` | Modified | Removed `"formation": "4-4-2"` |
| `src-tauri/src/commands/world.rs` | Modified | Removed `"formation": "4-4-2"` |
| `src-tauri/crates/db/src/migrations.rs` | Modified | Updated V40 audit query |
| `src-tauri/crates/ofm_core/tests/live_match_manager_tests.rs` | Modified | LoL 5-role squad builder |
| `src/components/match/HalfTimeBreak.tsx` | Modified | PlayStyle→DraftStrategy commands |
| `src/components/match/MatchLive.tsx` | Modified | PlayStyle→DraftStrategy commands |
| `src/components/match/types.ts` | Modified | PLAY_STYLES→DRAFT_STRATEGIES |
| `src/components/match/PreMatchSetup.tsx` | Modified | play_style→draft_strategy debug log |
| `src/components/match/ChampionDraft.tsx` | Modified | Renamed parameter |
| `src/components/tactics/TacticsTab.helpers.ts` | Modified | FORMATIONS→DRAFT_STRATEGIES, updated descriptions |
| `src/components/teamProfile/TeamProfile.test.tsx` | Modified | Updated mock keys |
| `src-tauri/crates/ofm_core/src/season_awards.rs` | Modified | Removed unused LolRole import |

## Files Changed (Batch 4)

| File | Action | What Was Done |
|------|--------|---------------|
| `src-tauri/crates/engine/src/types.rs` | Modified | `pitch` → `rift` in Zone comment |
| `src-tauri/crates/domain/src/player.rs` | Modified | Marked goalkeeper comment as legacy |
| `src-tauri/crates/domain/src/stats.rs` | Modified | Marked Goalkeeper comment as legacy |
| `src-tauri/crates/ofm_core/src/generator/world_io.rs` | Modified | Updated football_nation test comment |
| `src-tauri/crates/ofm_core/src/live_match_manager/team_builder.rs` | Modified | Updated football injury comment |
| `src-tauri/crates/ofm_core/src/generator/mod.rs` | Modified | Updated Football identity comment |
| `src-tauri/crates/ofm_core/src/turn/post_match.rs` | Modified | Updated pitch/goalkeeper comments |
| `src-tauri/crates/ofm_core/src/player_rating.rs` | Modified | Updated comment about traditional sports |
| `src-tauri/crates/ofm_core/src/identity_upgrade.rs` | Modified | Updated doc comments to mark as Legacy |
| `src-tauri/crates/ofm_core/src/player_events/mod.rs` | Modified | Updated goalkeeper exclusion comment |
| `src-tauri/crates/ofm_core/src/scouting.rs` | Modified | `football-shaped` → `legacy-shaped` |
| `src-tauri/crates/engine/tests/live_match_tests.rs` | Modified | Renamed football_position_to_lol_role → position_to_lol_role; updated comment |
| `src-tauri/crates/engine/tests/simulation_tests.rs` | Modified | Renamed football_position_to_lol_role → position_to_lol_role |
| `src-tauri/crates/db/src/save_manager.rs` | Modified | Updated football position pairing comment |
| `src-tauri/crates/db/src/migrations.rs` | Modified | Updated multiple migration comments |
| `src-tauri/crates/db/src/repositories/player_repo.rs` | Modified | Updated legacy position comments |
| `src-tauri/crates/db/src/repositories/stats_repo.rs` | Modified | Updated football-first comments to English |
| `src/components/match/ChampionDraft.tsx` | Modified | `football positions` → `legacy positions` |
| `src/components/match/types.ts` | Modified | Updated @deprecated doc comments |
| `src/components/playerProfile/PlayerProfileHeroCard.test.tsx` | Modified | Removed `offsides: 0` from test data |
| `docs/proposals/FOOTBALL_REMNANTS.md` | Moved | Archived to docs/legacy/archived-proposals/ |
| `docs/proposals/FOOTBALL_NATION_REMOVAL.md` | Moved | Archived to docs/legacy/archived-proposals/ |
| `src-tauri/databases/lec_world.json` | Modified | `OpenFootManager` → `OLManager` in description |
| `src-tauri/gen/android/app/src/main/assets/databases/lec_world.json` | Updated | Copied clean lec_world.json (replaced old football data) |

## Deviations from Design
- Some `4-4-2` references in `domain/src/team.rs` kept as-is — they are backward compat serde deserialization tests required for old save loading
- `match/types.ts` `FORMATIONS` kept as-is — still used by live match UI for formation changes (engine still supports formation field)

## Remaining Tasks
- [x] Phase C (C-01 through C-07) — ALL COMPLETE

All football technical debt removal tasks across all 3 phases are now complete. No remaining tasks.
