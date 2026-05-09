# Delta: Domain Rust Types (src-tauri/crates/domain/)

## Context

This delta removes all football terminology from the domain types. These types are the source of truth for the `ts-rs` TypeScript bindings and affect the frontend store types.

---

## REMOVED Requirements

### Requirement: StandingEntry.goal_difference()

Renamed to `kill_difference()`.
(Reason: Football term `goal_difference` is semantically incorrect for LoL esports.)

#### Scenario: kill_difference computes correctly

- GIVEN a StandingEntry with `kills_for: 15` and `kills_against: 10`
- WHEN `kill_difference()` is called
- THEN it MUST return `5`

#### Scenario: kill_difference with zero values

- GIVEN a StandingEntry with `kills_for: 0` and `kills_against: 0`
- WHEN `kill_difference()` is called
- THEN it MUST return `0`

### Requirement: StandingEntry.drawn field

Removed from StandingEntry struct.
(Reason: LoL has no draws — every map/game has a winner.)

#### Scenario: StandingEntry serializes without drawn

- GIVEN a StandingEntry with `won: 5, lost: 3`
- WHEN serialized to JSON
- THEN the output MUST NOT contain a `drawn` field

### Requirement: Team.formation field

Removed from Team struct. Requires V43 DB migration.
(Reason: Formation is a football concept. LoL always uses 5 roles.)

#### Scenario: Team struct compiles without formation

- GIVEN a Team struct
- THEN it MUST NOT have a `formation` field
- AND `Team::new()` MUST NOT accept or set a formation

#### Scenario: Old saves with formation deserialize without error

- GIVEN a JSON payload with `"formation": "4-4-2"`
- WHEN deserialized into Team with `#[serde(default)]` on removed field
- THEN it MUST succeed with `formation` silently dropped

### Requirement: PlayerSeasonStats.clean_sheets field

Deprecated and removed from PlayerSeasonStats.
(Reason: Clean sheets is a football goalkeeper stat, irrelevant to LoL.)

#### Scenario: PlayerSeasonStats compiles without clean_sheets

- GIVEN a PlayerSeasonStats struct
- THEN it MUST NOT have a `clean_sheets` field

#### Scenario: Old save data with clean_sheets deserializes

- GIVEN JSON with `"clean_sheets": 5`
- WHEN deserialized into PlayerSeasonStats
- THEN it MUST NOT error; the field MUST be silently dropped

### Requirement: Footedness enum

Deprecated and removed from Player domain type.
(Reason: Footedness is a football concept. LoL roles are lane-agnostic.)

#### Scenario: Player compiles without footedness

- GIVEN a Player struct
- THEN it MUST NOT have a `footedness` field

#### Scenario: Legacy JSON with footedness deserializes safely

- GIVEN JSON with `"footedness": "Right"`
- WHEN deserialized into Player
- THEN it MUST succeed with the field dropped

### Requirement: Position enum - add #[deprecated]

Add `#[deprecated]` attribute on the Position enum with a doc link pointing to LolRole.
(Reason: Position is kept for legacy save deserialization but should signal deprecation.)

#### Scenario: Position enum usage triggers deprecation warning

- GIVEN code that references `Position::Goalkeeper`
- WHEN compiled
- THEN a deprecation warning MUST point to `LolRole` as the replacement

---

## ADDED Requirements

### Requirement: Arena/stadium naming preserved

The `stadium_name` and `stadium_capacity` fields on Team MUST remain unchanged.
(Reason: User explicitly decided to keep "stadium" terminology.)

#### Scenario: Team stadium fields remain intact

- GIVEN a Team struct
- THEN `stadium_name: String` and `stadium_capacity: u32` MUST still exist
- AND `Team::new()` MUST still accept stadium parameters
