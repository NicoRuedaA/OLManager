# Delta Spec: Squad Domain (Frontend)

## Purpose

Update frontend squad management UI and filtering to use `LolRole` instead of legacy football `Position` strings.

## MODIFIED Requirements

### Requirement: PlayerData uses LolRole strings

The `PlayerData` interface MUST use `LolRole` values for position fields.
(Previously: Used legacy Position strings like "Striker", "CenterBack", "Goalkeeper")

#### Scenario: TypeScript LolRole type

- GIVEN the type definition `type LolRole = "Top" | "Jungle" | "Mid" | "ADC" | "Support"`
- WHEN `PlayerData.position` is typed
- THEN it MUST be `LolRole` (not `string`)
- AND the type MUST be enforced at compile time

#### Scenario: Deserialize player with LoL role

- GIVEN API response with `"position": "Mid"`
- WHEN the player data is typed as `PlayerData`
- THEN `position` MUST be assignable to `LolRole`
- AND invalid role strings MUST cause type errors

### Requirement: Position badge variants updated

Position badge color variants MUST map to LoL roles instead of football positions.
(Previously: Mapped to Goalkeeper, Defender, Midfielder, Forward groups)

#### Scenario: Badge variant for Top

- GIVEN a player with `position: "Top"`
- WHEN the position badge is rendered
- THEN it MUST use the "primary" variant (blue)

#### Scenario: Badge variant for Jungle

- GIVEN a player with `position: "Jungle"`
- WHEN the position badge is rendered
- THEN it MUST use the "success" variant (green)

#### Scenario: Badge variant for Mid

- GIVEN a player with `position: "Mid"`
- WHEN the position badge is rendered
- THEN it MUST use the "warning" variant (yellow)

#### Scenario: Badge variant for ADC

- GIVEN a player with `position: "ADC"`
- WHEN the position badge is rendered
- THEN it MUST use the "danger" variant (red)

#### Scenario: Badge variant for Support

- GIVEN a player with `position: "Support"`
- WHEN the position badge is rendered
- THEN it MUST use the "accent" variant (purple)

### Requirement: Position filtering uses LolRole

Squad filtering by position MUST use `LolRole` values.
(Previously: Filtered by Position strings like "Striker", "Defender")

#### Scenario: Filter by Top role

- GIVEN squad filter set to "Top"
- WHEN the player list is filtered
- THEN only players with `position === "Top"` MUST be shown
- AND the count MUST update to reflect filtered results

#### Scenario: Filter by multiple roles

- GIVEN squad filter set to ["Jungle", "Support"]
- WHEN the player list is filtered
- THEN players with either role MUST be shown
- AND the filter pills MUST display "Jungle, Support"

### Requirement: Role display names i18n

Role display names MUST be localized through i18n keys.
(Previously: Position names displayed directly)

#### Scenario: Display localized role names

- GIVEN locale set to "es" (Spanish)
- WHEN role "Top" is displayed
- THEN it MUST show "Top" (or localized equivalent from i18n)
- AND the key MUST be `role.top`

#### Scenario: All roles have i18n keys

- GIVEN the i18n translation files
- WHEN checking for role keys
- THEN these keys MUST exist:
  - `role.top`
  - `role.jungle`
  - `role.mid`
  - `role.adc`
  - `role.support`

## ADDED Requirements

### Requirement: Role coverage indicator

The squad UI MUST display role coverage completeness.

#### Scenario: Show missing roles

- GIVEN a squad missing Jungle and Support roles
- WHEN the squad tab is viewed
- THEN a warning MUST display: "Missing roles: Jungle, Support"
- AND the warning MUST link to transfer/scouting suggestions

#### Scenario: Complete role coverage indicator

- GIVEN a squad with all 5 roles covered
- WHEN the squad tab is viewed
- THEN a success indicator MUST show "Complete squad"
- AND each role icon MUST be highlighted

## MODIFIED Requirements

### Requirement: Player rating helpers use LolRole

Player rating calculation helpers MUST accept `LolRole` instead of Position strings.
(Previously: `calculatePositionalOVR(player, "CentralMidfielder")`)

#### Scenario: Calculate OVR for role

- GIVEN a player and role "Mid"
- WHEN `calculatePositionalOVR(player, "Mid")` is called
- THEN it MUST return the Mid-specific OVR rating
- AND the calculation MUST match backend logic

#### Scenario: Best role detection

- GIVEN a player with attributes
- WHEN best role is determined
- THEN it MUST return the `LolRole` with highest calculated OVR
- AND display the role name with rating

## REMOVED Requirements

### Requirement: Legacy position helpers

(Reason: 19 football positions replaced by 5 LoL roles)

#### Scenario: Remove positionBadgeVariant legacy mappings

- GIVEN code using `positionBadgeVariant("Striker")` or `positionBadgeVariant("CenterBack")`
- WHEN the function is called
- THEN it MUST return "primary" (fallback) for unknown positions
- AND the function SHOULD be refactored to use `LolRole` type

#### Scenario: Remove legacy position filtering

- GIVEN code filtering by "Goalkeeper", "Defender", "Midfielder", "Forward" groups
- WHEN the filter is applied
- THEN it MUST be updated to use `LolRole` values directly
- AND group-based filtering MUST be removed

---

## Role-to-UI Mapping

| LoL Role | Badge Variant | Icon | i18n Key |
|----------|---------------|------|----------|
| Top | primary | Shield | role.top |
| Jungle | success | Tree | role.jungle |
| Mid | warning | Bolt | role.mid |
| ADC | danger | Target | role.adc |
| Support | accent | Heart | role.support |

## Migration Notes

- Update `positionBadgeVariant()` function to accept `LolRole`
- Remove `positionGroup()` helper (no longer needed)
- Update all filter components to use `LolRole` union type
- Ensure i18n files include all 5 role keys
- Update test fixtures to use LoL roles instead of football positions
