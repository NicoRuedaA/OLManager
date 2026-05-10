# Multi-League System — Complete Analysis

## Overview

The multi-league system replaces the monolithic `world.json` approach with a modular, competition-driven data architecture. Instead of loading a single pre-built world (LEC only), the game now loads data from structured JSON files organised by competition, dynamically generating schedules for all leagues simultaneously.

---

## Architecture

### Data Flow

```
data/competitions/{id}/manifest.json
  ├── teams_file → data/teams/{id}_teams.json
  ├── players_file → data/players/{id}_players.json
  └── schedule config → generated in Rust

Frontend (React)
  ├── start_new_game_lightweight() → creates manager only
  ├── get_league_selection_data() → returns all competitions
  ├── select_team(team_id) → loads ALL competitions' data + generates schedules
  ├── TournamentsTab → league grid → full standings/fixtures for any league
  ├── ScheduleTab → Partidos (my league) / Calendario (all leagues)
  └── TeamSelection → league picker → team picker
```

### Game Creation Flow (Flow C)

```
1. start_new_game_lightweight()
   → creates Manager + empty Game state (no teams/players)

2. TeamSelection page
   → get_league_selection_data() → shows league grid
   → user picks a league → shows teams
   → user picks a team → select_team(teamId)

3. select_team(team_id)
   → assemble_world_from_modular_data()
     → scans ALL competition manifests
     → loads teams + players from every competition
     → prefixes team IDs (e.g. "team-123" → "lck-team-123")
     → bootstraps academy seeds (LEC ERLs)
     → applies default contracts
   → generates schedules for ALL competitions
   → assigns user's manager to selected team
   → bootstraps champion state
   → saves game
```

---

## Data Structure

### File Layout

```
data/
├── competitions/
│   ├── lec/manifest.json     (LEC — EMEA)
│   ├── lck/manifest.json     (LCK — Korea)
│   ├── lcs/manifest.json     (LCS — North America)
│   ├── lpl/manifest.json     (LPL — China)
│   ├── cblol/manifest.json   (CBLOL — Brazil)
│   └── lcp/manifest.json     (LCP — Asia Pacific)
├── teams/
│   ├── lec_teams.json        (10 teams)
│   ├── lck_teams.json        (10 teams)
│   ├── lcs_teams.json        (8 teams)
│   ├── lpl_teams.json        (14 teams)
│   ├── cblol_teams.json      (8 teams)
│   └── lcp_teams.json        (8 teams)
├── players/
│   ├── lec_players.json      (269 players)
│   ├── lck_players.json
│   ├── lcs_players.json
│   ├── lpl_players.json
│   ├── cblol_players.json
│   └── lcp_players.json
├── staffs/free_agents.json   (shared global pool)
├── draft/champions.json      (champion catalog)
└── erls/                     (academy seeds — LEC only)
```

### Competition Manifest

```json
{
  "id": "lck",
  "name": "LCK",
  "region": "KOREA",
  "tier": 1,
  "schedule": {
    "format": "double_round_robin",
    "team_count": 10,
    "splits": [{ "name": "Spring", "season_start": {...}, "best_of": 3 }]
  },
  "teams_file": "teams/lck_teams.json",
  "players_file": "players/lck_players.json"
}
```

### Competition Resolution (Rust)

The `CompetitionManifest` struct in `crates/ofm_core/src/generator/definitions.rs`:

```rust
pub struct CompetitionManifest {
    pub id: String,
    pub name: String,
    pub region: String,
    pub schedule: ScheduleConfig,
    pub teams_file: String,
    pub players_file: String,
    pub erls: Vec<String>,
    // ...
}
```

Scanning is done via `scan_competitions()` in `src/commands/competitions.rs`, which reads `data/competitions/*/manifest.json` from the filesystem at runtime with a 3-tier fallback (resource_dir → project root → src-tauri/).

### Schedule Generation

Schedules are generated for ALL competitions simultaneously in `select_team()` using `generate_schedule_from_config()`. Each competition gets its own `League` object with fixtures and standings, stored in `game.leagues: Vec<League>`.

---

## Backend Components

### Rust Crates

| Crate | Role |
|-------|------|
| `domain` | Pure types: Player, Team, Staff, League, LolRole, etc. |
| `ofm_core` | Game logic: schedule generation, champion system, training, transfers |
| `db` | SQLite persistence, save/load |
| `engine` | Match simulation |

### Key Rust Files

| File | Purpose |
|------|---------|
| `src/commands/competitions.rs` | Manifest scanning, team/player/staff loading, ERL runtime reads |
| `src/commands/game.rs` | `start_new_game_lightweight()`, `assemble_world_from_modular_data()`, `select_team()` |
| `crates/ofm_core/src/generator/definitions.rs` | `CompetitionManifest`, `TeamDataFile`, `PlayerDataFile`, etc. |
| `crates/ofm_core/src/schedule.rs` | `generate_schedule_from_config()`, round-robin generators |
| `crates/domain/src/team.rs` | `Team` struct with `competition_id`, `logo_url`, financial fields |
| `crates/domain/src/player.rs` | `Player` struct with all attributes, `LolRole` mapping |
| `crates/domain/src/staff.rs` | `Staff` struct with roles and attributes |
| `crates/domain/src/stats.rs` | `LolRole` enum with custom deserializer for legacy positions |

### Tauri Commands

| Command | Purpose |
|---------|---------|
| `start_new_game_lightweight` | Creates manager + empty game state |
| `get_league_selection_data` | Returns all competitions with teams for selection UI |
| `select_team` | Loads world, assigns team, generates schedules |
| `exit_to_menu` | Clears game state, navigates to main menu |
| `get_active_game` | Returns current game state to frontend |

---

## Frontend Components

### Key React Components

| Component | Purpose |
|-----------|---------|
| `pages/MainMenu.tsx` | New game form, calls `start_new_game_lightweight` |
| `pages/TeamSelection.tsx` | League picker + team selection grid |
| `components/tournaments/TournamentsTab.tsx` | League grid → standings/fixtures for any league |
| `components/schedule/ScheduleTab.tsx` | Partidos (my league) / Calendario (all leagues) |
| `components/teams/TeamsListTab.tsx` | Team listing with logos |
| `components/staff/StaffTab.tsx` | Staff management with role filters |
| `components/playerProfile/PlayerProfileHeroCard.tsx` | Player details with team + comp logos |
| `components/teamProfile/TeamProfileHeroCard.tsx` | Team profile with competition badge |
| `components/dashboard/DashboardSidebar.tsx` | Navigation sidebar with team logo |

### State Management

The game state is centralised in a Zustand store (`src/store/gameStore.ts`). Key types are in `src/store/types.ts`:

```typescript
interface GameStateData {
  teams: TeamData[];
  players: PlayerData[];
  staff: StaffData[];
  league: LeagueData | null;       // backward compat
  leagues?: LeagueData[];          // all competitions
  manager: { team_id: string; ... };
  // ...
}
```

---

## Logo Resolution

All logos are resolved through a consistent pipeline:

1. **Data files** store `logo_url` as `/team-logos/{slug}.webp`
2. **Rust** maps `/team-logos/` → `/teams-icons/` when loading teams
3. **Frontend** uses `team.logo_url` first, falls back to derivation from team ID
4. **Competition logos** stored at `/competitions-icons/{id}.webp`

Components updated to use this pipeline:
- DashboardSidebar (aside logo)
- TeamSelection (team cards)
- TeamsListTab (team grid)
- TeamProfileHeroCard (club profile)
- PlayerProfileHeroCard (player profile)
- ScheduleTab (fixtures)
- TournamentsTab (standings)

---

## Legacy Code Removed

| Legacy File | Replacement |
|-------------|-------------|
| `data/lec/` (full directory) | `data/competitions/{id}/`, `data/teams/`, `data/players/` |
| `data/lec/draft/players.json` | `data/players/{id}_players.json` |
| `data/lec/draft/teams.json` | `data/teams/{id}_teams.json` |
| `data/lec/draft/champions.json` | `data/draft/champions.json` |
| `data/draft/players.json` | Empty stub (frontend compat) |
| `data/draft/teams.json` | Empty stub (frontend compat) |
| `src-tauri/databases/world.json` | Modular JSON files |
| `scraper/` (full directory) | Removed — data sourced elsewhere |

---

## Current Limitations

1. **Players only load for the user's competition** — non-user leagues show teams but no player detail. Full player loading for all leagues would increase memory and startup time.

2. **Schedule generation assumes same start date** — all competitions use Jan 18 as first split start. Should be configurable per manifest.

3. **Academy/ERL system is LEC-only** — ERL academy seeds only exist for LEC. Other competitions don't have academy systems.

4. **Free agents are global** — the same staff pool is shared across all competitions. There's no per-competition free agent market.

5. **World editor not updated** — the legacy world editor still uses the old `world.json` format and hasn't been migrated to the modular system.

6. **Champion mastery starts empty** — the legacy seed for champion mastery was removed. Players no longer start with pre-assigned champion mastery.

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Competition manifests as flat JSON | Simple to edit, no DB required, git-friendly |
| Team IDs prefixed with competition | Avoids ID collisions across leagues |
| Logo URLs mapped at load time | Single source of truth in data files |
| Schedules generated for all leagues | Enables cross-league calendar view |
| User's league identified by team ID prefix | No separate "active league" state needed |
| Engram for SDD artifacts | Fast iteration during development |

---

## Current Competition Stats

| League | Teams | Players | Region | Format |
|--------|-------|---------|--------|--------|
| LEC | 10 | 269 | EMEA | single RR |
| LCK | 10 | — | KOREA | double RR |
| LCS | 8 | — | NORTH AMERICA | double RR |
| LPL | 14 | — | CHINA | single RR |
| CBLOL | 8 | — | BRAZIL | double RR |
| LCP | 8 | — | ASIA PACIFIC | double RR |
| **Total** | **58** | — | — | — |
