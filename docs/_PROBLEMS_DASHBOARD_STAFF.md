# Staff — Known Problems & Technical Debt

## P1 — Staff effects duplicated in Rust and TypeScript

**Problem:** `LolStaffEffects` computation exists in `staff_effects.rs` and is
**exactly mirrored** in `lolStaffEffects.ts`. Same `qualityMult()` formula,
same defaults, same floors/caps. If one changes, the other silently drifts.

**Fix:** Add a Tauri query command `get_staff_effects()` that returns computed
effects from Rust, removing the TS mirror entirely.

---

## P2 — Staff OVR formula not in Rust

**Problem:** The OVR-by-role weights (Coaches use `0.7/0.15/0.1/0.05`, Physios
use `0.15/0.05/0.05/0.75`) are computed ONLY in the frontend
(`StaffTabV2.tsx:ovrRating()`). There's no backend concept of "staff OVR."

**Fix:** Move `ovrRating()` to Rust as a method on `Staff`, or at minimum
extract the weights to a shared constant.

---

## P3 — Staff data loaded from JSON, no procedural generation

All staff are static entries in league-specific JSON files. There is no
procedural generation of new staff between seasons or after retirements. Over
time, the available pool shrinks as staff get hired.

**Fix:** Add yearly regen (similar to youth academy players) for free agent
staff pool replenishment.

---

## P4 — No specialization in data files

Staff JSON files have `"specialization": null` for every entry. The
specialization system exists (Technique/Tactics/Youth/Fitness with ×1.03–1.05
multipliers) but no staff in the data actually use it.

**Fix:** Assign specializations during staff generation or seed the data files
with meaningful values.

---

## P5 — Hiring window is opaque

`is_normal_staff_hiring_window_open()` restricts hiring to off-season, but
the UI doesn't communicate this clearly. Users try to hire mid-season and get
a silent failure or confusing error.

**Fix:** Show a clear hiring window indicator in the Staff tab with dates.

---

| Prio | Issue | Effort |
|---|---|---|
| P1 | Staff effects duplicated Rust/TS | Medium |
| P2 | Staff OVR formula frontend-only | Small |
| P3 | No procedural staff generation | Large |
| P4 | Specializations unused in data | Small |
| P5 | Hiring window opaque | Small |
