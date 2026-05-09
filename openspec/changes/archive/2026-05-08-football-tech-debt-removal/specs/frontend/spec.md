# Delta: Frontend Types and Components (src/)

## Context

Remove football terminology from frontend TypeScript types, components, and test data. This includes store types, SquadTab helpers, i18n keys, and WorldEditor.

---

## REMOVED Requirements

### Requirement: SquadTab.helpers.ts football rewrite

The football pitch visualization system (buildPitchRows, parseFormationSlats, CORE_POSITIONS, CANONICAL_POSITION_MAP, POSITION_GROUPS, POSITION_LABELS, POSITION_CODES, buildPitchSlotRows) MUST be replaced with a LoL lineup builder.

(Reason: Entire helper is football-based with 30+ position abbreviations, goalkeeper/defender/midfielder/forward groupings, and formation parsing.)

#### Scenario: CORE_POSITIONS eliminated

- GIVEN SquadTab.helpers.ts
- THEN `CORE_POSITIONS` MUST NOT contain `Goalkeeper`, `Defender`, `Midfielder`, `Forward`

#### Scenario: CANONICAL_POSITION_MAP eliminated

- GIVEN SquadTab.helpers.ts
- THEN `CANONICAL_POSITION_MAP` (30+ football positions) MUST be removed
- AND the only valid positions MUST be LoL roles: TOP, JUNGLE, MID, ADC, SUPPORT

#### Scenario: buildPitchRows replaced

- GIVEN SquadTab.helpers.ts
- THEN `buildPitchRows` MUST NOT exist — replaced by `buildActiveLineupSlots`
- AND the lineup builder MUST use `LOL_ACTIVE_ROLES` (5 roles) instead of formation parsing

### Requirement: football_nation from PlayerData

The `football_nation?: string` field MUST be removed from `PlayerData` in store/types.ts.

#### Scenario: PlayerData without football_nation

- GIVEN the PlayerData interface
- THEN it MUST NOT contain a `football_nation` field

### Requirement: CompactTeamMatchStatsData football fields removed

Replace `CompactTeamMatchStatsData` interface in types.ts — remove `shots`, `shots_on_target`, `fouls`, `corners`, `yellow_cards`, `red_cards`. Replace with LoL stats: `kills`, `deaths`, `gold_earned`, `damage_dealt`, `objectives`.
(Reason: These are football-specific stats — shots, fouls, cards, corners.)

#### Scenario: CompactTeamMatchStatsData has LoL stats

- GIVEN a `CompactTeamMatchStatsData` instance
- THEN it MUST contain `kills: number`, `deaths: number`, `gold_earned: number`, `damage_dealt: number`, `objectives: number`
- AND it MUST NOT contain `shots`, `shots_on_target`, `fouls`, `corners`, `yellow_cards`, `red_cards`

### Requirement: yellow_cards/red_cards removal

Remove `yellow_cards` and `red_cards` from all frontend types and test fixtures.
(Reason: Cards are football-specific discipline mechanisms.)

#### Scenario: No yellow/red cards in types

- GIVEN store/types.ts
- THEN `yellow_cards` and `red_cards` MUST NOT appear in any interface

### Requirement: ManagerCareerStats.draws removal

Remove `draws?: number` from `ManagerCareerStats` interface and `draws: number` from `ManagerCareerEntry`.
(Reason: LoL has no draws.)

#### Scenario: ManagerCareerStats without draws

- GIVEN a `ManagerCareerStats` object
- THEN it MUST NOT have a `draws` field

### Requirement: WorldEditorTab.tsx football_nation generation

The `createNewPlayer()` function MUST NOT set `football_nation`.

#### Scenario: New players without football_nation

- GIVEN `createNewPlayer()` in WorldEditorTab.tsx
- THEN the returned player object MUST NOT contain `football_nation`

---

## MODIFIED Requirements

### Requirement: SquadTab.helpers.ts LoL-first logic

Functions `buildStartingXIIds`, `buildActiveLineupIds`, `buildActiveLineupSlots` MUST remain but their internal logic MUST reference `LOL_ACTIVE_ROLES` (5 roles) instead of formation-based parsing.

(Previously: formation string parsing to determine XI lineup)

#### Scenario: buildActiveLineupIds uses 5 roles

- GIVEN `buildActiveLineupIds(available, savedIds)`
- WHEN called with 10 available players across roles
- THEN it MUST return exactly 5 IDs (one per LoL role)
- AND each role MUST be represented at most once

### Requirement: translatePositionLabel cleaned up

Remove football position label mappings (`Goalkeeper`, `Defender`, etc.) from `POSITION_LABELS` and `translatePositionLabel`. Keep only LoL role labels.

(Previously: both football and LoL position labels were available)

#### Scenario: Only LoL role labels in POSITION_LABELS

- GIVEN `POSITION_LABELS` in SquadTab.helpers.ts
- THEN it MUST only contain keys: `TOP`, `JUNGLE`, `MID`, `ADC`, `SUPPORT`
- AND football keys MUST be removed

### Requirement: i18n football keys stripped

Remove `be.source.footballHerald` and `pitchInteractionHint` from all locale JSON files.

#### Scenario: No footballHerald in locales

- GIVEN each locale JSON file (en, es, de, fr, it, pt, pt-BR, tr)
- WHEN searched for `footballHerald` and `pitchInteractionHint`
- THEN neither key MUST exist

### Requirement: footballTermGuard.test.ts → guard.ts

Rename `src/i18n/locales/footballTermGuard.test.ts` to remove the `footballTermGuard` name. Move to `src/content/lol/social/guard.test.ts` or equivalent, renaming the concept to just `guard`.

(Previously: `footballTermGuard.test.ts` — named after the football term it was guarding against)

#### Scenario: File renamed

- GIVEN the filesystem
- THEN `src/i18n/locales/footballTermGuard.test.ts` MUST NOT exist
- AND a file named `guard.test.ts` MUST exist in its place with equivalent test logic
