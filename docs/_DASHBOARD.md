# Dashboard

The dashboard is the main screen after selecting a team. It's a three-panel layout that hosts all game interactions — from team management to scouting, transfers, and match simulation.

## Layout

```
┌─────────────────────────────────────────────────────────┐
│  Sidebar (256px)      │  Header (48px)                  │
│                       ├─────────────────────────────────┤
│                       │                                 │
│  Navigation           │  Content area                    │
│  ─ Top               │  (tab-dependent)                 │
│  ─ Club              │                                 │
│  ─ World             │                                 │
│                       │                                 │
│  Footer               │                                 │
│  Settings             │                                 │
│  Exit                 │                                 │
└─────────────────────────────────────────────────────────┘
```

All three panels use the v2 design tokens: dark background (`bg-background`), card surfaces (`bg-card`), zinc neutrals with orange primary (`#F97316`).

## Panels

### Sidebar (`DashboardSidebarV2.tsx`)

Fixed 256px column on the left with three groups of navigation items:

| Group | Tabs |
|---|---|
| **Top** | Home, Inbox, News, Social, Schedule |
| **Club** | Squad, Tactics, Training, Scrims, Meta, Staff, Scouting, Academy, Finances, Transfers |
| **World** | Competitions, Players, Teams, Staff BD, Champions |

Each item has a Lucide icon, label, and optional badge (unread messages, player/team/staff counts). The sidebar also shows the team logo, manager avatar, and footer buttons for Settings and Exit.

### Header (`DashboardHeaderV2.tsx`)

48px bar at the top of the content area showing:

- **Back button** (only when there's profile navigation history)
- **Active tab label**
- **Current date** (formatted according to settings locale)
- **Save button** (triggers `save_game` Tauri command, shows "Saved!" flash for 2s)
- **Continue / Play** button (advances time, triggers match flow)

### Content area

Renders the active tab component. The content is determined by `profileNavigation.activeTab`:

- If a v2 tab component exists (Home, Inbox, Schedule, Squad, etc.) → renders the v2 component
- If a player/team/champion overlay is active → renders the overlay on top
- Otherwise → falls back to the legacy `DashboardWorkspaceContent`

## State machine

The dashboard uses a Zustand store (`src/store/gameStore.ts`) for the active game state. On mount:

1. If `hasActiveGame` is true → fetches the full state via `invoke("get_active_game")`
2. If no active game → probes the backend, shows "No active game" if none found
3. Champions are loaded separately via `invoke("get_champions")` if not already in state

### Profile navigation

Internal navigation between tabs is managed by `dashboardProfileNavigation` — a stack-based system that tracks the current tab, selected player, selected team, and champion view. The back button pops from this stack rather than using browser history.

## Data flow

```
User action → invoke Tauri command → Rust backend → SQLite / data/ → return new GameState
                                                                          │
                                                            setGameState(updated)
                                                                          │
                                                              Zustand store
                                                                          │
                                                         React re-render
```

Key Tauri commands used by the dashboard:

| Command | Trigger | Purpose |
|---|---|---|
| `get_active_game` | Mount | Load full game state |
| `save_game` | Save button | Persist to SQLite |
| `advance_time` | Continue button | Advance game clock, process matches |
| `exit_to_menu` | Exit button | Persist and navigate to main menu |
| `get_champions` | Mount (if needed) | Load champion catalog |

## Tab system

Each tab is a standalone component that receives `gameState` and callbacks:

```typescript
interface TabProps {
  gameState: GameStateData;
  onGameUpdate: (state: GameStateData) => void;
  onSelectPlayer?: (id: string) => void;
  onSelectTeam?: (id: string) => void;
  onNavigate?: (tab: string) => void;
}
```

Tabs call `onGameUpdate` with the new state returned by Tauri commands. The Zustand store is updated, triggering re-render across all components.

## Transitions

- Tab switches: instant (no animation between tabs)
- Player/team overlays: mount on top of the content area
- Match flow: controlled by `useAdvanceTime` hook — shows confirmation modal, then navigates to the match page

## v1 vs v2

The v2 dashboard lives entirely in `src/ui-v2/dashboard/`. The legacy v1 lives in `src/components/dashboard/`. Both can coexist — the active version is determined by `localStorage` at the `AppV2` / `App` level. Data, services, and Tauri commands are shared.

## Files

| File | Role |
|---|---|
| `src/ui-v2/dashboard/DashboardV2.tsx` | Main container: state management, routing, overlays |
| `src/ui-v2/dashboard/DashboardSidebarV2.tsx` | Navigation sidebar |
| `src/ui-v2/dashboard/DashboardHeaderV2.tsx` | Top bar with date, save, continue |
| `src/ui-v2/dashboard/tabs/*.tsx` | Individual tab components |
| `src/store/gameStore.ts` | Zustand store for game state |
| `src/hooks/useAdvanceTime.ts` | Match advance flow hook |
| `src/components/dashboard/dashboardProfileNavigation.ts` | Internal navigation stack |
