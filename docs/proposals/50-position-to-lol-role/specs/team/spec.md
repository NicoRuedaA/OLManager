# Delta Spec: Team Domain

## Purpose

Update Team composition and squad building logic to use `LolRole` instead of `Position` for formation slots and player assignments.

## MODIFIED Requirements

### Requirement: TeamComposition position rows return LolRole

The `TeamComposition::position_rows()` method MUST return `Vec<Vec<LolRole>>` instead of `Vec<Vec<Position>>`.
(Previously: Returned football-specific Position variants like Goalkeeper, CenterBack, Striker)

#### Scenario: Standard composition returns LoL roles

- GIVEN `TeamComposition::Standard`
- WHEN `position_rows()` is called
- THEN it MUST return 5 rows mapped to LoL roles:
  - Row 0: [Top] (replaces GK)
  - Row 1: [Top, Jungle, Mid] (defensive line)
  - Row 2: [Jungle, Mid, Support] (mid line)
  - Row 3: [Mid, Adc, Support] (attack line)
  - Row 4: [Adc] (carry slot)

#### Scenario: All compositions return exactly 5 roles

- GIVEN any `TeamComposition` variant
- WHEN `position_rows()` is called
- THEN it MUST return exactly 5 `LolRole` entries total
- AND each role (Top, Jungle, Mid, Adc, Support) MUST appear exactly once

#### Scenario: Composition slot helpers use LolRole

- GIVEN `formation_slots(TeamComposition)` function
- WHEN called with any composition
- THEN it MUST accept `TeamComposition` and return `Vec<LolRole>`
- AND the result MUST contain exactly 5 roles

## ADDED Requirements

### Requirement: Role coverage validation

The system MUST validate that a team roster covers all 5 LoL roles.
(Previously: Role coverage was implicit in formation slots)

#### Scenario: Validate complete role coverage

- GIVEN a roster with players having natural positions: Top, Jungle, Mid, Adc, Support
- WHEN role coverage is checked
- THEN the system MUST report "complete coverage"
- AND no blocker warnings SHOULD be generated

#### Scenario: Detect missing roles

- GIVEN a roster missing a Support role player
- WHEN role coverage is checked
- THEN the system MUST report missing role: "Support"
- AND generate a blocker warning for incomplete squad

## MODIFIED Requirements

### Requirement: Formation slot generation uses LolRole

Formation slot generation functions MUST use `LolRole` instead of `Position`.
(Previously: Used `Position::Goalkeeper`, `Position::CenterBack`, etc.)

#### Scenario: Generate standard formation slots

- GIVEN the need for standard formation slots
- WHEN slots are generated
- THEN they MUST be: `[Top, Jungle, Mid, Adc, Support]`
- AND the order MUST be lane order: Top → Jungle → Mid → Adc → Support

#### Scenario: Slot rows maintain team structure

- GIVEN a composition with role rows
- WHEN the rows are iterated
- THEN row 0 MUST contain Top role
- AND row 1 MUST contain Jungle role
- AND row 2 MUST contain Mid role
- AND row 3 MUST contain Adc role
- AND row 4 MUST contain Support role

## REMOVED Requirements

### Requirement: Football formation line helpers

(Reason: LoL uses fixed 5-role structure instead of flexible football formations)

#### Scenario: Defender/midfielder/forward line helpers removed

- GIVEN code calling `defender_line(4)`, `midfield_line(4)`, or `forward_line(2)`
- WHEN compilation runs
- THEN it MUST fail with "function not found" error
- AND the code MUST be updated to use `LolRole`-based slot generation

---

## Role-to-Formation Mapping

| LoL Role | Old Football Line | Position Mapping |
|----------|------------------|------------------|
| Top | Defender line | LeftBack, CenterBack, RightBack, LeftWingBack, RightWingBack, Defender |
| Jungle | Midfield line | Midfielder, CentralMidfielder |
| Mid | Attacking midfield | AttackingMidfielder, LeftMidfielder, RightMidfielder |
| Adc | Forward line | Forward, Striker, LeftWinger, RightWinger |
| Support | Goalkeeper/Defensive | Goalkeeper, DefensiveMidfielder |

## Implementation Notes

- `TeamComposition` variants map to different tactical approaches in LoL
- Each composition MUST still return exactly 5 roles (one per player)
- Role order in rows reflects tactical priority, not football line structure
