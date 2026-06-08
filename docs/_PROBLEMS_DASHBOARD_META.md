# Meta — Known Problems & Technical Debt

## P1 — SoloQ computation duplicated in 3 places

**Problem:** `computeSoloQ()` exists independently in `MetaTabV2.tsx`,
`TrainingTabV2.tsx`, and `training.rs` (simplified). Same formula, 3 copies.

**Fix:** Move to Rust as a query command, remove frontend duplication.

---

## P2 — Magic numbers in mastery gain formula

```rust
chance = 0.16 + gain_factor * 0.26 + headroom * 0.2 + stat_push * 0.18;
```

Why 0.16 base? Why 0.26 weight for gain_factor vs 0.2 for headroom? No
documentation, no named constants.

**Fix:** Extract named constants with doc comments.

---

## P3 — Patch drift coefficients undocumented

```rust
mean_reversion = (mean - previous) / 4;
drift = random(-5..=5) + mean_reversion;
buff = +9, nerf = -9;
```

`/4`, `±5`, `+9`, `-9` — no rationale for any of these. They determine the
entire meta evolution pace.

**Fix:** Document as named constants with design intent.

---

## P4 — Discovery reset on patch is all-or-nothing

When a patch rolls, discovery resets for ALL champions that changed tier or
were buffed/nerfed. This can wipe out weeks of scout progress.

**Fix:** Soft-reset: only reset champions that moved ≥2 tiers, or keep a
"previously discovered" flag for partial visibility.

---

## P5 — Mastery decay formula not visible

Decay triggers after 56 days of inactivity at -1 per 28 days. These constants
(`56`, `28`, `-1`) are hidden in `apply_mastery_decay()` with no UI feedback.
Players can't see which champions are decaying or by how much.

**Fix:** Show decay status in the Meta tab (e.g. "Decaying in X days") and
extract constants.

---

## P6 — No tests for core meta logic

`apply_patch()`, `compute_scores()`, `assign_tiers()`, `process_meta_discovery()`
— all untouched by tests. The tier distribution S(12%)/A(22%)/B(30%)/C(22%)/D(14%)
is never verified.

**Fix:** Add snapshot tests for score→tier mapping and patch simulation.

---

| Prio | Issue | Effort |
|---|---|---|
| P1 | SoloQ duplicated in 3 places | Medium |
| P2 | Mastery gain magic numbers | Small |
| P3 | Patch drift coefficients undocumented | Small |
| P4 | All-or-nothing discovery reset | Medium |
| P5 | Mastery decay invisible to player | Small |
| P6 | No tests for core meta logic | Medium |
