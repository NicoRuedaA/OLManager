# Draft Strategy Specification

## Purpose

Defines the LoL draft strategy enum used by teams to influence match simulation, AI behavior, and tactical decisions. This replaces the football-specific PlayStyle enum.

## Requirements

### Requirement: DraftStrategy Enum

The system MUST define a `DraftStrategy` enum with the following variants: `Balanced`, `Aggressive`, `Passive`, `Scaling`, `CounterPick`, `PriorityBans`.

#### Scenario: Enum serialization and deserialization

- GIVEN a `DraftStrategy` variant
- WHEN serialized to JSON
- THEN the output MUST be the variant name as a string (e.g., `"Aggressive"`)

#### Scenario: Backward compatibility with PlayStyle values

- GIVEN a JSON object containing `"play_style": "Attacking"`
- WHEN deserialized into a `Team` struct
- THEN the `draft_strategy` field MUST be `Aggressive`
- AND the same MUST hold for `"HighPress"` mapping to `Aggressive`

#### Scenario: Default variant

- GIVEN a new `Team` instance
- WHEN no draft strategy is specified
- THEN the `draft_strategy` field MUST default to `Balanced`

### Requirement: DraftStrategy Mapping

The system MUST map old `PlayStyle` variants to new `DraftStrategy` variants as follows:
- `Balanced` → `Balanced`
- `Attacking` → `Aggressive`
- `Defensive` → `Passive`
- `Possession` → `Scaling`
- `Counter` → `CounterPick`
- `HighPress` → `Aggressive`

#### Scenario: Legacy data migration

- GIVEN a saved game with `play_style` set to any old variant
- WHEN loaded after the update
- THEN the team's `draft_strategy` MUST reflect the mapped new variant
- AND the system MUST function identically (no loss of tactical behavior)

### Requirement: PriorityBans Variant

The system MUST support a `PriorityBans` draft strategy that influences ban phase decisions in match preparation.

#### Scenario: PriorityBans selection

- GIVEN a team with `draft_strategy` set to `PriorityBans`
- WHEN the match preparation ban phase executes
- THEN the team MUST prioritize banning opponent's high‑impact champions

#### Scenario: PriorityBans simulation effect

- GIVEN a team with `draft_strategy` set to `PriorityBans`
- WHEN the match simulation runs
- THEN the team MUST receive a bonus to ban effectiveness (MAY be implemented as a global modifier)