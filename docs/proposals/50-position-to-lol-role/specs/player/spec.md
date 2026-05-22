# Delta Spec: Player Domain

## Purpose

Replace the `Position` enum with `LolRole` enum across all player-related structures, consolidating 19 football positions into 5 LoL roles.

## MODIFIED Requirements

### Requirement: Player uses LolRole instead of Position

The Player struct MUST use `LolRole` for `position`, `natural_position`, and `alternate_positions` fields.
(Previously: Used `Position` enum with 19 football-specific variants)

#### Scenario: New player with LoL role assignment

- GIVEN a new Player is created
- WHEN the player is initialized with a role
- THEN `position` MUST be set to the specified `LolRole`
- AND `natural_position` MUST default to the same `LolRole`
- AND `alternate_positions` MUST be an empty Vec<LolRole>

#### Scenario: Deserialize player from legacy save with Position

- GIVEN a JSON payload containing legacy `Position` strings (e.g., "Striker", "CenterBack")
- WHEN the Player is deserialized
- THEN the system MUST map legacy positions to `LolRole` using the conversion table:
  - Goalkeeper, DefensiveMidfielder → Support
  - Defender, RightBack, CenterBack, LeftBack, RightWingBack, LeftWingBack → Top
  - Midfielder, CentralMidfielder → Jungle
  - AttackingMidfielder, RightMidfielder, LeftMidfielder → Mid
  - Forward, RightWinger, LeftWinger, Striker → Adc
- AND deserialization MUST NOT fail for legacy saves

#### Scenario: Serialize player with LolRole

- GIVEN a Player with `LolRole::Mid` fields
- WHEN the player is serialized to JSON
- THEN the output MUST serialize as "Mid" (variant name)
- AND the serialized data MUST be deserializable back to `LolRole::Mid`

### Requirement: Remove Position enum and related methods

The `Position` enum and all associated methods MUST be removed from player.rs.
(Previously: `Position` enum with 19 variants and methods `is_legacy_bucket()`, `to_group_position()`)

#### Scenario: Position enum no longer exists

- GIVEN code referencing `player::Position` directly
- WHEN compilation runs
- THEN it MUST fail with "enum not found" error
- AND the code MUST be updated to use `stats::LolRole`

#### Scenario: Position grouping methods removed

- GIVEN code calling `position.is_legacy_bucket()` or `position.to_group_position()`
- WHEN compilation runs
- THEN it MUST fail with "method not found" error
- AND the logic MUST be refactored to use `LolRole` comparisons directly

## ADDED Requirements

### Requirement: LolRole variant mapping for legacy compatibility

The system MUST provide bidirectional mapping between legacy Position strings and LolRole variants.

#### Scenario: Map legacy position to LolRole

- GIVEN the string "Striker" (legacy Position)
- WHEN calling the mapping function
- THEN it MUST return `LolRole::Adc`

#### Scenario: Map LolRole to display name

- GIVEN `LolRole::Adc`
- WHEN displaying to user
- THEN it MUST show "ADC" (localized display name)

## REMOVED Requirements

### Requirement: Football-specific position granularity

(Reason: LoL roles are side-agnostic and position-independent. Replaced by 5 role-based system.)

#### Scenario: Right/Left side distinction removed

- GIVEN `LolRole::Top` (replaces LeftBack/RightBack distinction)
- WHEN evaluating player fitness for role
- THEN the system MUST NOT apply side-based penalties
- AND the rating MUST be role-based only

---

## Conversion Reference

| Legacy Position(s) | LoL Role | Rationale |
|-------------------|----------|-----------|
| Goalkeeper, DefensiveMidfielder | Support | Defensive playmakers |
| Defender, RightBack, CenterBack, LeftBack, RightWingBack, LeftWingBack | Top | Solo lane frontliners |
| Midfielder, CentralMidfielder | Jungle | Map-wide presence |
| AttackingMidfielder, RightMidfielder, LeftMidfielder | Mid | Primary playmakers |
| Forward, RightWinger, LeftWinger, Striker | Adc | Primary damage dealers |
