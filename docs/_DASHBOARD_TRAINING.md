# Training — Architecture & Usage

## Overview

The Training system manages **player development** over time. Every non-match
day, training processes: attribute gains, condition costs, fitness changes,
champion mastery progress, and scrim outcomes. It's the primary way players
improve between matches.

Training does **not** run on matchdays — those are reserved for
simulation.

---

## Data flow

```
process_day (turn/mod.rs)
  │
  ├── [Matchday] → simulate_matchday
  │   └── Training does NOT run
  │
  └── [Non-matchday]
        ├── process_training(game, weekday_num)     ← training.rs
        │   ├── Collect training plans per team
        │   ├── Resolve scrim outcomes for this day
        │   └── Per-player loop:
        │       ├── Determine effective focus
        │       ├── Compute condition cost
        │       ├── Compute gain (age × intensity × staff × facilities)
        │       ├── Apply focus gains to attributes (probabilistic)
        │       ├── Apply scrim plan gains
        │       ├── Queue champion mastery ticks
        │       ├── Apply fitness change
        │       └── Apply condition cost + recovery
        │   ├── Apply scrim outcomes (morale, reports)
        │   ├── Process mastery ticks
        │   └── Sunday: weekly scrim report + reset
        │
        ├── check_squad_fitness_warnings
        │
        └── clock.advance_days(1)
```

---

## The 3 configuration dimensions

### Schedule

How many days per week the team trains.

| Schedule | Training days | Rest days |
|---|---|---|
| **Intense** | Mon, Tue, Wed, Thu, Fri, Sat | Sun |
| **Balanced** (default) | Mon, Tue, Thu, Fri | Wed, Sat, Sun |
| **Light** | Tue, Thu | Mon, Wed, Fri, Sat, Sun |

### Focus

What attributes each training day improves.

| Focus | Primary attrs | Secondary attrs | Tertiary |
|---|---|---|---|
| **Scrims** (default) | consistency | teamfighting | discipline×0.85, mental×0.65, macro×0.55 |
| **VODReview** | macro | consistency | discipline×0.75, shotcalling×0.6 |
| **IndividualCoaching** | laning | mechanics, champion_pool | discipline×0.8, teamfighting×0.4 |
| **ChampionPoolPractice** | mechanics, champion_pool | macro×0.8 | laning×0.7, consistency×0.65 |
| **MacroSystems** | macro | consistency | teamfighting×0.8, shotcalling×0.7 |
| **MentalResetRecovery** | — | — | No training cost, boosted recovery |

### Intensity

How demanding each training session is.

| Intensity | Condition cost | Gain multiplier |
|---|---|---|
| **Low** | 3 | 0.5× |
| **Medium** (default) | 6 | 1.0× |
| **High** | 10 | 1.5× |

Recovery focus (**MentalResetRecovery**) sets condition cost to 0 regardless of
intensity.

---

## Training gain formula

Per-attribute gain probability per day:

```
gain = 0.075 × intensity_mult × age_factor × coaching_mult
      × specialization_mult × training_facility_mult × scrim_gain_mult
```

Each multiplier:

| Factor | Source | Range |
|---|---|---|
| `0.075` | Base rate (hardcoded) | — |
| `intensity_mult` | Intensity setting | 0.5 / 1.0 / 1.5 |
| `age_factor` | Player age | ≤21 = 1.5, 22-25 = 1.2, 26-29 = 1.0, 30-33 = 0.6, 34+ = 0.3 |
| `coaching_mult` | Staff coaching quality | 0.85–1.25 |
| `specialization_mult` | Coach specialization bonus | 1.0–1.05 |
| `training_facility_mult` | Scrims room level | 1.0 + (level - 1) × 0.03 |
| `scrim_gain_mult` | Scrim outcome quality | varies |

Gains are **probabilistic** — `try_gain(attr, gain)` rolls `random < gain` and
increments by 1 if successful. A gain of `0.075` means ~7.5% chance per day.

**Capped** when `calculate_lol_ovr(player) >= effective_potential_cap(player)`.

---

## Condition, fitness & recovery

### Condition cost

| Intensity | Cost |
|---|---|
| Low | 3 |
| Medium | 6 |
| High | 10 |
| Recovery focus | 0 (any intensity) |

Condition recovers daily. Recovery rate depends on:
- **Base rate**: `20 + effects.recovery × 5` (staff physio quality)
- **Facilities**: `recovery_suite_level` adds `(level - 1) × 0.1` multiplier
- **Fitness**: higher fitness = faster recovery
- **Morale**: higher morale = faster recovery
- **Age**: younger recovers faster

### Fitness

- **Scrims focus** can improve fitness over time
- Other focuses slowly decay fitness when it exceeds 85

### Morale

Morale is affected by:
- Match results (win = up, loss = down)
- Scrim outcomes (win = slight up, loss streak = down with penalty)
- Staff morale stat

Morale affects recovery rate and overall player performance.

---

## Scrims

Scrims are tied to the training schedule — they happen during training days
and their outcomes feed back into training gain multipliers.

### Slot scheduling

| Slots | Schedule |
|---|---|
| 2 | Both on Tuesday |
| 4 | Tue × 2, Wed × 2 |
| 6 | Tue × 2, Wed × 2, Thu × 2 |

### Opponent selection

1. Try Plan A opponent for the slot
2. If unavailable, try Plan B (requires acceptance roll based on scrim reputation diff)
3. If unavailable, try Plan C

### Win probability

```
0.5 + (own_strength - opponent_strength) × 0.022
```
Clamped to `[0.2, 0.8]`.

### Quality

```
58 + (opponent_strength - own_strength) × 1.8 + (gain_mult - 1.0) × 28
```
Clamped to `[30, 95]`. Higher quality = higher scrim_gain_mult for training.

### Scrim flow state machine

Per scrim block (Tue/Wed/Thu):

```
NoScrimsToday → SelectDayScrims
  → Block1Result
    → Good → GoodDecision (OfferRest | ContinueToBlock2)
    → Bad → BadDecision (PushThrough | CancelScrims)
      → CancelScrims → BadCancelDecision
        (VodReview | MentalReset | TargetedDrills) → DayClosed
  → Block2Result → Resolve → DayOff
```

### Weekly scrim report

Generated on Sundays (`weekday_num == 6`). Analyzes:
- Played / wins / losses / cancellations
- Average quality
- Most common focus
- Recurring issue (DraftGap, LanePressure, Tilt, etc.)
- Most practiced champion
- Recommendation

---

## Staff effects on training

| Effect | Range | Source | Affects |
|---|---|---|---|
| `coaching` | 0.85–1.25 | Coach + Asst Manager avg | Training gain multiplier |
| `development` | 0.88–1.22 | Coach attributes | Player development rate |
| `recovery` | 0.95–1.25 | Physio physiotherapy stat | Condition recovery boost |
| `morale` | 0.95–1.15 | Staff morale impact | Recovery + performance |
| `tactics` | 0.90–1.18 | Coach tactics attr | Scrim quality |
| `analysis` | 0.90–1.16 | Scout + Coach avg | Scrim debrief quality |

Computed by `LolStaffEffects` in `staff_effects.rs` — weighted averages of
staff attributes with `qualityMult()` formula (floors and caps).

---

## Facilities

| Facility | Level range | Effect |
|---|---|---|
| **Training** | 1–5 | Scrims room level fallback |
| **Medical** | 1–5 | Recovery |
| **Scrims Room** | 1–5 | `gain_mult = 1.0 + (level - 1) × 0.03` |
| **Recovery Suite** | 1–5 | `recovery_mult = 1.0 + (level - 1) × 0.1` |
| **Analysis Room** | 1–5 | Scrim debrief quality |
| **Bootcamp Area** | 1–5 | Pre-match boost |
| **Content Studio** | 1–5 | Social reach |

---

## Champion mastery training

Each player can have up to **3 champion training targets**. On training days
(not recovery focus), mastery is trained:

- Per target, compute gain probability based on focus, intensity, soloQ tier
- `ChampionPoolPractice` focus = highest mastery gain rate (×1.4)
- SoloQ tier multiplier: Challenger ×1.2, Grandmaster ×1.0, Master ×0.8

Probabilistic gain per target per day:

```
chance = 0.16 + gain_factor × 0.26 + headroom × 0.2 + stat_push × 0.18
```
Clamped to `[0.14, 0.88]`. On success: `gain = 4` (if <75), `3` (if <90),
or `2` (if 90+), plus stat bonus (0–2 based on mechanics + champion_pool).

Capped at `MASTERY_CAP`.

---

## Potential system

- Every player has `potential_base` (hidden) and optionally `potential_revealed`
  (after 7-day scouting research)
- `effective_potential_cap = potential_revealed.unwrap_or(potential_base)`, min 99
- When OVR ≥ cap, training produces **zero** attribute gains
- Potential research reveals `potential_base + 0-3` bonus (based on OVR
  stability, player morale, team morale)

---

## Frontend

### Component hierarchy

```
TrainingTabV2 (v2)
├── Staff Advice Banner (critical / warning / ok)
├── Weekly Schedule Card
│   └── 3 buttons: Intense / Balanced / Light
├── Training Focus + Intensity Card
│   ├── 6 focus buttons (with stat tooltips)
│   └── 3 intensity buttons
├── SoloQ Ranks Card
│   └── Per player: tier / LP / delta
├── Staff Impact Card
│   └── Learning / Scrims / Recovery bars
├── Squad Fitness Card
│   ├── Avg condition bar
│   ├── Avg morale bar
│   └── Condition alerts
└── Training Groups Table
    └── Group assignment with per-group focus override
```

### Key files

| File | Role |
|---|---|
| `src/ui-v2/dashboard/tabs/TrainingTabV2.tsx` | v2 UI (1156 lines) |
| `src/components/training/TrainingTab.tsx` | Legacy UI |
| `src/components/training/TrainingSettingsPanel.tsx` | Reusable settings panel |
| `src/components/training/trainingGroupsModel.ts` | Group assignment helpers |
| `src/components/training/trainingAdvice.ts` | Staff advice level computation |
| `src/lib/teams/trainingFocus.ts` | Focus→stats mapping, legacy→LoL rename |
| `src/lib/teams/lolStaffEffects.ts` | Frontend mirror of Rust staff effects |
| `src/services/trainingService.ts` | Tauri invoke wrappers (17 commands) |
| `src/lib/scrims/scrimContext.ts` | Scrim state derivation for TodayPhaseCard |
| `src-tauri/crates/olm_core/src/training.rs` | Core training engine (1563 lines) |
| `src-tauri/crates/olm_core/src/training/fitness_warnings.rs` | Fitness alert generation |
| `src-tauri/crates/olm_core/src/scrim_flow.rs` | Scrim state machine |
| `src-tauri/crates/olm_core/src/champions.rs` | Champion mastery training |
| `src-tauri/crates/olm_core/src/potential.rs` | Potential cap logic |
| `src-tauri/crates/olm_core/src/staff_effects.rs` | Staff effect computation |
| `src-tauri/crates/olm_core/src/domain/player.rs` | PlayerAttributes + Player |
| `src-tauri/crates/olm_core/src/domain/team.rs` | Team training/scrim fields |
| `src/store/types.ts` | TS types |
