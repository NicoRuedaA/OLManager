# Team Tactics Specification

## Purpose

Describes how the `Team` struct stores and exposes its draft strategy, ensuring backward compatibility with existing save files and seamless integration with the match simulation engine.

## Requirements

### Requirement: Team Draft Strategy Field

The `Team` struct MUST contain a field named `draft_strategy` of type `DraftStrategy`. The field MUST be serialized as `"draft_strategy"` but MUST also accept `"play_style"` as an alias during deserialization.

#### Scenario: Serialization of new team

- GIVEN a newly created `Team` instance
- WHEN serialized to JSON
- THEN the output MUST contain `"draft_strategy": "Balanced"`

#### Scenario: Deserialization of legacy save

- GIVEN a JSON object representing a team with `"play_style": "Possession"`
- WHEN deserialized into a `Team` struct
- THEN the `draft_strategy` field MUST be `Scaling`
- AND the field name in the resulting struct MUST be `draft_strategy`

### Requirement: Engine Mirroring

The engine crate MUST define its own `DraftStrategy` enum that mirrors the domain enum. The engine enum MUST be identical in variant names and serialization behavior.

#### Scenario: Engine type conversion

- GIVEN a domain `DraftStrategy` value
- WHEN passed to the engine via `TeamData`
- THEN the engine MUST accept the value without conversion errors
- AND the simulation MUST apply the correct modifiers for that strategy

### Requirement: Simulation Modifiers

The match simulation engine MUST apply different numeric modifiers based on the team's `draft_strategy`. The mapping of strategy to modifiers MUST be deterministic and documented.

#### Scenario: Aggressive strategy attack phase

- GIVEN a team with `draft_strategy` set to `Aggressive`
- WHEN the match enters an attack phase for that team
- THEN the attack modifier MUST be 1.12 (previously Attacking bonus)

#### Scenario: Aggressive strategy press phase

- GIVEN a team with `draft_strategy` set to `Aggressive`
- WHEN the match enters a press phase for that team
- THEN the press modifier MUST be 1.20 (previously HighPress bonus)

#### Scenario: Passive strategy defense phase

- GIVEN a team with `draft_strategy` set to `Passive`
- WHEN the match enters a defense phase for that team
- THEN the defense modifier MUST be 1.12 (previously Defensive bonus)

### Requirement: Frontend Consistency

The frontend MUST display draft strategy options using the new variant names. The UI labels SHOULD match the variant names (e.g., "Aggressive") but MAY be localized.

#### Scenario: Play style selector

- GIVEN the tactics configuration screen
- WHEN the user opens the draft strategy dropdown
- THEN the list MUST include all six `DraftStrategy` variants
- AND each option MUST use the new variant name as its identifier