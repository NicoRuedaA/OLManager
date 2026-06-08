# Meta — Architecture & Usage

## Overview

The Meta tab manages two connected systems:

1. **Champion Patch Meta** — which champions are strong (S/A/B/C/D tiers) per
   role, discovered gradually by scouts. Updates every 14+ days on Tuesdays.
2. **Mastery Training** — per-player champion mastery improvement via 3 training
   targets, influenced by SoloQ rank and training focus.

---

## Data flow

### Patch meta

```
GAME START → bootstrap_champion_state()
  → For each (champion, role): score = base_role_score + random(-4..+4)
  → Rank all entries → assign tiers (S 12%, A 22%, B 30%, C 22%, D 14%)
  → hidden_meta[] stored on ChampionPatchState

EVERY TURN → process_daily_champion_system()
  ├─ bootstrap if missing
  ├─ apply_mastery_decay() — -1 every 28d after 56d inactive
  ├─ should_roll_patch()? (Tuesday + >=14d since last patch)
  │   └─ apply_patch():
  │       ├─ drift scores: score += random(-5..+5) + mean_reversion
  │       ├─ buff 4 bottom ~33% (+9), nerf 4 top ~25% (-9)
  │       ├─ re-rank → new tiers
  │       ├─ reset discovery for changed champions
  │       └─ generate patch notes inbox message
  └─ process_meta_discovery()
      ├─ reveals = 6 + scout_count*2 + ability/25 + potential/50
      ├─ × meta_discovery staff effect (0.90–1.20)
      └─ pick random undiscovered champions → add to discovered_champion_ids[]
```

### Mastery training

```
TRAINING DAY → process_training() (if not recovery focus)
  → For each of 3 champion_training_targets:
    → gain_mult × slot_priority (P1=1.0, P2=0.65, P3=0.4)
    → × focus_mult (ChampionPool=1.4, Individual=1.15, Scrims=1.0, ...)
    → × soloQ_mult (Challenger=1.2, Grandmaster=1.0, Master=0.8)
    → apply_training_mastery_progress() → probabilistic gain
```

---

## Champion tiers

### Distribution

| Percentile | Tier | Badge color |
|---|---|---|
| 0–12% | S | Orange (#F97316) |
| 12–34% | A | Red |
| 34–64% | B | Violet |
| 64–86% | C | Blue |
| 86–100% | D | Zinc |

Each `(champion, role)` pair has its own score and tier independently (e.g.
Ahri can be S-tier Mid but B-tier Top).

### Score computation

```
base_role_scores: Top=56, Jungle=57, Mid=58, ADC=56, Support=55
score = base + random(-4..+4), clamped 32–82
```

On patch day:
```
score += random(-5..+5) + (mean - previous) / 4  (mean reversion)
buff: +9 for 4 bottom ~33%
nerf: -9 for 4 top ~25%
```

---

## Meta discovery

Each day, scouts reveal random undiscovered champions:

```
base reveals = 6 + (scout_count × 2) + (ability / 25) + (potential / 50)
final = (base × meta_discovery).round() + random(0..4)
```

Where `meta_discovery` = staff effect composited from scout
`judging_ability` (75%) and `judging_potential` (25%), range 0.90–1.20.

**On patch day**, discovery is reset for champions that changed tier or were
buffed/nerfed.

---

## SoloQ computation

Computed in the frontend (mirrored between `TrainingTabV2` and `MetaTabV2`):

```
baseline = 3520 + (OVR - 76) × 52 + hash(player.id) % 121 - 60

Per training day:
  gain = 10 + (OVR - 75) × 0.8 + masterySignal × 0.08
  gain × intensity_mult × focus_mult

masterySignal = avg(top3 masteries) - 60 (min 0)

LP = points - 3000 baseline
Tier: Master ≥0 LP | Grandmaster ≥800 | Challenger ≥1300
```

---

## Mastery training vs regular training

| Aspect | Regular training | Mastery training |
|---|---|---|
| **What grows** | Player attributes | Champion mastery (25–100) |
| **Per-champion** | No | Yes — each target independently |
| **SoloQ influence** | No | Yes — 0.8–1.2× multiplier |
| **Decay** | None | -1 every 28d after 56d inactive |
| **Focus synergy** | Focus determines attribute | Focus determines gain rate |
| **Staff influence** | Coaching, facilities | Development, SoloQ tier |

### Mastery gain formula

```
chance = 0.16 + gain_factor × 0.26 + headroom × 0.2 + stat_push × 0.18
clamped 0.14–0.88

On success:
  mastery < 75 → +4
  mastery < 90 → +3
  else → +2
  + stat_bonus (0–2 based on mechanics + champion_pool)
```

---

## Frontend

### Component hierarchy (MetaTabV2)

```
MetaTabV2 (2-column grid)
├── [Left column]
│   ├── Patch Meta card
│   │   ├── Discovery progress bar
│   │   ├── Role filter (All / Top / Jungle / Mid / ADC / Support)
│   │   └── Tier grid (S/A/B/C/D rows with champ portrait tiles)
│   └── Discovery Stats card (per-tier progress bars)
│
└── [Right column]
    └── Mastery Training card
        └── Per-player cards
            ├── Header: photo + name + role + SoloQ tier/emblem
            └── 3 training slots (P1/P2/P3)
                ├── Champion select dropdown
                ├── Mastery progress bar
                └── Gain multiplier badge
```

### Key files

| File | Role |
|---|---|
| `src/ui-v2/dashboard/tabs/MetaTabV2.tsx` | v2 tab (765 lines) |
| `src-tauri/crates/olm_core/src/champions.rs` | Core engine (1512 lines) |
| `src-tauri/crates/olm_core/src/staff_effects.rs` | meta_discovery computation |
| `src-tauri/crates/olm_core/src/training.rs` | Mastery training integration |
| `src-tauri/crates/olm_core/src/domain/player.rs` | Player attributes |
| `src-tauri/src/commands/squad.rs` | Tauri command handlers |
| `src/store/types.ts` | ChampionMasteryEntryData, ChampionPatchStateData |
| `assets/simulation/champions.json` | Champion role catalog |
