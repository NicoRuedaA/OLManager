# Spec: Football Technical Debt Removal

## Overview

Eliminate 52 items of football-related technical debt across the OLManager codebase (Rust domain/engine/ofm_core, TypeScript frontend, scripts, i18n, seed data). Organized in three phases: **Phase A** (critical, 13 items), **Phase B** (medium, 22 items), **Phase C** (low, 17 items).

## In Scope / Out of Scope

**In scope**: All football terminology, types, fields, constants, comments, i18n keys, script output, and test data that reference football concepts.

**Out of scope**:
- `stadium_name` / `stadium_capacity` → `arena_*` rename (SKIPPED per user decision)
- `ofm_core` crate rename (intentionally kept)
- `Position` enum full removal (kept for legacy deserialization, only `#[deprecated]`)
- Engine soccer terms (Penalty, FreeKick, Foul, Offside in engine crate — kept as legacy isolated code)
- `GoalDetail` → `KillDetail` (already done in previous work)

---

## Phase A — Critical (Domain + DB)

### A1. StandingEntry rename: goal_difference → kill_difference
- **Files**: `domain/src/league.rs`, `ofm_core/`, `db/`, frontend helpers
- **AC**: `kill_difference()` method with identical logic (kills_for - kills_against)
- **Test**: All `sorted_standings` tests pass with renamed method

### A2. Remove formation field from Team
- **Files**: `domain/src/team.rs`, `engine/src/types.rs`, `db/src/migrations.rs`, `db/src/repositories/`, `ofm_core/src/`, save files, test data
- **AC**: Team struct no longer has `formation: String`; `#[serde(default)]` handles old saves
- **Migration**: V43 — DROP COLUMN formation from teams table

### A3. Remove drawn from StandingEntry
- **Files**: `domain/src/league.rs`, `db/repositories/`, frontend `types.ts`
- **AC**: StandingEntry has only `won`, `lost`, `played` (no `drawn`)
- **AC**: `record_result()` never increments drawn (all maps resolve to win/loss)

### A4. Remove clean_sheets from PlayerSeasonStats
- **Files**: `domain/src/player.rs`, `db/repositories/`, frontend types, all test fixtures
- **AC**: `clean_sheets: u32` removed from domain and frontend

### A5. Remove Footedness from Player
- **Files**: `domain/src/player.rs`, frontend types
- **AC**: `footedness: Footedness` removed from Player struct
- **Note**: Keep `Footedness` enum itself for legacy serde compat

### A6. Remove football_nation from store types
- **Files**: `src/store/types.ts` — `PlayerData.football_nation?: string`
- **AC**: Field removed, `getStandingKillsFor`/`getStandingKillsAgainst` remain

### A7. Replace CompactTeamMatchStatsData with LoL stats
- **Files**: `src/store/types.ts`, frontend components consuming it
- **AC**: `CompactTeamMatchStatsData` has `kills`, `deaths`, `gold_earned`, `damage_dealt`, `objectives` instead of `shots`, `fouls`, `cards`

### A8. SquadTab.helpers.ts football rewrite
- **Files**: `src/components/squad/SquadTab.helpers.ts`, `SquadTab.tsx`, `SquadTab.test.tsx`, `SquadTab.helpers.test.ts`
- **AC**: CORE_POSITIONS, CANONICAL_POSITION_MAP, buildPitchRows, parseFormationSlats, POSITION_GROUPS removed; only LOL_ACTIVE_ROLES remains

### A9. WorldEditorTab.tsx — stop generating football_nation
- **Files**: `src/components/worldEditor/WorldEditorTab.tsx`
- **AC**: `createNewPlayer()` does not set `football_nation`

### A10. Generate scripts — stop emitting football_nation
- **Files**: `scripts/generate-lec-world.mjs`
- **AC**: Player/team objects no longer contain `football_nation`; override removed

### A11. Add #[deprecated] on Position enum
- **Files**: `domain/src/stats.rs`
- **AC**: `#[deprecated(note = "Use LolRole instead")]` on Position enum

### A12. Remove yellow_cards/red_cards from frontend types
- **Files**: `src/store/types.ts`, all test fixtures in `src/`
- **AC**: No `yellow_cards` or `red_cards` anywhere in frontend types

### A13. Remove draws from ManagerCareerStats
- **Files**: `domain/src/manager.rs`, `src/store/types.ts`
- **AC**: `ManagerCareerStats.draws` and `ManagerCareerEntry.draws` removed

---

## Phase B — Medium

### B1. PlayStyle → DraftStrategy (ref proposal #51)
- **Files**: All files referencing `PlayStyle` across domain, engine, ofm_core, db, frontend
- **AC**: `PlayStyle` enum replaced by `DraftStrategy` with serde aliases for old variant names
- **AC**: `Team.play_style` field renamed to `draft_strategy` with `#[serde(alias = "play_style")]`

### B2. Remove openfootlogo.svg references
- **Files**: `src/pages/MainMenu.tsx` (line 381), `MainMenu.test.tsx` (line 381), `public/openfootlogo.svg`
- **AC**: MainMenu references OLManager logo instead of openfootlogo; SVG file removed

### B3. fixture → match/series naming
- **Files**: Wherever `fixture` is used as a football term in frontend code
- **AC**: User-facing references updated; internal code paths assessed for rename cost

### B4. Strip football i18n keys
- **Files**: All locale JSON files in `src/i18n/locales/`
- **AC**: `be.source.footballHerald` and `pitchInteractionHint` removed from all 8 locales

### B5. Migrate test data from 4-4-2 formations to LoL rosters
- **Files**: All test `.rs` files referencing `"formation": "4-4-2"` or `formation: "4-4-2"`
- **AC**: Test data uses LoL 5-role rosters instead of football formations

### B6. Rename FOOTBALL_IDENTITIES → LEGACY_NATIONAL_IDENTITIES
- **Files**: `src/lib/countries.ts`
- **AC**: Constant and `FootballIdentityDefinition` type renamed; function names updated

### B7. Remove yellow_cards/red_cards from Rust domain
- **Files**: `domain/src/player.rs` (PlayerSeasonStats), `ofm_core/`, `db/repositories/`
- **AC**: Fields removed from domain struct, DB columns, and repo queries

### B8. Rename footballTermGuard.ts → guard.ts
- **Files**: `src/i18n/locales/footballTermGuard.test.ts`
- **AC**: File renamed; imports updated

### B9. Update generate-lec-world.mjs to not emit football stats
- **Files**: `scripts/generate-lec-world.mjs`
- **AC**: Remove `clean_sheets`, `yellow_cards`, `red_cards` from player stats block

---

## Phase C — Low

### C1. Doc/comment cleanup (Rust)
- **Files**: All `.rs` files in domain, engine, ofm_core
- **AC**: Comments referencing "football", "soccer", "pitch", "goalkeeper" updated to LoL terms or marked `// legacy`

### C2. Doc/comment cleanup (Frontend)
- **Files**: `ChampionDraft.tsx`, other components
- **AC**: Comments referencing football removed or updated

### C3. Update lec_world.json description
- **Files**: `src-tauri/databases/lec_world.json` line 3
- **AC**: Description updated from "OpenFootManager" to "OLManager"

### C4. Archive migration proposals
- **Files**: `docs/proposals/FOOTBALL_REMNANTS.md`, `FOOTBALL_NATION_REMOVAL.md`
- **AC**: Moved to `docs/legacy/archived-proposals/` with timestamp

### C5. Update tactics helper descriptions
- **Files**: Frontend tactics components
- **AC**: Descriptions updated from football strategy to LoL draft strategy

### C6. Offsides cleanup from test data
- **Files**: Engine test fixtures
- **AC**: Remove any remaining `offsides` references

### C7. Use LolRole in engine comments
- **Files**: `engine/src/types.rs`, `engine/src/shared.rs`
- **AC**: Comments referencing football positions updated to LolRole

---

## Migration Requirements

| Migration | Action | Risk | Rollback |
|-----------|--------|------|----------|
| V43 | DROP COLUMN formation from teams | Medium — existing saves with formation will lose field silently | Restore column from backup |
| V39 (activate) | Already written: drop football_nation from players/managers/staff | Already tested — low risk | DB-level restore |
| No migration needed | clean_sheets, yellow_cards, red_cards removal | None — serde(default) handles old data | N/A — backwards compatible deser |
| No migration needed | Footedness removal | None — #[serde(default)] safety | N/A |

## Test Requirements

1. **Rust**: `cargo test --workspace` MUST pass after each phase
2. **Frontend**: `npm test` (vitest) MUST pass after each phase
3. **DB migrations**: Existing V39/V40/V42 tests MUST pass unmodified
4. **Legacy deserialization**: Tests for old save format loading MUST continue passing
5. **New tests**: Each renamed method MUST have tests verifying exact semantics match

## Rollback Considerations

1. **Formation removal (Phase A)**: Cannot be rolled back after V43 migration — backup required
2. **football_nation (Phase A)**: V39 migration is destructive — restore from DB backup if needed
3. **SquadTab.helpers.ts (Phase A)**: Snapshot the original file before rewrite; rollback = restore snapshot
4. **PlayStyle→DraftStrategy (Phase B)**: The `#[serde(alias)]` and `#[serde(rename)]` attributes ensure old saves load correctly even after rename
5. **general principle**: All removed fields use `#[serde(default)]` or `#[serde(alias)]` for safe old-save deserialization — no data loss on load
