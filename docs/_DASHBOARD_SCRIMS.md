# Scrims — Architecture & Usage

## Overview

Scrims are practice matches against AI teams that run during training blocks
(Tue/Wed/Thu). They provide training gain multipliers, extra attribute gains
via the weekly scrim objective, champion mastery progress, and morale effects.

Scrims are configured weekly (opponents, volume, focus) and resolved
automatically. The manager makes post-scrim decisions through a state machine.

---

## Data flow

```
WEEKLY SETUP (Monday):
  Manager picks objective + slot count (2/4/6) + opponent plans
  → finalizeWeeklyScrimSetup() locks the week

DAILY (training day):
  process_scrim_block() resolves Block 1 (auto)
    → ScrimReport: won/loss, quality, issue, gain_mult
  → Review phase blocks time if unresolved
  → Manager picks action (state machine)
    → If Continue/PushThrough → Block 2 resolved

TRAINING INTEGRATION:
  process_training() applies:
    ├─ scrim_gain_mult → training gain multiplier
    ├─ scrim_focus gains → extra attribute gains (1.9×)
    └─ morale deductions from loss streaks

WEEKLY CLOSE (Sunday):
  → Weekly scrim staff report (inbox message)
  → Reset counters
```

---

## Weekly setup

| Setting | Options | Default |
|---|---|---|
| **Volume** | 2 / 4 / 6 slots per week | 2 |
| **Objective** | DraftPrep / ChampionPool / EarlyGame / Teamfighting / Macro / Mental | — |
| **Plan A/B/C** | Opponent team IDs per slot (3 priorities) | — |

Once `finalizeWeeklyScrimSetup()` is called, the week is locked and cannot be
changed until Monday.

---

## Slot scheduling

| Slots | Tuesday | Wednesday | Thursday |
|---|---|---|---|
| 2 slots | Block A, Block B | — | — |
| 4 slots | Block A, Block B | Block A, Block B | — |
| 6 slots | Block A, Block B | Block A, Block B | Block A, Block B |

Each block resolves independently.

---

## Opponent resolution

For each slot:
1. Try **Plan A** opponent
2. If unavailable (rejected), try **Plan B**
3. If unavailable, try **Plan C**
4. If all plans fail → **no scrim** (silent — no feedback shown)

Acceptance probability:
```
chance = (0.52 + reputation_diff * 0.006).clamp(0.08, 0.88)
```

---

## Match resolution

### Win probability
```
0.5 + (own_strength - opponent_strength) * 0.022
```
Clamped to `[0.2, 0.8]`.

### Quality
```
58 + (opponent_strength - own_strength) * 1.8 + (gain_mult - 1.0) * 28
```
Clamped to `[30, 95]`. Higher quality = higher gain multiplier.

### Gain multiplier
```
1.0 + (opponent_strength - own_strength).clamp(-12, 12) * 0.016
```
Clamped to `[0.85, 1.25]`. Then multiplied by staff effects:
```
(tactics * 0.55 + analysis * 0.45).clamp(0.90, 1.15)
```

### Issues
Derived from result + strength diff: DraftGap, LanePressure, ObjectiveSetup,
TeamfightExecution, ChampionComfort, Tilt.

---

## Scrim state machine

Defined in `scrim_flow.rs` — 2 enums (`DailyScrimFlowState`, `DailyScrimFlowEvent`)
and one `transition()` function:

```
NoScrimsToday → SelectDayScrims → Block1Result
  → Won:  OfferRest (close day) | ContinueToBlock2
  → Lost: PushThrough (block 2) | CancelScrims
    → CancelScrims → VodReview | MentalReset | TargetedDrills
Block2Result → DayOff
```

---

## Post-scrim decisions

| Decision | Impact tags |
|---|---|
| **OfferRest** | Recovery+, Fatigue+, Volume- |
| **ContinueToBlock2** | Volume+, Learning+, Mental- |
| **PushThrough** | Volume+, Learning+, Mental- |
| **CancelScrims** | Recovery+, Reputation- |
| **VodReview** | Analysis+, Quality+, Recovery- |
| **MentalReset** | Mental+, Recovery+, Technique- |
| **TargetedDrills** | Issue+, Mechanics+, Fatigue- |
| **DayOff** | Recovery++, Fatigue++ |

---

## Scrim focus → attribute gains

Applied as extra gains during `process_training()` with **1.9× multiplier**:

| Focus | Primary | Secondary | Tertiary |
|---|---|---|---|
| DraftPrep | macro | consistency×0.9 | shotcalling×0.7 |
| ChampionPool | mechanics, champion_pool | laning×0.7 | — |
| EarlyGame | laning | consistency×0.85 | macro×0.75 |
| Teamfighting | teamfighting | discipline×0.9 | consistency×0.75 |
| Macro | macro | consistency | teamfighting×0.7 |
| Mental | discipline | mental×0.85 | shotcalling×0.65 |

---

## Staff effects

| Effect | Impact on scrims |
|---|---|
| **coaching** | Training gain multiplier (up to 1.25×) |
| **tactics** | 55% of scrim gain_mult composite |
| **analysis** | 45% of scrim gain_mult composite |
| **recovery** | Softens morale penalty (up to 0.35 reduction) |
| **morale** | Same softening as recovery |

Facility: **Scrims Room** level adds `(level - 1) × 0.03` to training facility
multiplier.

---

## Frontend

### Component hierarchy

```
ScrimsTabV2
├── Weekly Setup (objective + slot count + finalize)
├── ScrimPlanningCardV2 (per-slot Plan A/B/C dropdowns)
├── Today's Block sidebar (state badge + opponent + decisions)
└── Weekly Report sidebar (W/L sparkline + reports list)
```

### Key files

| File | Role |
|---|---|
| `src/ui-v2/dashboard/tabs/ScrimsTabV2.tsx` | v2 tab (615 lines) |
| `src/ui-v2/dashboard/tabs/ScrimPlanningCardV2.tsx` | Slot planning component |
| `src/lib/scrims/scrimContext.ts` | Context derivation (604 lines) |
| `src/hooks/useScrimContextWithFallback.ts` | Backend→local fallback hook |
| `src/services/trainingService.ts` | Tauri invoke wrappers |
| `src-tauri/crates/olm_core/src/training.rs` | Scrim resolution + integration |
| `src-tauri/crates/olm_core/src/scrim_flow.rs` | State machine (77 lines) |
| `src-tauri/crates/olm_core/src/domain/team.rs` | Scrim domain types |
| `src-tauri/crates/olm_core/src/staff_effects.rs` | Staff effect compositing |
| `src-tauri/src/commands/squad.rs` | Tauri command handlers |
