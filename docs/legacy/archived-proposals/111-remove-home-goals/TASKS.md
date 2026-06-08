# Tasks: Remove `home_goals`/`away_goals` from `engine::MatchReport`

## Phase 1: Struct Definition

- [ ] 1.1 Remove `home_goals`/`away_goals` fields + `#[serde(default, skip_serializing)]` from `engine/src/report.rs::MatchReport` (lines 75-78)
- [ ] 1.2 Remove `home_goals: home_wins` / `away_goals: away_wins` from `Self` constructor in `engine/src/report.rs` (lines 292-293)

## Phase 2: Update Consumers

- [ ] 2.1 Remove `home_goals: home_wins` / `away_goals: away_wins` from `src/application/live_match.rs` struct literal (lines 260-261)
- [ ] 2.2 Replace all 11 `.home_goals` / `.away_goals` reads with `.home_wins` / `.away_wins` in `engine/tests/simulation_tests.rs`
- [ ] 2.3 Drop `home_goals`/`away_goals` params from `empty_report`, `report_with_scorer`, `full_squad_report` helpers + remove struct fields in `ofm_core/tests/turn_tests.rs` (~8 locations)
- [ ] 2.4 Remove inline `home_goals`/`away_goals` struct fields from test assertions in `ofm_core/tests/turn_tests.rs` (lines 578, 602)
- [ ] 2.5 Drop `home_goals`/`away_goals` params from `make_report` helper + remove struct fields in `ofm_core/src/turn/news.rs` (~4 locations)

## Phase 3: Verification

- [ ] 3.1 `cargo build -p engine -p ofm_core` — confirm compilation succeeds
- [ ] 3.2 `cargo test -p engine` — confirm all simulation tests pass
- [ ] 3.3 `cargo test -p ofm_core` — confirm all turn/news tests pass
- [ ] 3.4 `rg "home_goals|away_goals" src-tauri/crates/engine/` — verify zero remaining references in engine crate
