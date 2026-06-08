# Scrims — Known Problems & Technical Debt

## P1 — Silent failure when all opponent plans fail

**Problem:** If Plan A/B/C all fail (opponents reject or unavailable), the
scrim slot is skipped silently. No feedback reaches the manager — they see
nothing happened and have no idea why.

**Fix:** Add a fallback mechanism (random opponent, weaker opponent, or "No
scrim — expand your scrim network" feedback in the UI).

---

## P2 — Scrim resolution mixed into 1563-line training.rs

**Problem:** `resolve_scrim_outcomes_for_day()`, `apply_scrim_outcomes()`,
`apply_scrim_morale()`, `compute_scrim_gain_multiplier()`, and
`build_weekly_scrim_staff_report()` all live inside `training.rs`. Scrim
resolution is ~250 lines inside the 1563-line file.

**Fix:** Extract to `training/scrims.rs`.

---

## P3 — No tests for scrim resolution logic

**Problem:** Win probability, quality, gain multiplier, opponent acceptance,
issue derivation — all untested.

**Fix:** Add tests for each formula with known inputs and expected outputs.

---

## P4 — Opponent acceptance has no UI feedback

**Problem:** `scrim_request_accepted()` is a deterministic roll based on
reputation diff. The user has no visibility into why an opponent accepted or
rejected — they just see the slot empty or filled.

**Fix:** Show acceptance probability or reason in the planning UI (e.g. "Rep
gap too wide — try weaker opponents").

---

## P5 — State machine transitions not persisted

**Problem:** The daily scrim flow state machine (`scrim_flow.rs`) is not
persisted. If the user closes and reopens the game mid-scrim-block, the state
resets to `NoScrimsToday` and the scrim is lost.

**Fix:** Store the current flow state on the game struct and restore it on
load.

---

## P6 — Auto-configure has no undo

**Problem:** `autoConfigureWeeklyScrimSetup()` locks the week immediately.
There's no "undo" or "reset" within the same week.

**Fix:** Allow `unlock` within the same day (Monday only) or add a confirmation
dialog before locking.

---

## P7 — Staff suggestions have no integration test

**Problem:** `buildStaffSuggestions()` in `scrimContext.ts` has 13 heuristic
rules. No test verifies the correct suggestion is returned for a given game
state.

**Fix:** Parameterized tests for each rule.

---

| Prio | Issue | Effort |
|---|---|---|
| P1 | Silent failure when plans fail | Small |
| P2 | Scrims mixed into training.rs | Medium |
| P3 | No tests for resolution logic | Medium |
| P4 | No acceptance probability feedback | Small |
| P5 | State machine not persisted | Medium |
| P6 | Auto-configure has no undo | Small |
| P7 | Staff suggestions untested | Small |
