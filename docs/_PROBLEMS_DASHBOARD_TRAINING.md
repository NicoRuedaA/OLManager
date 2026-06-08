# Training — Known Problems & Technical Debt

## P1 — 1563-line single-file monster

**Problem:** `training.rs` is **1563 lines** with everything mixed: plan
collection, scrim resolution, per-player loop, mastery ticks, weekly reports,
and helpers. It's nearly impossible to navigate or reason about.

**Fix:** Split into:
- `training/plans.rs` — plan collection, focus/intensity resolution
- `training/player_loop.rs` — per-player attribute gain, condition, fitness
- `training/scrims.rs` — scrim outcome resolution (extract from the main
  training flow)
- `training/mastery.rs` — champion mastery training ticks
- `training/reports.rs` — weekly scrim report generation
- `training/mod.rs` — `process_training()` orchestrator (~150 lines)

---

## P2 — No tests for the core training loop

**Problem:** `process_training()` has ~500 lines of logic with multiple
branching paths (rest day vs training day, capped vs uncapped, recovery focus
vs normal, different intensities, scrim outcomes, etc.) — zero tests.

The `apply_focus_gains()` and `try_gain()` functions drive all player
development with probabilistic rolls, and there's not a single test
verifying:
- A player with age ≤21 gains faster than age 30+
- High intensity produces more gain than Low
- Capped players gain nothing
- Recovery focus costs no condition
- Scrim quality multiplier correctly scales gains

**Fix:** Add tests for:
- `try_gain()` — verify increment and cap behavior
- `apply_focus_gains()` — verify correct attribute deltas per focus
- Full training day simulation — verify condition cost, gain, recovery
- Rest day — verify no cost, boosted recovery
- Capped player — verify zero gains
- `effective_potential_cap()` — verify returned values

---

## P3 — Magic numbers everywhere

**Problem:** The training formula is built from undocumented constants:

```rust
// training.rs: ~1000-1100
let gain = 0.075 * intensity_mult * age_factor * coaching_mult
    * specialization_mult * training_facility_mult * scrim_gain_mult;
// ...
condition_cost: Low=3, Medium=6, High=10
// ...
chance = 0.16 + gain_factor * 0.26 + headroom * 0.2 + stat_push * 0.18;
```

Why `0.075`? Why `3/6/10`? Why `0.16 + 0.26 + 0.2 + 0.18` = 0.8 baseline
chance? These numbers dictate the entire player development pace and have no
documentation, no named constants, and no calibration notes.

**Fix:** Extract all numeric constants with descriptive names and doc comments:

```rust
/// Base probability per day of gaining a single attribute point.
/// At 1.0× multiplier (Medium intensity, age 26-29, average staff),
/// a player gains ~7.5% × attributes_trained per day.
const BASE_GAIN_PROBABILITY: f64 = 0.075;
```

---

## P4 — Duplicated staff effects logic

**Problem:** `LolStaffEffects` is computed in Rust (`staff_effects.rs`) and
**mirrored in TypeScript** (`lolStaffEffects.ts`). The same `qualityMult()`
formula with the same floors and caps exists in two languages.

**Impact:** If the formula changes in Rust (e.g. adjusting the coaching cap from
1.25 to 1.30), the frontend display becomes wrong until someone remembers to
update the TS mirror. There's no compile-time or runtime sync.

**Fix:** Either:
1. Add a Tauri query command `get_staff_effects()` that returns the computed
   values from Rust, removing the TS mirror entirely.
2. Or generate the TS code from Rust via `ts-rs` (already in the dependency
   tree).

---

## P5 — Age factor is undocumented and uncalibrated

**Problem:** The age factor table:

```rust
let age_factor = match player_age {
    ..=21 => 1.5,
    22..=25 => 1.2,
    26..=29 => 1.0,
    30..=33 => 0.6,
    34.. => 0.3,
};
```

No justification for why 21→1.5 or 30→0.6. A 34-year-old develops at 20% of
a 21-year-old's rate (0.3/1.5). This is a huge swing that makes veteran
development nearly impossible, but there's no design document explaining the
intent.

**Fix:** Add doc comments referencing game design intent. Ideally, derive from
real esports career curves (peak at 22-25, steep decline after 28).

---

## P6 — Training groups UI allows infinite players per group

**Problem:** The frontend lets you assign any number of players to any group.
The backend applies the group's focus to all assigned players. There's no
validation that:
- A player can only be in one group (the UI might let you overlap)
- Groups don't exceed reasonable sizes (e.g. 5 players is a full team)
- All players are assigned to some group (orphan players get team default,
  which is fine but undocumented)

**Fix:** Add frontend validation for:
- Player uniqueness across groups
- Optional size warnings

---

## P7 — Scrim opponent selection has no fallback validation

**Problem:** The scrim Plan A/B/C system tries opponents in order. If all
three plans fail (opponent rejects or is unavailable), **no scrim happens** for
that slot — silently. The user sees a blank slot with no indication why.

**Fix:** Add a feedback mechanism when all plans fail (e.g. "No opponents
available — expand your scrim network"). Or implement a "random scrim" fallback
that picks any team with similar strength.

---

## P8 — Mastery gain formula is opaque

**Problem:**

```rust
chance = 0.16 + gain_factor * 0.26 + headroom * 0.2 + stat_push * 0.18;
```

This is called during `apply_training_mastery_progress()`. The four terms:
- `0.16` = base chance (16%)
- `gain_factor * 0.26` = from training gain context (up to ~0.26)
- `headroom * 0.2` = how far from mastery cap (up to ~0.2)
- `stat_push * 0.18` = mechanics + champion_pool bonus (up to ~0.18)

So max chance ≈ 0.16 + 0.26 + 0.20 + 0.18 = 0.80, clamped at 0.88. The
coeffecients (0.26, 0.2, 0.18) have no relation to each other or to the
base 0.16. A complete mystery why these specific values.

**Fix:** Name each coefficient and document what it represents:

```rust
const MASTERY_BASE_CHANCE: f64 = 0.16;
const MASTERY_GAIN_FACTOR_WEIGHT: f64 = 0.26;
const MASTERY_HEADROOM_WEIGHT: f64 = 0.20;
const MASTERY_STAT_PUSH_WEIGHT: f64 = 0.18;
```

---

## P9 — SoloQ computation duplicated in frontend and backend

**Problem:** `computeSoloQ()` is defined in both:
1. `TrainingTabV2.tsx` (frontend) — for display
2. `MetaTabV2.tsx` (frontend) — for display
3. Rust (`training.rs`) — for mastery gain multiplier

The Rust version is simpler (just computes the multiplier from stored soloQ
tier). The frontend version has the full LP computation. If the formula
changes, they can drift.

**Fix:** Consolidate soloQ computation to Rust, expose via a query command,
and remove the frontend duplication.

---

## P10 — Single-day training loop is hard to debug

**Problem:** The per-player loop inside `process_training()` does everything in
one pass: condition cost, gain computation, attribute increment, fitness change,
condition recovery. If a player's condition goes negative mid-loop, the recovery
step might or might not fix it depending on order. The order of operations is
not documented.

**Fix:** Document the explicit order and add `debug_assert!()` for invariant
checks:
```rust
// 1. Before: condition ≥ 0
// 2. Subtract cost  → condition may dip below 0
// 3. Apply recovery → condition should be ≥ 0 again
debug_assert!(player.condition >= 0, "Condition below 0 after recovery");
```

---

## Summary by priority

| Prio | Issue | Effort |
|---|---|---|
| **P1** | 1563-line single-file monster | Medium (split into 5 files) |
| **P2** | No tests for core training loop | Large (~30 test cases) |
| **P3** | Magic numbers everywhere | Medium (extract + name constants) |
| **P4** | Duplicated staff effects (Rust + TS) | Medium (query command) |
| **P5** | Age factor undocumented | Small (doc comments) |
| **P6** | Training groups no validation | Small (frontend guard) |
| **P7** | Scrim fallback silent failure | Small (feedback UI) |
| **P8** | Mastery gain formula opaque | Small (name constants) |
| **P9** | SoloQ duplicated frontend/backend | Medium (consolidate to Rust) |
| **P10** | Training loop order undocumented | Small (asserts + comments) |
