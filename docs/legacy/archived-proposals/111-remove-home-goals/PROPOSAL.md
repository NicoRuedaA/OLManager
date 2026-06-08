# Proposal: Remove `home_goals`/`away_goals` from `MatchReport`

## Intent

`engine::MatchReport` has two pairs of fields that represent the same thing:
`home_goals`/`away_goals` (always 0 or 1) and `home_wins`/`away_wins`. The
former are already `#[serde(skip_serializing)]` — pure dead weight. Remove them
to eliminate the redundancy and stop confusing "goals" terminology in a LoL
context. The actual kill count is tracked in `TeamStats.kills` / `KillDetail`.

## Scope

### In Scope
- Remove `home_goals` and `away_goals` from `engine::MatchReport`
- Update `engine::report::from_events_with_players()` — stop setting them
- Update `live_match.rs` — stop setting them in the struct literal
- Update engine `simulation_tests.rs` — replace reads of `.home_goals` /
  `.away_goals` with `.home_wins` / `.away_wins`
- Update `ofm_core` test helpers (`empty_report`, `report_with_scorer`,
  `full_squad_report`, `make_report`) — stop setting them
- Verify the crate compiles and tests pass

### Out of Scope
- `domain::league::Score` (has legitimate `home_wins` field with serde aliases)
- `domain::news::Score` (legitimate score with actual goal counts)
- `domain::message::MatchScore` (message payload, different struct)
- `ofm_core::turn::news::MatchResult` (dedicated score struct)
- `ofm_core::turn::round_summary::RoundScore` / `GameScore`
- Frontend TypeScript types (`NewsMatchScore`, `RoundResultSummary`, etc.)
- DB schema / migrations (no persisted data uses these fields since they were
  already `skip_serializing`)

## Capabilities

### New Capabilities
None — pure refactor, no new behavior.

### Modified Capabilities
None — no spec-level behavior changes. This is a struct cleanup, requirements
don't change.

## Approach

1. **Remove fields** from `MatchReport` struct definition (lines 75-78).
2. **Remove assignments** in `from_events_with_players()` (lines 292-293).
3. **Remove assignments** in `live_match.rs` (lines 260-261).
4. **Replace reads** in engine `simulation_tests.rs`:
   - `report.home_goals` → `report.home_wins`
   - `report.away_goals` → `report.away_wins`
   - `(report.home_goals, report.away_goals)` → `(report.home_wins, report.away_wins)`
5. **Drop parameters & assignments** in ofm_core test helpers:
   - `empty_report(home_goals, away_goals)` → only needs one param or just inline value
   - Same for `report_with_scorer`, `full_squad_report`, `make_report`
6. **Drop struct-literal fields** in inline `MatchReport { home_goals: ..., away_goals: ... }` in ofm_core tests.
7. Run `cargo build` and `cargo test` to confirm.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `engine/src/report.rs` | Modified | Remove 2 fields + 2 constructor lines |
| `src/application/live_match.rs` | Modified | Remove 2 lines from struct literal |
| `engine/tests/simulation_tests.rs` | Modified | ~10 locations: replace reads |
| `ofm_core/tests/turn_tests.rs` | Modified | ~4 helper fn signatures + ~6 inline literals |
| `ofm_core/src/turn/news.rs` | Modified | ~1 helper fn + ~1 inline literal |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Missed reference somewhere | Low | Compiler catches all uses of removed fields |
| Deserialization of old data | None | Fields already `#[serde(default, skip_serializing)]` — no data was ever sent |
| Tests break silently | Low | `cargo test` in engine + ofm_core catches all |

## Rollback Plan

Revert the commit. Simple struct-only change with no migrations, no data loss,
no serialization changes. Rollback is zero-risk.

## Dependencies

None. Standalone refactor.

## Success Criteria

- [ ] `cargo build` passes in both `engine` and `ofm_core`
- [ ] All engine tests pass (esp. deterministic, home advantage, scoring tests)
- [ ] All ofm_core tests pass (news generation, match report application)
- [ ] Frontend build passes (no TS changes, just verify)
- [ ] `home_goals` and `away_goals` appear nowhere in `engine::MatchReport`
