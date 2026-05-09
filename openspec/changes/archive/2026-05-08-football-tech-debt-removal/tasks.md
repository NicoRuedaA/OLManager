# Tasks: Football Technical Debt Removal

## Phase A — Critical (Domain + DB + Core Frontend)

### A-01 Rename StandingEntry football fields to LoL equivalents
- **Files**: `domain/src/league.rs`, `ofm_core/src/standings.rs`, `ofm_core/src/news/`
- **Depends on**: None
- **Estimate**: small
- **AC**: `goal_difference()` → `kill_difference()` (same logic). `drawn` field removed from struct + `record_result()`. `serde(default)` on removed drawn. Frontend `StandingData.drawn` removed.
- **TDD**: Test `kill_difference()` computes `kills_for - kills_against`. Test `record_result()` never increments drawn.

### A-02 Remove formation from Team struct
- **Files**: `domain/src/team.rs`, `engine/src/types.rs`, `ofm_core/src/generator/`, `ofm_core/src/player_rating.rs`
- **Depends on**: None
- **Estimate**: medium
- **AC**: `Team.formation: String` removed. `#[serde(default)]` on removal. Old JSON `"formation":"4-4-2"` deserializes silently. Engine `TeamData.formation` removed matching.
- **TDD**: Test old save JSON with `formation` deserializes without error. Test `Team::new()` has no formation param.

### A-03 Remove clean_sheets from PlayerSeasonStats
- **Files**: `domain/src/player.rs`, `db/src/repositories/`, frontend types
- **Depends on**: None
- **Estimate**: small
- **AC**: `clean_sheets: u32` field removed. `#[serde(default)]` for old saves. Frontend `PlayerSeasonStats` updated.
- **TDD**: Test old JSON with `clean_sheets:5` deserializes. Test new struct has no clean_sheets field.

### A-04 Remove Footedness from Player + Position #[deprecated]
- **Files**: `domain/src/player.rs`, `domain/src/stats.rs`, frontend types
- **Depends on**: None
- **Estimate**: small
- **AC**: `Player.footedness: Footedness` removed (enum kept for legacy compat). `#[deprecated(note="Use LolRole")]` on `Position` enum. `#[serde(default)]` on all removed fields.
- **TDD**: Test old JSON with `footedness:"Right"` deserializes. Compile test triggers deprecation warning on Position usage.

### A-05 Remove yellow_cards/red_cards + draws from domain
- **Files**: `domain/src/player.rs`, `domain/src/manager.rs`, `ofm_core/src/`, `db/src/repositories/`
- **Depends on**: None
- **Estimate**: small
- **AC**: `PlayerSeasonStats.yellow_cards`/`red_cards` removed. `ManagerCareerStats.draws` removed. `ManagerCareerEntry.draws` removed. All with `#[serde(default)]`.
- **TDD**: Test old JSON with cards fields deserializes. Test ManagerCareerStats has no draws field.

### A-06 V53 migration — DROP COLUMN formation from teams table
- **Files**: `db/src/sql/v053_remove_formation.sql`, `db/src/migrations.rs`
- **Depends on**: A-02
- **Estimate**: medium
- **AC**: New SQL file follows V42 pattern (CREATE/INSERT/DROP/RENAME). `MIGRATION_COUNT` bumped to 53. Hook validates row count before/after. Works on existing save files.
- **TDD**: Insert team with formation, run migration, verify column gone + row count preserved.

### A-07 Frontend types: remove football_nation + replace CompactTeamMatchStatsData
- **Files**: `src/store/types.ts`
- **Depends on**: A-01, A-03, A-04, A-05
- **Estimate**: medium
- **AC**: `PlayerData.football_nation` removed. `CompactTeamMatchStatsData` replaced with `{kills,deaths,gold_earned,damage_dealt,objectives}`. `StandingData.drawn` removed. `ManagerCareerStats.draws` removed. `yellow_cards`/`red_cards` gone from all interfaces.
- **TDD**: Test `CompactTeamMatchStatsData` has only LoL fields. Test `PlayerData` has no `football_nation`.

### A-08 SquadTab.helpers.ts: remove football pitch logic
- **Files**: `src/components/squad/SquadTab.helpers.ts`, `SquadTab.helpers.test.ts`, `SquadTab.tsx`
- **Depends on**: A-07
- **Estimate**: large
- **AC**: `CORE_POSITIONS`, `CANONICAL_POSITION_MAP`, `POSITION_GROUPS`, `buildPitchRows()`, `parseFormationSlots()`, `buildPitchSlotRows()`, `getPitchRowWidth()`, `getPitchSlotWidth()` removed. `buildLaneRows()` returns 5 role rows. Only LoL roles in `POSITION_LABELS`/`POSITION_CODES`. `buildActiveLineupIds()`, `buildActiveLineupSlots()`, `applyLineupDrop()`, `applyLineupSwap()` kept. `canonicalPosition()`, `isPlayerOutOfPosition()`, `getPreferredPositions()` kept for TacticsTab.
- **TDD**: Test `buildLaneRows()` returns 5 entries (TOP/JUNGLE/MID/ADC/SUPPORT). Test no football position constants exist. Test kept functions unchanged.

### A-09 WorldEditorTab.tsx: stop generating football_nation
- **Files**: `src/components/worldEditor/WorldEditorTab.tsx`
- **Depends on**: A-07
- **Estimate**: small
- **AC**: `createNewPlayer()` doesn't set `football_nation`. Default position uses LoL role (e.g. `"SUPPORT"`) instead of `"Midfielder"`. Generated players compatible with new PlayerData.
- **TDD**: Test `createNewPlayer()` output has no `football_nation` field. Test default position is a valid LoL role.

### A-10 generate-lec-world.mjs: remove football_nation + regenerate
- **Files**: `scripts/generate-lec-world.mjs`, `src-tauri/databases/lec_world.json`
- **Depends on**: A-07
- **Estimate**: medium
- **AC**: `footballNation` override removed from TEAM_OVERRIDES. Player generation no longer sets `football_nation`. Team generation no longer sets `football_nation`. `clean_sheets`, `yellow_cards`, `red_cards` removed from player stats. `lec_world.json` regenerated without these fields.
- **TDD**: Run generate script, verify output JSON has no `football_nation`/`clean_sheets`/`yellow_cards`/`red_cards`.

### A-11 PlayStyle→DraftStrategy integration (ref proposal #51)
- **Files**: `domain/src/team.rs`, `engine/src/types.rs`, `engine/src/shared.rs`, `ofm_core/src/generator/generation.rs`, `ofm_core/src/player_rating.rs`, `db/src/repositories/`
- **Depends on**: A-02 (formation removal same files)
- **Estimate**: large
- **AC**: `Team.play_style` → `draft_strategy` with `#[serde(alias="play_style")]`. Engine `PlayStyle` enum replaced by `DraftStrategy`. Old variants deserialize via serde rename. Aggressive = Attacking + HighPress merge. Simulation config forwards DraftStrategy.
- **TDD**: Test old JSON `"play_style":"Balanced"` deserializes to `DraftStrategy::Balanced`. Test Aggressive modifier merges correct weights.

## Phase B — Medium (i18n, Logo, Test Data, Renames)

### B-01 [x] i18n: rename be.source.footballHerald → be.source.lolEsports
- **Files**: `ofm_core/src/news/match_report.rs`, `src/i18n/locales/*.json` (8 files)
- **Depends on**: None
- **Estimate**: small
- **AC**: Key `be.source.footballHerald` replaced by `be.source.lolEsports` in all 8 locale JSON files and Rust match_report.rs.
- **TDD**: Test match_report generates `be.source.lolEsports`. Grep locales for `footballHerald` → 0 matches.

### B-02 [x] i18n: rename pitchInteractionHint → riftInteractionHint
- **Files**: `src/i18n/locales/*.json` (8 files)
- **Depends on**: None
- **Estimate**: small
- **AC**: Key `pitchInteractionHint` replaced by `riftInteractionHint` in all 8 locales.
- **TDD**: Grep locales for `pitchInteractionHint` → 0 matches. New key present in all 8 files.

### B-03 [x] Rename footballTermGuard.ts → guard.ts
- **Files**: `src/i18n/locales/footballTermGuard.ts`, `src/i18n/locales/footballTermGuard.test.ts`, all imports
- **Depends on**: None
- **Estimate**: small
- **AC**: Files renamed to `guard.ts`/`guard.test.ts`. All `import` paths updated. Test logic identical.
- **TDD**: Test file exists as `guard.test.ts`. Old path does not exist. Tests pass.

### B-04 [x] Rename FOOTBALL_IDENTITIES → LEGACY_NATIONAL_IDENTITIES
- **Files**: `src/lib/countries.ts`
- **Depends on**: None
- **Estimate**: small
- **AC**: `FOOTBALL_IDENTITIES` constant and `FootballIdentityDefinition` type renamed. All imports updated.
- **TDD**: Grep for `FOOTBALL_IDENTITIES` → 0 matches. Grep for `LEGACY_NATIONAL_IDENTITIES` → matches.

### B-05 [x] Remove openfootlogo.svg references
- **Files**: `public/openfootlogo.svg`, `src/pages/MainMenu.tsx`, `MainMenu.test.tsx`
- **Depends on**: None
- **Estimate**: small
- **AC**: SVG files deleted. MainMenu uses OLManager logo path. Test updated.
- **TDD**: Grep for `openfootlogo` in src/ → 0 matches. MainMenu.test.tsx updated.

### B-06 [x] fixture → match/series naming
- **Files**: All frontend components referencing `fixture` as football term
- **Depends on**: None
- **Estimate**: medium
- **AC**: User-facing `fixture` terms renamed to `match` or `series`. Internal code paths assessed.
- **TDD**: Grep `fixture` in components → expected match/series references only.

### B-07 [x] Migrate test data from 4-4-2 to LoL 5-role rosters
- **Files**: All `.rs` test files referencing `"formation":"4-4-2"` or `formation:"4-4-2"`
- **Depends on**: A-02, A-06
- **Estimate**: large
- **AC**: No test data references `4-4-2`. Test formations replaced with LoL role-based lineup data. All tests compile and pass.
- **TDD**: `cargo test --workspace` passes. Grep for `4-4-2` in test files → 0 matches.

### B-08 [x] Update generate-lec-world.mjs: remove football stats + regenerate
- **Files**: `scripts/generate-lec-world.mjs`, `src-tauri/databases/lec_world.json`
- **Depends on**: A-10
- **Estimate**: medium
- **AC**: `clean_sheets`, `yellow_cards`, `red_cards` removed from player stats block. JSON regenerated.
- **TDD**: Run script, verify generated JSON has no football stats fields.

### B-09 [x] PlayStyle→DraftStrategy ofm_core integration
- **Files**: `ofm_core/src/generator/generation.rs`, `ofm_core/src/player_rating.rs`, `ofm_core/src/season_awards.rs`
- **Depends on**: A-11
- **Estimate**: medium
- **AC**: `use domain::team::PlayStyle` → `DraftStrategy`. `clean_sheet_king` award replaced with LoL equivalent (e.g. `games_with_zero_deaths`). Player rating uses DraftStrategy variants.
- **TDD**: Test season_awards generates LoL award instead of clean_sheet_king. Player rating with DraftStrategy::Aggressive.

### B-10 [x] PlayStyle→DraftStrategy frontend integration
- **Files**: `src/store/types.ts`, frontend components using PlayStyle/DraftStrategy
- **Depends on**: A-11, A-07
- **Estimate**: medium
- **AC**: Frontend imports use `DraftStrategy` type. Display labels use LoL draft strategy names. No `PlayStyle` references in frontend.
- **TDD**: Grep for `PlayStyle` in src/ → 0 matches. DraftStrategy type usable in components.

### B-11 [x] Update tactics helper descriptions
- **Files**: Frontend tactics components, `TacticsTab.helpers.ts`
- **Depends on**: B-10
- **Estimate**: small
- **AC**: `FORMATIONS`, `PLAY_STYLE_DESCRIPTION_FALLBACKS` replaced with LoL draft strategy equivalents.
- **TDD**: TacticsTab renders LoL descriptions instead of football formations.

### B-12 [x] narrative_news.rs tests: update football references
- **Files**: `ofm_core/src/news/narrative_news.rs` (tests)
- **Depends on**: B-01
- **Estimate**: small
- **AC**: Test expectations updated to use `be.source.lolEsports` and LoL terminology. No `footballHerald` in test assertions.
- **TDD**: `cargo test` passes for narrative_news tests. Grep for `footballHerald` in tests → 0.

## Phase C — Low (Cleanup, Deprecations, Documentation)

### C-01 [x] Rust doc/comment cleanup (football → legacy/LoL)
- **Files**: All `.rs` files in `domain/`, `engine/`, `ofm_core/`
- **Depends on**: A-01 through A-06
- **Estimate**: medium
- **AC**: Comments referencing "football", "soccer", "pitch", "goalkeeper" → LoL terms or marked `// legacy`.
- **TDD**: Grep for `(?i)(football|soccer|goalkeeper)` in Rust comments → 0 non-legacy matches.

### C-02 [x] Frontend comment cleanup
- **Files**: `ChampionDraft.tsx`, other components
- **Depends on**: A-07 through A-09
- **Estimate**: small
- **AC**: Comments referencing "football positions" → LoL roles. Football strategy comments removed.
- **TDD**: Grep for `football` in `src/components/` comments → 0 matches.

### C-03 [x] Engine comments → LolRole references
- **Files**: `engine/src/types.rs`, `engine/src/shared.rs`
- **Depends on**: A-07
- **Estimate**: small
- **AC**: Comments referencing football positions → `LolRole`. Test name `football_position_to_lol_role` → `position_to_lol_role`.
- **TDD**: Grep for `football_position` in engine/ → 0 matches.

### C-04 [x] Offsides cleanup from test fixtures
- **Files**: Engine test fixtures, save_manager tests, any `.rs` containing `offsides`
- **Depends on**: A-02
- **Estimate**: small
- **AC**: Zero references to `offsides` in test data (excluding unrelated variable names).
- **TDD**: Grep for `offsides` in src-tauri/tests/ → 0 matches.

### C-05 [x] Archive migration proposals
- **Files**: `docs/proposals/FOOTBALL_REMNANTS.md`, `docs/proposals/FOOTBALL_NATION_REMOVAL.md`
- **Depends on**: None
- **Estimate**: small
- **AC**: Files moved to `docs/legacy/archived-proposals/` with timestamp. Original paths removed.
- **TDD**: Verify files exist in archive directory. Old paths don't exist.

### C-06 [x] Update lec_world.json description
- **Files**: `src-tauri/databases/lec_world.json`
- **Depends on**: A-10
- **Estimate**: small
- **AC**: Description changed from `"OpenFootManager"` to `"OLManager"`.
- **TDD**: Read line 3 of JSON → contains `"OLManager"`.

### C-07 [x] Fix Android gen football_nation
- **Files**: Android seed generation script (if separate), or confirm only `generate-lec-world.mjs` handles this
- **Depends on**: A-10
- **Estimate**: small
- **AC**: No Android-specific seed generation emits `football_nation`. Verify all seed-gen paths are clean.
- **TDD**: Run Android seed gen → no `football_nation` in output.
