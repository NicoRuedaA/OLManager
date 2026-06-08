# Staff — Architecture & Usage

## Overview

Staff are static world data loaded from JSON files per competition plus a
free agent pool. Each staff member has a role (Coach, AssistantManager, Scout,
Physio), attributes, and a team affiliation. Their combined attributes produce
**staff effects** that modify training, scrims, match performance, and meta
discovery.

---

## Data flow

```
data/staffs/{league}_staffs.json  ──┐
data/staffs/free_agents.json     ──┤
                                   ├──→ competitions::load_staff() → game.staff[]
                                   │
staff_effects::LolStaffEffects    ←┘
  .for_team(game, team_id)
    → { coaching, development, tactics, analysis, recovery,
        morale, meta_discovery, execution }

UI (StaffTabV2)                    ← game.staff[]
  ├── hireStaff(id) → commands::staff::hire()
  └── releaseStaff(id) → commands::staff::release()
```

---

## Staff roles and their OVR

| Role | OVR weights (coach/ability/potential/physio) |
|---|---|
| Coach | 0.70, 0.15, 0.10, 0.05 |
| AssistantManager | 0.35, 0.25, 0.25, 0.15 |
| Scout | 0.10, 0.45, 0.40, 0.05 |
| Physio | 0.15, 0.05, 0.05, 0.75 |

### Specializations

Applied as multipliers on top of base effects:
| Specialization | Effect |
|---|---|
| Technique | development × 1.04 |
| Tactics | tactics × 1.05, execution × 1.02 |
| Youth | development × 1.03 |
| Fitness | recovery × 1.03 |

---

## Staff effects computation

`quality_mult(avg, empty_value, min, max)`:
```
if no staff of this role on team → return empty_value
else → (min + (avg/100) × (max - min)).clamp(min, max)
```

| Effect | Empty | Min | Max | Source attributes |
|---|---|---|---|---|
| coaching | 0.85 | 0.85 | 1.25 | Coach/AsstMgr coaching avg |
| development | 0.90 | 0.88 | 1.22 | Coach/AsstMgr coaching avg |
| tactics | 0.95 | 0.90 | 1.18 | Coach/AsstMgr coaching avg |
| analysis | 0.95 | 0.90 | 1.16 | Scout judging_ability avg |
| recovery | 1.00 | 0.95 | 1.25 | Physio physiotherapy avg |
| morale | 1.00 | 0.95 | 1.15 | Coach/AsstMgr coaching avg |
| meta_discovery | 0.90 | 0.90 | 1.20 | ability×0.75 + potential×0.25 |
| execution | 0.98 | 0.96 | 1.10 | (tactics + analysis) / 2 |

---

## Where effects are used

| Effect | Used in |
|---|---|
| coaching | Training gain multiplier (×1.25 max) |
| development | Champion mastery gain multiplier, match mastery scaling |
| tactics | Scrim gain_mult (55% weight), macro AI, combat stats |
| analysis | Scrim gain_mult (45% weight), combat stats |
| recovery | Condition recovery rate, morale penalty softening |
| morale | Recovery rate, fee/wage negotiation, potential research |
| meta_discovery | Daily champion reveal count (×0.90–1.20) |
| execution | Match simulation stat multiplier (×0.96–1.10) |

---

## Hiring & release

- **Hiring window**: outside `InSeason` phase (off-season only)
- **Hire**: sets `staff.team_id = manager_team_id`, deducts `staff.wage` from
  team finances, adds to `season_expenses`
- **Release**: sets `staff.team_id = None`, no financial reversal

---

## Frontend

### Component hierarchy (StaffTabV2)

```
StaffTabV2
├── Toolbar: "My Staff" / "Available" toggle + search + competition filter + role chips
├── Team impact banner (combined staff effects)
└── Card grid (4 per page)
    └── StaffCard
        ├── Avatar + name + OVR badge (0–100)
        ├── Role + age + nationality flag + team
        ├── Specialization badge + wage
        ├── 4 attribute bars
        ├── Role-specific impact rows
        └── Hire / Release button
```

### Key files

| File | Role |
|---|---|
| `src/ui-v2/dashboard/tabs/StaffTabV2.tsx` | v2 tab (568 lines) |
| `src/services/staffService.ts` | hire/release API |
| `src/lib/teams/lolStaffEffects.ts` | Frontend staff effects mirror |
| `src-tauri/crates/olm_core/src/staff_effects.rs` | Rust staff effects (178 lines) |
| `src-tauri/crates/olm_core/src/domain/staff.rs` | Staff domain types |
| `src-tauri/crates/olm_core/src/competitions.rs` | Staff data loading |
| `src-tauri/src/commands/staff.rs` | Tauri command handlers |
| `src-tauri/crates/olm_core/src/db/repositories/staff_repo.rs` | SQLite CRUD |
| `data/staffs/*.json` | Staff data files per region |
