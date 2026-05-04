# Tasks: Replace PlayStyle enum with LoL DraftStrategy

## Phase 1: Foundation – Enum & Field Definitions

- [ ] 1.1 Add `DraftStrategy` enum to `src-tauri/crates/domain/src/team.rs` with variants `Balanced`, `Aggressive`, `Passive`, `Scaling`, `CounterPick`, `PriorityBans` and serde renames for old variant names (`Attacking`, `Defensive`, `Possession`, `Counter`, `HighPress`).
- [ ] 1.2 Rename `Team.play_style` field to `draft_strategy` and add `#[serde(alias = "play_style")]` in the same file.
- [ ] 1.3 Replace `PlayStyle` enum in `src-tauri/crates/engine/src/types.rs` with `DraftStrategy` (mirror of domain enum, same serde renames).
- [ ] 1.4 Update `src-tauri/crates/engine/src/shared.rs` to use `DraftStrategy` in `play_style_modifier` match arms; decide numeric modifiers for `Aggressive` (use HighPress values for attack and press phases, HighPress defense value for defense phase).
- [ ] 1.5 Update `src-tauri/crates/engine/src/lib.rs` export to use `DraftStrategy` instead of `PlayStyle`.

## Phase 2: Core Rust References (≈173 matches)

- [ ] 2.1 Update `src-tauri/crates/ofm_core/src/generator/generation.rs` – replace `PlayStyle` import and `play_style_from_str` mapping.
- [ ] 2.2 Update `src-tauri/crates/ofm_core/src/turn/mod.rs` – replace domain→engine conversion match.
- [ ] 2.3 Update `src-tauri/crates/ofm_core/src/live_match_manager/team_builder.rs` – replace conversion.
- [ ] 2.4 Update `src-tauri/crates/db/src/repositories/team_repo.rs` – replace `parse_play_style` mapping.
- [ ] 2.5 Global search‑and‑replace `PlayStyle` with `DraftStrategy` across all remaining Rust files in `src-tauri/crates/ofm_core/`, `src-tauri/crates/engine/`, `src-tauri/crates/db/`, `src-tauri/src/commands/`.
- [ ] 2.6 Update any string literals `"Attacking"`, `"Defensive"`, etc., that are used in UI or logging to new variant names (if needed).
- [ ] 2.7 Ensure all Rust tests compile and adjust test data to use new enum values.

## Phase 3: Frontend Updates

- [ ] 3.1 Update `src/components/match/types.ts` – replace `PLAY_STYLES` constant with new IDs/labels.
- [ ] 3.2 Update `src/components/match/lol-prototype/engine/simulation.ts` – replace `style === "HighPress"` etc., with `style === "Aggressive"`; adjust `styleAggro` mapping for `Aggressive`.
- [ ] 3.3 Update `src/components/tactics/TacticsTab.helpers.ts` – replace `HighPress` reference.
- [ ] 3.4 Update all frontend test files that contain `play_style: "Balanced"` etc., to use new variant names (or keep as is if serde rename ensures backward compatibility – but better to update).
- [ ] 3.5 Verify that the frontend dropdown renders the new labels correctly.

## Phase 4: Testing & Verification

- [ ] 4.1 Write serde round‑trip tests for `DraftStrategy` (Rust) – ensure `"Attacking"` deserializes to `Aggressive` and serializes back to `"Attacking"`.
- [ ] 4.2 Update existing integration tests in `src-tauri/crates/engine/tests/` to use new enum.
- [ ] 4.3 Add frontend unit test for `styleAggro` mapping with new enum values.
- [ ] 4.4 Run the full test suite (`cargo test` and `npm test`) and fix any failures.
- [ ] 4.5 Manual test: load an existing save file and verify that team draft strategies are correctly mapped.

## Phase 5: Cleanup

- [ ] 5.1 Remove any leftover `PlayStyle` references (except serde aliases) – verify with grep.
- [ ] 5.2 Update any documentation that mentions `PlayStyle` (e.g., README, internal docs).