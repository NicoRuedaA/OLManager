# Design: Football Technical Debt Removal

## Technical Approach

Three-phase migration eliminating 52 football-origin artifacts across the full stack. Each phase is self-contained — Phase A (critical) fixes production debt, Phase B (medium) renames public APIs/assets, Phase C (low) tidies comments/deprecations. Backend changes use serde aliases for save compat; DB uses CREATE/INSERT/DROP/RENAME pattern (SQLite); frontend keeps deprecated fields until all consumers migrate.

## Architecture Decisions

### ADR-1: Serde Aliases for Domain Type Renames
| Option | Tradeoff | Decision |
|--------|----------|----------|
| Rename field + serde alias | Saves load transparently | **USE** |
| Custom Deserialize impl | More code, same result | Reject |
| Break compat + migration script | Destructive | Reject |

All `domain` type renames use `#[serde(alias = "old_name")]`. No DB column renames — domain serde handles JSON serialization from `team_repo.rs`.

### ADR-2: V53 Migration Drops `formation` Column
| Option | Tradeoff | Decision |
|--------|----------|----------|
| SQLite CREATE/INSERT/DROP/RENAME (as V42) | Proven pattern in codebase | **USE** |
| Keep column + ignore in code | Leaves debt behind | Reject |

Follows exact V42 pattern: rebuild `teams` table without `formation` column. V53 hook validates row count before/after.

### ADR-3: `StandingEntry.drawn` → Remove, Not Deprecate
`drawn` is always 0 in LoL (no draws). `StandingEntry.record_result()` already treats equality as draw+1pt (legacy). Change to: `if kills_for == kills_against { self.points += 1 }` but no `drawn` field. Frontend `StandingData.drawn` is **removed** from type (no `@deprecated` bridge).

### ADR-4: PlayStyle → DraftStrategy Reuse
Proposal #51 design (at `docs/proposals/51-draft-strategy/design.md`) already specifies the mapping and serde strategy. This design **references** it without duplicating — integration points listed below.

### ADR-5: `CompactTeamMatchStatsData` → LoL Stats
| Current | Replacement |
|---------|-------------|
| `shots`, `shots_on_target` | ❌ remove |
| `fouls`, `corners` | ❌ remove |
| `yellow_cards`, `red_cards` | ❌ remove |
| `possession_pct` | ❌ remove |
| — | `kills` (u16) |
| — | `deaths` (u16) |
| — | `gold_earned` (u32) |
| — | `damage_dealt` (u32) |
| — | `objectives` (u16) |

Mirrors Rust `CompactTeamMatchStats` already has these LoL fields. Frontend interface gets re-exported type.

## Data Flow — SquadTab Helpers Rewrite

```
SquadTab.tsx
  └─► SquadTab.LoL.helpers.ts (NEW)
       ├─ LOL_ACTIVE_ROLES = ["TOP","JUNGLE","MID","ADC","SUPPORT"]
       ├─ buildLaneRows(): LaneRow[]
       │    └─ Returns 5 fixed rows (one per role), no formation parsing
       ├─ buildActiveLineupIds() — unchanged (already role-based)
       ├─ buildActiveLineupSlots() — unchanged
       ├─ applyLineupDrop() — unchanged
       └─ applyLineupSwap() — unchanged

SquadTab.helpers.ts
  └─► KEPT FOR LEGACY: canonicalPosition(), isPlayerOutOfPosition(),
       getPreferredPositions() — used by other tabs (TacticsTab)

OLD REMOVED:
  - CORE_POSITIONS → removed (LoL uses roles)
  - CANONICAL_POSITION_MAP → removed (30+ football abbreviations)
  - POSITION_GROUPS → removed
  - POSITION_LABELS → only LoL roles kept
  - POSITION_CODES → only LoL roles ("JNG","SUP") kept
  - parseFormationSlots() → removed
  - buildPitchRows() → replaced by buildLaneRows()
  - buildPitchSlotRows() → replaced by direct ActiveLineupSlot use
  - getPitchRowWidth/getPitchSlotWidth → removed
```

**5-role visualization:** A simple vertical list of 5 role rows (Top→Support), each with a player slot. No formation-aware layout. The SquadTab component renders `ActiveLineupSlot[]` directly instead of `PitchSlotRow[]`.

## File Changes by Phase

### Phase A — Critical (14 items)

| File | Action | Change |
|------|--------|--------|
| `src-tauri/crates/domain/src/team.rs` | Modify | Remove `formation: String` field + default. Add serde alias |
| `src-tauri/crates/domain/src/team.rs` | Modify | `play_style` → `draft_strategy` w/ `#[serde(alias)]` |
| `src-tauri/crates/domain/src/player.rs` | Modify | `goals` → `kills` in `CareerEntry` w/ alias. Deprecate `Footedness` |
| `src-tauri/crates/domain/src/player.rs` | Modify | `clean_sheets: u32` → remove from `PlayerSeasonStats` |
| `src-tauri/crates/domain/src/stats.rs` | Modify | Add `#[deprecated]` on `Position` enum |
| `src-tauri/crates/domain/src/league.rs` | Modify | `goal_difference()` → `kill_difference()`. Remove `drawn` field |
| `src-tauri/crates/domain/src/league.rs` | Modify | `StandingEntry::record_result()` — no drawn tracking |
| `src-tauri/crates/engine/src/types.rs` | Modify | `PlayStyle` → `DraftStrategy` (mirror domain) |
| `src-tauri/crates/engine/src/types.rs` | Modify | `formation: String` → remove from `TeamData` |
| `src-tauri/crates/db/src/sql/v0XX_remove_formation.sql` | Create | V53 migration: rebuild `teams` without `formation` column |
| `src-tauri/crates/db/src/migrations.rs` | Modify | Register V53 migration hook |
| `src/store/types.ts` | Modify | `CompactTeamMatchStatsData` → LoL stats. Remove `goals_for/against` deprecated. Remove `drawn` from `StandingData` |
| `src/store/types.ts` | Modify | Remove `football_nation` from `PlayerData` |
| `src/components/squad/SquadTab.helpers.ts` | Rewrite | Rename to `SquadTab.helpers.ts` — remove football pitch logic, keep LoL role helpers |
| `src/components/worldEditor/WorldEditorTab.tsx` | Modify | `football_nation: "KR"` → remove. `position: "Midfielder"` → `position: "SUPPORT"` |

### Phase B — Medium (10 items)

| File | Action | Change |
|------|--------|--------|
| `src-tauri/crates/ofm_core/src/generator/generation.rs` | Modify | Remove `use domain::team::PlayStyle` → `DraftStrategy` |
| `src-tauri/crates/ofm_core/src/player_rating.rs` | Modify | `defender_line/midfield_line/forward_line` → dead code removal or rename |
| `src-tauri/crates/ofm_core/src/news/match_report.rs` | Modify | `"be.source.footballHerald"` → `"be.source.lolEsports"` |
| `src-tauri/crates/ofm_core/src/season_awards.rs` | Modify | `clean_sheet_king` → replace with meaningful LoL award |
| `src/i18n/locales/*.json` (8 files) | Modify | `be.source.footballHerald` → `be.source.lolEsports` |
| `src/i18n/locales/*.json` (8 files) | Modify | `pitchInteractionHint` → `riftInteractionHint` |
| `src/lib/countries.ts` | Modify | `FOOTBALL_IDENTITIES` → `LEGACY_NATIONAL_IDENTITIES` |
| `public/openfootlogo.svg` | Delete | Replace with OLManager logo (create placeholder if none exists) |
| `public/openfootball.svg` | Delete | Same reason |
| `src/pages/MainMenu.tsx` | Modify | Update `src="/openfootlogo.svg"` → new logo path |
| `scripts/generate-lec-world.mjs` | Modify | Remove `footballNation` from TEAM_OVERRIDES + output |
| `src-tauri/databases/lec_world.json` | Modify | Regenerate without `football_nation`, `formation`, old `play_style` |
| `src/components/tactics/TacticsTab.helpers.ts` | Modify | Replace `FORMATIONS`, `PLAY_STYLE_DESCRIPTION_FALLBACKS` with LoL equivalents |

### Phase C — Low (10 items)

| File | Action | Change |
|------|--------|--------|
| `src-tauri/crates/domain/src/stats.rs` | Modify | `#[deprecated]` on `Position` + `to_group_position()` |
| `src-tauri/crates/engine/tests/simulation_tests.rs` | Modify | Rename `football_position_to_lol_role` → `position_to_lol_role` |
| `src-tauri/crates/db/src/save_manager.rs` | Modify | Update test data from 4-4-2 to 5-role LoL lineups |
| `src-tauri/crates/db/src/legacy_migration.rs` | Modify | Update test data |
| `src/content/lol/social/guard.ts` | Modify | Rename from `footballTermGuard.ts` |
| `src/components/playerProfile/PlayerProfileHeroCard.test.tsx` | Modify | Remove `offsides` from test data |
| `src/components/match/ChampionDraft.tsx` | Modify | Update `"football positions"` comment |
| `data/default_teams.json` | Modify | Remove `stadium_name` field (if domain also removes it) |
| `docs/proposals/FOOTBALL_NATION_REMOVAL.md` | Archive | Move to `docs/legacy/archived-proposals/` |
| `src-tauri/databases/lec_world.json` | Modify | Update `description` field |

## Migration Strategy — V53 Formation Drop

```sql
-- CREATE TABLE teams_new WITHOUT formation column
-- Follows v042_drop_dead_team_columns.sql exactly

CREATE TABLE teams_new (
    id, name, short_name, country, city,
    stadium_name, stadium_capacity,     -- kept (user decision)
    finance, manager_id, reputation,
    wage_budget, transfer_budget, season_income, season_expenses,
    draft_strategy,                     -- renamed from play_style (handled by proposal #51)
    training_focus, training_intensity, training_schedule,
    founded_year, colors_primary, colors_secondary,
    starting_xi_ids, active_lineup_ids, team_roles,
    form, history, training_groups,
    weekly_scrim_opponent_ids, scrim_loss_streak,
    scrim_weekly_played, scrim_weekly_wins, scrim_weekly_losses,
    scrim_slot_results,
    financial_ledger, sponsorship, facilities,
    team_kind, parent_team_id, academy_team_id, academy_metadata
);

INSERT INTO teams_new SELECT
    (all columns EXCEPT formation)
FROM teams;

DROP TABLE teams;
ALTER TABLE teams_new RENAME TO teams;
```

Hook: Rust code in `migrations.rs` runs before/after `SELECT COUNT(*)` to validate row count preservation. `MIGRATION_COUNT` bumped to 53.

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit (Rust) | Serde round-trip for renamed fields | `#[cfg(test)]` on each domain type — verify old JSON deserializes, new JSON round-trips |
| Unit (Rust) | V53 migration | Insert team with formation, run migration, verify formation column gone, row count same |
| Unit (Rust) | `kill_difference()` | Test computes `kills_for - kills_against` |
| Unit (Rust) | `StandingEntry` no drawn | `record_result()` with equal kills — verify points but no drawn |
| Unit (TS) | SquadTab helpers | `buildLaneRows()` returns 5 rows, `buildActiveLineupIds()` picks correct role per slot |
| Unit (TS) | types.ts types | `CompactTeamMatchStatsData` has LoL fields only |
| Integration (Rust) | Save load with old formation | Load save with `"formation": "4-4-2"` — deserializes without error |
| Integration (Rust) | `WorldEditorTab` | Generated player has no `football_nation`, role is LoL role |

## Implementation Order (dependency-aware)

### Phase A sequence:
1. **domain types** (no deps) → `team.rs` (remove formation), `player.rs` (goals→kills, remove clean_sheets), `league.rs` (remove drawn, rename goal_difference)
2. **engine types** → `types.rs` remove formation from TeamData
3. **V53 migration** → create SQL + hook in migrations.rs (bump MIGRATION_COUNT)
4. **store types** → `CompactTeamMatchStatsData`, remove football_nation, remove drawn
5. **SquadTab helpers** → rewrite (retain exports used by TacticsTab)
6. **WorldEditorTab** → remove football_nation, fix default role

### Phase B sequence:
7. **Proposal #51 integration** → PlayStyle→DraftStrategy (import existing design)
8. **i18n keys** → footballHerald→lolEsports, pitchInteractionHint→riftInteractionHint
9. **Scripts** → generate-lec-world.mjs (remove footballNation)
10. **Logo** → remove openfootlogo.svg, update MainMenu
11. **countries.ts** → FOOTBALL_IDENTITIES→LEGACY_NATIONAL_IDENTITIES
12. **TacticsTab.helpers** → FORMATIONS + play style descriptions

### Phase C sequence:
13. **Deprecation annotations** → Position `#[deprecated]`
14. **Test data** → save_manager, legacy_migration
15. **Comments** → all `football` → `legacy` references
16. **Archive** → proposals to docs/legacy/

## Risks and Mitigations

| Risk | Prob | Mitigation |
|------|------|------------|
| `buildPitchRows` consumers elsewhere | Medium | Grep all `import { buildPitchRows }` — TacticsTab is primary consumer |
| SquadTab.tsx tightly coupled to PitchSlotRow | High | Rewrite SquadTab.tsx to use ActiveLineupSlot[] directly (one-time change) |
| Deserializing old saves without `formation` | Low | `#[serde(default)]` handles missing field |
| V53 migration fails on old save files | Low | Hook validates row count before/after; rollback = restore from backup |
| `goal_difference()` called externally | Low | Rename is method-only; callers in sorted_standings() + round_summary.rs + news.rs updated in same commit |
| `drawn` accessed by external code | Low | Only accessed within league.rs (record_result, StandingEntry::new). Frontend StandingData.drawn removed in same commit |

## Open Questions

- [ ] What LoL award replaces `clean_sheet_king` in season_awards.rs? Proposal suggests `games_with_zero_deaths` or `kda_threshold` — needs design decision
- [ ] SquadTab.tsx rewrite scope: should the visualization be a vertical role list or a Summoner's Rift map? Design favors simple vertical list (MVP pragmatism)
- [ ] `data/default_teams.json`: domain `stadium_name` kept (user decision) — do we still update the JSON's field name? Yes, for consistency
