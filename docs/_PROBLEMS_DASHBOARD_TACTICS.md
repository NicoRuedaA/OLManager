# Tactics — Known Problems & Technical Debt

## P1 — Modifiers computed in frontend, consumed in Rust

**Problem:** `computeRoleModifiers()` lives in `src/lib/teams/lolTactics.ts`. The
Rust backend receives the result via the match snapshot
(`lol_role_impact_by_player`), not by computing it from `team.lol_tactics`.

**Why it's a problem:**
- If `lolTactics.ts` changes and the snapshot is stale, the live match simulates
  with wrong modifiers — no compile error, no runtime warning.
- The source of truth for *how tactics affect gameplay* is split across two
  languages with no sync mechanism.
- Background-simulated matches (which don't go through the draft snapshot) never
  receive role modifiers from tactics at all.

**Fix:** Move `computeRoleModifiers()` to Rust. Store the modifier table as a
constant mapping, compute from `team.lol_tactics` at match start, and pass the
result directly to the combat stat scaling code. The frontend can still display
modifiers by calling a lightweight query command.

---

## P2 — Coherence table has gaps

**Problem:** `computeCoherenceBreakdown()` covers ~15 combinations out of
`6*3*5*2*4*3 = 2160` possible tactic permutations. Many fall through to generic
`+0.25` or are not evaluated at all.

**Examples:**
- `strong_side = Bot + support_roaming = RoamMid` → no check exists (neither
  bonus nor penalty)
- `support_roaming = RoamMid + strong_side = Top` → no check
- `fight_plan = Siege + strong_side = anything` → generic `+0.25` regardless of
  synergy

**Fix:** Audit all 6×6 pairings and decide intent: either add explicit checks
with meaningful deltas, or document that the pair has no synergy effect.

---

## P3 — Phantom enum variants

**Problem:** The Rust `JungleStyle` has 5 variants (`Ganker`, `Invader`,
`Farmer`, `Carry`, `Enabler`) and `FightPlan` has 5 (`FrontToBack`, `Pick`,
`Dive`, `Siege`, `Flank`). The frontend `LolTacticsData` only exposes 4 for
each (`Carry` and `Flank` are missing).

**Risks:**
- If a save file contains `Carry` or `Flank` (from a future version, mod, or
  DB corruption), the frontend dropdowns won't render the selected option.
- `computeRoleModifiers()` has no case for `Carry` or `Flank` — they fall
  through to `default` with no modifier.

**Fix:** Either:
1. Expose the missing variants in the frontend (add UI options for Carry/Flank)
2. Remove them from the Rust enum if they're genuinely unused
3. Or at minimum add explicit `default` branches that log a warning

---

## P4 — No tests for modifier or coherence logic

**Problem:** `computeRoleModifiers()` and `computeCoherenceBreakdown()` contain
~30 conditional branches with hardcoded numeric values. There are zero tests.

**Missing coverage:**
- Each of the 6 tactics × their variants produces the expected modifier deltas
- Coherence synergy pairs produce positive/negative scores correctly
- Contradictory combinations (e.g. Early timing + Farmer jungle) produce
  negative coherence
- Default tactics produce a predictable baseline
- Edge cases: only 1 player in a role, no active lineup

**Fix:** Add parameterized tests for every tactic combination. The modifier
table is declarative — snapshot-test the full output.

```typescript
it.each([...ALL_COMBINATIONS])("modifiers for %s", (tactics) => {
  expect(computeRoleModifiers(tactics)).toMatchSnapshot();
});

it("Early + Ganker = positive coherence", () => {
  const breakdown = computeCoherenceBreakdown({ ...defaults, game_timing: "Early", jungle_style: "Ganker" });
  expect(breakdown.filter(c => c.delta > 0).length).toBeGreaterThan(0);
});
```

---

## P5 — Combat stat multipliers are undocumented magic numbers

**Problem:** In `sim_live.rs:1241-1339`:

```rust
max_hp *= (1.0 + tuned_role_modifier * 0.012);
attack_damage *= (1.0 + tuned_role_modifier * 0.016);
move_speed += tuned_role_modifier * 0.00035;
```

The constants `0.012`, `0.016`, `0.00035`, and the jungle dampening `0.65x`
have no comments, no named constants, and no documented rationale.

**Why it's a problem:**
- Nobody can tune these without guessing. Is `0.012` balanced? Compared to what?
- If the modifier table in `lolTactics.ts` changes (e.g. adding more granular
  values), these multipliers may need adjustment — but there's no coupling
  between them.

**Fix:** Extract named constants with doc comments explaining the intended
magnitude:

```rust
/// Each point of role modifier changes max_hp by ~1.2%.
const ROLE_MODIFIER_HP_SCALE: f64 = 0.012;

/// Each point of role modifier changes AD by ~1.6%.
const ROLE_MODIFIER_AD_SCALE: f64 = 0.016;

/// Jungler modifiers are less impactful due to shared map presence.
const JUNGLE_DAMPENING_FACTOR: f64 = 0.65;
```

---

## P6 — Background sims don't apply role modifiers

**Problem:** `generate_match_social_posts()` is only called for live matches.
But more critically, the `computeRoleModifiers` path only runs through the draft
snapshot pipeline, which is live-match-only. Background-simulated league matches
bypass tactics entirely.

**Impact:** When you sim a week, your tactics are essentially ignored for all
background league results. Only live matches (where you draft) respect your
tactical choices.

**Fix:** The `simulate_background_league` path in Rust needs to read
`team.lol_tactics` and compute role modifiers inline, using the same logic as
the draft snapshot builder.

---

## P7 — Coherence score impact is arbitrary

**Problem:** The draft simulator applies coherence as:

```typescript
score += coherenceScore * 2.2
```

The `2.2` multiplier has no documented calibration. Why `2.2` and not `1.5` or
`3.0`? How does this interact with the modifier-based score contribution?

**Fix:** Document the calibration methodology, or derive the multiplier from
observed impact ranges. Better: test against historical match data to find
the multiplier that makes coherence correlate with actual win rate.

---

## P8 — Auto-save has no debounce

**Problem:** `TacticsTabV2` fires `invoke("set_lol_tactics")` on every selection
change with no debounce. Switching from `Early` → `Mid` → `Late` in one second
sends 3 separate Tauri commands + 3 full state responses.

**Fix:** Add a 300ms debounce or batch the last value before sending. The
optimistic UI update can happen locally, but the backend call should wait for
the user to stop clicking.

---

## Summary by priority

| Priority | Issue | Effort |
|---|---|---|
| P1 | Modifiers computed in frontend, consumed in Rust | Large (migrate to Rust) |
| P2 | Coherence table has gaps | Medium (audit + fill) |
| P3 | Phantom enum variants | Small (sync or remove) |
| P4 | No tests for core logic | Medium (~20 test cases) |
| P5 | Magic numbers in combat sim | Small (name constants) |
| P6 | Background sims ignore tactics | Large (add to sim path) |
| P7 | Coherence multiplier arbitrary | Small (document) |
| P8 | Auto-save no debounce | Trivial (300ms debounce) |
