# Competition & Team Selection

When the user starts a new game, they pick a competition (league) and then a team before entering the dashboard. This document explains the data flow, the route split between v1 and v2, and the Rust backend behind it.

## User flow

```
Main Menu
  │
  ├─ "Start Career" → Tauri command: start_new_game_lightweight
  │    Creates an empty Game (manager only, no teams/players)
  │
  ├─ Navigate to /select-team
  │
  ├─ Screen 1: League Picker
  │    Grid of tier-1 competitions with logo, name, region
  │    User clicks one → show its teams
  │
  ├─ Screen 2: Team Grid
  │    Grid of teams in the selected competition
  │    User selects a team → Confirm button appears
  │    User clicks Confirm → Tauri command: select_team
  │
  ├─ World assembly (Rust)
  │    Scans ALL competition manifests, loads teams/players/staff
  │    Assigns manager to team, generates schedules, messages, news
  │    Saves to SQLite
  │
  └─ Navigate to /dashboard
```

## Route split: v1 vs v2

The app supports two UI versions, controlled by `localStorage` (`olmanager.uiVersion`).

| Layer | v1 | v2 |
|---|---|---|
| Route | `src/pages/TeamSelection.tsx` | `src/pages/TeamSelectionV2.tsx` |
| League grid | Inline in TeamSelection | `src/components/teamSelection/LeaguePickerV2.tsx` |
| Team grid | Inline in TeamSelection | `src/components/teamSelection/TeamGridV2.tsx` |
| Helpers | Inline | `src/components/teamSelection/teamSelection.helpers.ts` |
| Visual | Legacy tailwind, 4-column grid | Shadcn primitives, dark theme, 2-column grid, animated |

Both versions call the same Tauri commands. The v2 header is persistent (doesn't unmount between screens) — only the content area swaps.

## Data loading

### `get_league_selection_data` (Tauri command)

**Frontend:** `loadLeagueSelectionData()` → `invoke("get_league_selection_data")`

**Rust chain:**

```
commands/competitions.rs
  → olm_core::competitions::build_league_selection()
    → scan_competitions("data/competitions/*/manifest.json")
    → filter: tier === 1, legacy === false
    → for each valid manifest:
        competition_summary()
          → load teams from manifest's teams_file
          → load players from manifest's players_file (player count only)
          → return CompetitionSummary { id, name, region, logo, teams[] }
    → return LeagueSelectionData { competitions[] }
```

**Returned types** (from `src/store/types.ts`):

| Type | Fields |
|---|---|
| `LeagueSelectionData` | `competitions: CompetitionSummary[]` |
| `CompetitionSummary` | `id, name, region, logo, tier, team_count, teams: TeamSummary[]` |
| `TeamSummary` | `id, name, short_name, logo_url, country, city?, finance?, reputation?, colors?, ovr?, player_count?` |

Note: `ovr` is `null` at this stage — the full player data isn't loaded yet. The v1 version computes OVR on the fly from full `PlayerData`; the v2 version omits the OVR badge because the backend doesn't send it.

### `select_team` (Tauri command)

**Frontend:** `selectTeam(teamId)` → `invoke("select_team", { teamId })`

**Rust flow** (`commands/game.rs`):

1. **Detect flow**: If `game.teams` is empty → **Flow C** (lightweight start). Otherwise use existing game state.
2. **Flow C — modular assembly**: `assemble_world_from_modular_data()`
   - Extracts `competition_id` from the team ID (e.g. `"lec-g2"` → `"lec"`)
   - Scans **all** competition manifests (not just the selected one)
   - Loads teams, players, and staff from each competition's data files
   - Bootstraps academy teams from ERL catalog
   - Injects JSON free agents
   - Returns `(Vec<Team>, Vec<Player>, Vec<Staff>)`
3. **Validates** the selected team exists and is not an Academy team
4. **Assigns** the manager to the team
5. **Generates schedules** for ALL competitions from each `ScheduleConfig`
6. **Generates** preseason friendlies, messages (welcome, academy overview, staff advice), news (season preview)
7. **Bootstraps** champion state and refreshes season context
8. **Saves** to the per-save SQLite database
9. **Returns** the full `Game` struct → frontend sets it in Zustand store and navigates to `/dashboard`

## Visual components (v2)

### LeaguePickerV2

| File | `src/components/teamSelection/LeaguePickerV2.tsx` |
|---|---|
| Display | Grid of competition cards with logo, name, region, team count |
| Gradient | Regional accent per league (LEC → blue, LCS → red, LCK → green, etc.) |
| Animation | `animate-fade-in-up` with `60ms` stagger per card |

### TeamGridV2

| File | `src/components/teamSelection/TeamGridV2.tsx` |
|---|---|
| Display | Grid of team cards with logo, name, short name, country, stats |
| Stats | Player count, Tag, Budget, Reputation badge |
| Selection | Primary border + glow + checkmark icon, Confirm button in header |
| Animation | `animate-fade-in-up` with `50ms` stagger per card |

### Header (persistent in TeamSelectionV2)

The header lives in `TeamSelectionV2.tsx` and never unmounts between screens. It adapts:

| State | Title | Subtitle | Back action |
|---|---|---|---|
| League picker | "Select League" | "Choose a competition" | Back to main menu |
| Team grid | Competition name | "Choose a team" | Back to league picker |

The Confirm button only appears on the team grid when a team is selected.

## Files involved

| File | Role |
|---|---|
| `src/pages/TeamSelectionV2.tsx` | State machine: loading → league → teams |
| `src/pages/TeamSelection.tsx` | v1 monolithic equivalent |
| `src/components/teamSelection/LeaguePickerV2.tsx` | Competition card grid |
| `src/components/teamSelection/TeamGridV2.tsx` | Team card grid |
| `src/components/teamSelection/teamSelection.helpers.ts` | API wrappers + formatting helpers |
| `src-tauri/src/commands/competitions.rs` | `get_league_selection_data` command |
| `src-tauri/src/commands/game.rs` | `start_new_game_lightweight`, `select_team`, `assemble_world_from_modular_data` |
| `src-tauri/crates/olm_core/src/competitions.rs` | `build_league_selection`, `scan_competitions`, `competition_summary` |
| `src-tauri/crates/olm_core/src/generator/definitions.rs` | Rust type definitions |
| `data/competitions/*/manifest.json` | Per-competition configuration |
| `data/teams/*.json` | Team data |
| `data/players/*.json` | Player data |
