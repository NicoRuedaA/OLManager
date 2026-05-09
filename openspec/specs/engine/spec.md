# Delta: Engine Crate (src-tauri/crates/engine/)

## Context

Replace Football terminology in the engine simulation crate. `PlayStyle` is renamed to `DraftStrategy` (separate proposal #51). Formation field in TeamData is removed. Comment/doc cleanup.

---

## MODIFIED Requirements

### Requirement: Engine TeamData formation field removed

The `TeamData.formation` field MUST be removed from `engine/src/types.rs`.
(Previously: `pub formation: String` with default `"4-4-2"`)

#### Scenario: TeamData compiles without formation

- GIVEN a TeamData struct
- THEN it MUST NOT contain a `formation` field
- AND test helpers creating TeamData MUST NOT set formation

### Requirement: PlayStyle to DraftStrategy (ref proposal #51)

The `PlayStyle` enum in `engine/src/types.rs` MUST be replaced by `DraftStrategy` as specified in proposal `#51-draft-strategy`.
(Previously: 6 football variants — Balanced, Attacking, Defensive, Possession, Counter, HighPress)

#### Scenario: Engine uses DraftStrategy

- GIVEN the engine types module
- THEN it MUST export `DraftStrategy` with variants: Balanced, Aggressive, Passive, Scaling, CounterPick, PriorityBans
- AND old variant names MUST deserialize via serde rename
- AND `play_style` field name MUST be aliased to `draft_strategy`

#### Scenario: Simulation config forwards DraftStrategy

- GIVEN `engine/src/shared.rs` play_style_modifier
- THEN it MUST accept `DraftStrategy` variants as input
- AND Aggressive modifier MUST merge Attacking + HighPress weights

---

## REMOVED Requirements

### Requirement: Comment cleanup

All Rust comments in the engine crate referencing "football", "pitch", "goalkeeper", "soccer", etc. MUST be updated to LoL terminology or removed.

#### Scenario: No football terms in engine comments

- GIVEN grep for `(?i)(football|soccer|pitch|goalkeeper)` in engine/src/
- WHEN searching Rust comments (// and ///)
- THEN zero matches MUST be found, except direct legacy code references
