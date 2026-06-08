# Delta Spec: Player Rating Domain

## Purpose

Replace position-specific rating calculations with role-specific calculations using `LolRole` instead of `Position`.

## MODIFIED Requirements

### Requirement: Rating functions accept LolRole

All rating functions MUST accept `LolRole` instead of `Position` as the role parameter.
(Previously: `ovr_for_position(player, &Position)`, `effective_rating_for_assignment(player, &Position)`)

#### Scenario: Calculate OVR for LoL role

- GIVEN a player and `LolRole::Mid`
- WHEN `ovr_for_position(player, &LolRole::Mid)` is called
- THEN it MUST calculate rating using Mid-specific attribute weights
- AND return a value between 1.0 and 99.0

#### Scenario: Calculate effective rating for role assignment

- GIVEN a player, `LolRole::Jungle`, and slot assignment
- WHEN `effective_rating_for_assignment(player, &LolRole::Jungle)` is called
- THEN it MUST calculate base rating minus compatibility penalty
- AND MUST NOT apply side-based penalties (no Left/Right distinction)

### Requirement: Role-specific attribute weights

Weighted score calculations MUST use 5 LoL role weight maps instead of 19 position weight maps.
(Previously: Each of 19 positions had unique attribute weights)

#### Scenario: Top lane rating calculation

- GIVEN a player with attributes
- WHEN rating for `LolRole::Top` is calculated
- THEN the system MUST use Top-specific weights:
  - High weight: defending (22), strength (18), tackling (16)
  - Medium weight: positioning (14), aerial (12), stamina (10)
  - Low weight: decisions (8)

#### Scenario: Jungle rating calculation

- GIVEN a player with attributes
- WHEN rating for `LolRole::Jungle` is calculated
- THEN the system MUST use Jungle-specific weights:
  - High weight: decisions (20), vision (16), positioning (14)
  - Medium weight: stamina (14), pace (12), tackling (12)
  - Low weight: passing (8), teamwork (4)

#### Scenario: Mid lane rating calculation

- GIVEN a player with attributes
- WHEN rating for `LolRole::Mid` is calculated
- THEN the system MUST use Mid-specific weights:
  - High weight: vision (22), passing (18), decisions (16)
  - Medium weight: dribbling (12), positioning (12), composure (10)
  - Low weight: shooting (6), pace (4)

#### Scenario: ADC rating calculation

- GIVEN a player with attributes
- WHEN rating for `LolRole::Adc` is calculated
- THEN the system MUST use ADC-specific weights:
  - High weight: shooting (24), positioning (18), decisions (14)
  - Medium weight: dribbling (12), composure (12), pace (10)
  - Low weight: vision (6), stamina (4)

#### Scenario: Support rating calculation

- GIVEN a player with attributes
- WHEN rating for `LolRole::Support` is calculated
- THEN the system MUST use Support-specific weights:
  - High weight: vision (20), positioning (18), teamwork (16)
  - Medium weight: decisions (14), passing (14), composure (10)
  - Low weight: stamina (4), tackling (4)

### Requirement: Critical penalty uses role-based minimums

The critical penalty calculation MUST use `LolRole` for determining minimum attribute thresholds.
(Previously: Used `Position` with side-specific logic)

#### Scenario: Role-based critical penalty

- GIVEN a player with low attributes
- WHEN critical penalty is calculated for `LolRole`
- THEN it MUST check the minimum of role-critical attributes:
  - Top: defending.min(tackling).min(positioning)
  - Jungle: decisions.min(vision).min(positioning)
  - Mid: vision.min(passing).min(decisions)
  - Adc: shooting.min(positioning).min(decisions)
  - Support: vision.min(positioning).min(teamwork)

### Requirement: Compatibility penalty uses LolRole

The compatibility penalty calculation MUST compare `LolRole` values instead of `Position`.
(Previously: Compared canonical positions and used `to_group_position()`)

#### Scenario: Natural role match

- GIVEN a player with `natural_position: LolRole::Mid`
- WHEN assigned to `LolRole::Mid` slot
- THEN compatibility penalty MUST be 0.0

#### Scenario: Alternate role match

- GIVEN a player with `natural_position: LolRole::Top` and `alternate_positions: [LolRole::Jungle]`
- WHEN assigned to `LolRole::Jungle` slot
- THEN compatibility penalty MUST be 4.0 (reduced penalty for alternate)

#### Scenario: Out-of-role assignment

- GIVEN a player with `natural_position: LolRole::Adc`
- WHEN assigned to `LolRole::Support` slot (not in alternates)
- THEN compatibility penalty MUST be 14.0 (full out-of-role penalty)

## REMOVED Requirements

### Requirement: Side-based footedness penalty

(Reason: LoL roles are lane-based, not side-based. No Left/Right distinction.)

#### Scenario: No side-based penalties

- GIVEN a player with `footedness: Right` and `weak_foot: 1`
- WHEN assigned to any `LolRole`
- THEN footedness penalty MUST always be 0.0
- AND the `slot_side()` function MUST be removed

### Requirement: Canonical position mapping

(Reason: `LolRole` is already canonical, no granular variants to normalize.)

#### Scenario: Remove canonical position logic

- GIVEN code calling `canonical_position(&position)`
- WHEN compilation runs
- THEN it MUST fail with "function not found" error
- AND the code MUST use `LolRole` directly without normalization

### Requirement: Position grouping methods

(Reason: LoL roles don't group into legacy buckets.)

#### Scenario: Remove position grouping

- GIVEN code using `position.to_group_position()` or `is_legacy_bucket()`
- WHEN compilation runs
- THEN it MUST fail with "method not found" error
- AND the code MUST be refactored to use direct `LolRole` comparisons

---

## Attribute Weight Reference

| Attribute | Top | Jungle | Mid | ADC | Support |
|-----------|-----|--------|-----|-----|---------|
| defending | 22 | 0 | 0 | 0 | 0 |
| strength | 18 | 0 | 0 | 0 | 0 |
| tackling | 16 | 12 | 0 | 0 | 4 |
| positioning | 14 | 14 | 12 | 18 | 18 |
| aerial | 12 | 0 | 0 | 0 | 0 |
| stamina | 10 | 14 | 0 | 4 | 4 |
| decisions | 8 | 20 | 16 | 14 | 14 |
| vision | 0 | 16 | 22 | 6 | 20 |
| passing | 0 | 8 | 18 | 0 | 14 |
| dribbling | 0 | 0 | 12 | 12 | 0 |
| composure | 0 | 0 | 10 | 12 | 10 |
| pace | 0 | 12 | 4 | 10 | 0 |
| shooting | 0 | 0 | 6 | 24 | 0 |
| teamwork | 0 | 4 | 0 | 0 | 16 |
| handling | 0 | 0 | 0 | 0 | 0 |
| reflexes | 0 | 0 | 0 | 0 | 0 |
| aggression | 0 | 0 | 0 | 0 | 0 |
| leadership | 0 | 0 | 0 | 0 | 0 |
