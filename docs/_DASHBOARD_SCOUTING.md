# Scouting — Architecture & Usage

## Overview

Scouts evaluate players from other teams, revealing their attributes with
varying accuracy. Scouting assignments take 1–5 days depending on scout
quality and facilities, then generate a detailed report as an inbox message.

---

## Data flow

```
SCOUT TAB:
  Scouts[] → each has judging_ability (slot count, speed, accuracy, reveals)
          and judging_potential (assessment quality)

SEND SCOUT:
  send_scout(game, scout_id, player_id)
    → Validation: scout exists, has capacity, player not already scouted
    → Create ScoutingAssignment { id, scout_id, player_id, days_remaining }
    → Push to game.scouting_assignments[]

EVERY DAY:
  process_scouting(game)
    → Decrement days_remaining on all assignments
    → Collect completed (days_remaining == 0)
    → build_scout_report()
      → Fuzz attributes (±2 to ±12 based on judging_ability)
      → Select N revealed attributes (2–6)
      → Build rating/potential/confidence assessment
      → Generate InboxMessage with ScoutReportData
    → Remove completed assignments
```

---

## Scout capacity

| judging_ability | Base slots | Facility bonus |
|---|---|---|
| ≥ 80 | 5 | +floor((level - 1) / 2) |
| ≥ 60 | 4 | same |
| ≥ 40 | 3 | same |
| ≥ 20 | 2 | same |
| < 20 | 1 | same |

Scouting Lab facility adds extra slots (level 3 = +1, level 5 = +2).

---

## Assignment duration

| judging_ability | Base days | Facility bonus |
|---|---|---|
| ≥ 80 | 2 | level ≥ 4 = -2, level ≥ 2 = -1 |
| ≥ 60 | 3 | same |
| ≥ 40 | 4 | same |
| < 40 | 5 | same |

Minimum: 1 day.

---

## Report accuracy (noise)

| judging_ability | Noise (±) |
|---|---|
| ≥ 80 | ±2 |
| ≥ 60 | ±5 |
| ≥ 40 | ±8 |
| < 40 | ±12 |

Own players: always exact (±0).

---

## Revealed attributes

| judging_ability | N attributes revealed | Condition visible | Morale visible |
|---|---|---|---|
| ≥ 80 | 6 (all) | Yes | Yes |
| ≥ 60 | 5 | Yes | No |
| ≥ 40 | 3 | No | No |
| < 40 | 2 | No | No |

Which specific attributes are revealed is randomized each report.

---

## Assessment

**Overall rating** = average of REVEALED attributes only:

| Avg | rating_key |
|---|---|
| ≥ 80 | excellent |
| ≥ 70 | veryGood |
| ≥ 60 | good |
| ≥ 50 | average |
| < 50 | belowAverage |

**Potential** (depends on judging_potential):

| judging_potential | Behavior |
|---|---|
| ≥ 70 | Specific: worldClass / strong / moderate |
| < 70 | "unclear" |

**Confidence** (depends on judging_ability):

| judging_ability | confidence_key |
|---|---|
| ≥ 80 | high |
| ≥ 60 | moderate |
| < 60 | low |

---

## Potential research (separate system)

7-day research project (single-threaded — one player at a time globally).

```
start_potential_research(player_id)
  → player.potential_research_eta_days = 7

process_potential_research(game) [daily]
  → decrement counter
  → when 0: compute_revealed_potential()
    → potential_base + bonus(0..3)
      → +1 if OVR+2 ≥ base (meeting expectations)
      → +1 if morale ≥ 70
      → +1 if team avg morale ≥ 70
```

---

## Frontend

### Component hierarchy (ScoutingTabV2)

```
ScoutingTabV2 (2-column: 1fr / 1.4fr)
├── [Left column]
│   ├── Overview gauges (scout count / assignments / free slots)
│   ├── Academy card
│   ├── ScoutingAssignmentsListV2
│   └── ScoutingScoutDetailsCardV2
│
└── [Right column]
    └── ScoutingPlayerSearchCardV2
        ├── Search + position filters
        ├── Sortable table (photo / name / role / age / team / value / action)
        └── Pagination (20/page)
```

### Key files

| File | Role |
|---|---|
| `src/ui-v2/dashboard/tabs/ScoutingTabV2.tsx` | v2 tab (284 lines) |
| `src/ui-v2/dashboard/tabs/ScoutingAssignmentsListV2.tsx` | Active assignments |
| `src/ui-v2/dashboard/tabs/ScoutingScoutDetailsCardV2.tsx` | Scout detail cards |
| `src/ui-v2/dashboard/tabs/ScoutingPlayerSearchCardV2.tsx` | Player search table |
| `src/components/scouting/ScoutingTab.model.ts` | Filter, paginate, build IDs |
| `src/components/scouting/ScoutingTab.helpers.ts` | Max slots, count, available |
| `src/services/scoutingService.ts` | API bridge |
| `src/components/playerProfile/PlayerProfile.scouting.ts` | Scout button in profile |
| `src-tauri/crates/olm_core/src/scouting.rs` | Core logic (399 lines) |
| `src-tauri/crates/olm_core/src/potential.rs` | Potential research system |
| `src-tauri/crates/olm_core/src/domain/message.rs` | ScoutReportData struct |
| `src-tauri/src/commands/transfers.rs` | Tauri command handler |
| `src-tauri/crates/olm_core/tests/scouting_tests.rs` | Tests (600 lines) |
