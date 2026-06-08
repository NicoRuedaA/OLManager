# Youth / Academy — Architecture & Usage

## Overview

Academy teams are lower-tier affiliates that supply young talent. Each main
team can own one academy team. Academy players have lower OVR (60–70) but
can be promoted to the main roster or sold (proceeds go to the parent team).

---

## Data flow

```
GAME START → bootstrap_example_academy_pool()
  → Read data/competitions/{league}/manifest.json (tier ≥ 2)
  → Create AcademyTeamSeed + AcademyPlayerSeed per candidate
  → Deterministic OVR: 60 + hash(name) % 11
  → Deterministic potential: 75-83 (85%) or 84-90 (15% elite)
  → Auto-link known parent↔academy pairs (KOI→Fenix, G2→Nord, etc.)

YOUTH TAB → user sees acquisition options or active academy roster
  → ACQUIRE: pay cost (100K + reputation×40K + dev_level×20K)
    → Links parent.academy_team_id = academy.id
    → academy.parent_team_id = parent.id
    → academy lifecycle = Active
  → PROMOTE: player.team_id = parent_team_id
  → DEMOTE: player.team_id = academy_team_id
  → SELL: parent receives fee (proceeds go to main team budget)
```

---

## Academy player generation

### OVR
```rust
hash = player_name.bytes().fold(0, |acc, b| acc * 37 + b)
ovr = 60 + hash % 11  // Range: 60–70
```

### Potential
```rust
hash = player_name.bytes().fold(0, |acc, b| acc * 41 + b)
elite = hash % 100 < 15  // 15% chance
if elite → 84..=90
else → 75..=83
min(potential, ovr + 4)  // At least OVR+4
capped at 90
```

### Other stats
| Field | Value |
|---|---|
| Wage | 8,000 fixed |
| Contract end | ~2028-11-30 |
| Market value | 30% discount vs normal |
| Condition | 100 |
| Morale | 68 |

---

## Acquisition cost

```
cost = 100,000 + reputation × 40,000 + dev_level × 20,000
```

Where `reputation` and `dev_level` come from the candidate team's source
competition tier.

---

## Promotion / demotion

| Action | Effect |
|---|---|
| **Promote** | `player.team_id` → parent team ID. Inbox message sent. |
| **Demote** | `player.team_id` → academy team ID. Inbox message sent. |

No stat penalties or bonuses — the player's attributes remain unchanged.

---

## Academy transfer integration

- When an academy player is **sold**, proceeds go to the **parent team**
  (`credit_target_id = parent_team_id`)
- After selling, `ensure_academy_roster_continuity()` fills missing roles
  (free agent or synthetic replacement with copied attributes, wage/2, MV/2)
- AI teams can send offers for academy players (minimum score = 12 vs 8 for
  main roster)

---

## Data model

```rust
struct Team {
    team_kind: TeamKind,           // Main | Academy
    parent_team_id: Option<String>,
    academy_team_id: Option<String>,
    academy: Option<AcademyMetadata>,
}

struct AcademyMetadata {
    lifecycle: AcademyLifecycle,   // Planned | Active
    erl_assignment: ErlAssignment,
    source_team_id: String,
    acquisition_cost: i64,
    acquired_at: String,
}
```

Players are distinguished **only** by `team_id` — there is no "isAcademyPlayer"
flag. `team_id === academy.id` = academy player.

---

## Frontend

### Component hierarchy (YouthTabV2)

```
YouthTabV2
├── [No academy] → Acquisition card
│   └── Options grid (source team / league / country / cost / custom name)
├── [Academy exists] →
│   ├── KPIs (roster count, avg OVR, avg potential, avg condition)
│   ├── Coach banner (staff effects on youth development)
│   └── Roster table (photo / role / age / OVR / potential / condition / Promova)
```

### Key files

| File | Role |
|---|---|
| `src/ui-v2/dashboard/tabs/YouthTabV2.tsx` | v2 tab (661 lines) |
| `src/store/academySelectors.ts` | Academy team/player selectors |
| `src/services/academyService.ts` | API bridge |
| `src-tauri/crates/olm_core/src/academy.rs` | Core logic (733 lines) |
| `src-tauri/crates/olm_core/src/game_setup.rs` | Academy bootstrap |
| `src-tauri/crates/olm_core/src/domain/team.rs` | Team + AcademyMetadata types |
| `src-tauri/crates/olm_core/src/domain/player.rs` | Player struct |
| `src-tauri/src/commands/academy.rs` | Tauri command handlers |
