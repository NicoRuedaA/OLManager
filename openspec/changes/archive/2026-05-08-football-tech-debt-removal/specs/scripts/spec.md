# Delta: Scripts and Seed Data

## Context

Update scripts and seed data that still emit football terminology.

---

## REMOVED Requirements

### Requirement: football_nation from generate-lec-world.mjs

Remove `football_nation: "EUN"` from player generation and `football_nation: override.footballNation` from team generation in `scripts/generate-lec-world.mjs`.

#### Scenario: Generated JSON without football_nation

- GIVEN `generate-lec-world.mjs`
- WHEN it generates player and team objects
- THEN `football_nation` MUST NOT appear in any generated object
- AND the script runner's `footballNation` override MUST be removed

### Requirement: Generate seed without football_nation (Android)

The Android-specific seed generation script (if separate from the main generate script) MUST also stop emitting `football_nation`. If Android uses the same `generate-lec-world.mjs`, this is already covered by the above.

### Requirement: Clean_sheets, yellow_cards, red_cards from generate-lec-world.mjs

Remove `clean_sheets: 0`, `yellow_cards: 0`, `red_cards: 0` from the player stats block in `generate-lec-world.mjs`.

---

## MODIFIED Requirements

### Requirement: lec_world.json description updated

Change `"description"` in `src-tauri/databases/lec_world.json` from `"Mundo predefinido de League of Legends (LEC) para OpenFootManager adaptado."` to `"Mundo predefinido de League of Legends (LEC) para OLManager."`.

#### Scenario: Description references OLManager

- GIVEN lec_world.json line 3
- THEN the value MUST be `"Mundo predefinido de League of Legends (LEC) para OLManager."`

### Requirement: Formation references in test data

Replace formation strings `"4-4-2"` with LoL-appropriate data in Rust test fixtures across all crates.

#### Scenario: Test data uses LoL roster format

- GIVEN test JSON with `"formation": "4-4-2"`
- WHEN the formation field is removed from domain types
- THEN test data MUST NOT reference `"4-4-2"` as formation
- AND tests MUST compile without formation references

### Requirement: Offsides removal from test data

Remove any `offsides` references from test data (engine TOML test fixtures, if any).

#### Scenario: No offsides in test fixtures

- GIVEN all test data in src-tauri/
- WHEN searched for `offsides` or `offside`
- THEN zero matches MUST be found (excluding unrelated variable names)
