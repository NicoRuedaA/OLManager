# AGENTS.md — UI v2 handoff

This file is a living handoff for AI agents continuing the **UI v2** redesign of
OLManager. Read it top-to-bottom before touching `src/ui-v2/`. Update it when
you finish a tab so the next agent picks up cleanly.

---

## 1. Mission

Ship a brand-new UI ("v2") in parallel with the existing one ("v1") without
breaking the v1 experience. Users opt in from **Configuración → Versión de la
interfaz** (persisted in `localStorage`).

Visual language: **dark, dense, sports-tracker** (Sofascore / Football Manager
inspired). Tokens: zinc neutrals + **orange primary** (`#F97316` / `oklch(0.705
0.213 47.604)`). Heading font: **Barlow Condensed** uppercase, tabular numbers
for stats.

---

## 2. Where things live

```
src/ui-v2/
├── AppV2.tsx                   # router root; mirrors legacy routes, swaps /dashboard for DashboardV2
├── uiVersion.ts                # getUIVersion / setUIVersion / useUIVersion (localStorage + storage event)
├── components/ui/              # shadcn primitives (button, card, badge, table, tabs, …) — Base UI flavour
├── lib/utils.ts                # cn()
└── dashboard/
    ├── DashboardV2.tsx         # state container + tab dispatcher (intercepts Home/Inbox/Schedule, delegates rest to legacy)
    ├── DashboardSidebarV2.tsx  # shadcn sidebar mirroring legacy nav
    ├── DashboardHeaderV2.tsx   # topbar with date, save, continue
    └── tabs/
        ├── HomeTabV2.tsx       # ✓ done — big composite, lots of cards
        ├── InboxTabV2.tsx      # ✓ done — master/detail
        ├── ScheduleTabV2.tsx   # ✓ done — fixtures + standings
        ├── RosterLineupV2.tsx  # ✓ done — 5 role cards (used inside Home)
        └── (next tabs go here)
```

`src/main.tsx` wraps the app in `<Root>` which uses `useUIVersion()` to render
`<App />` (v1) or `<AppV2 />` (v2). Both share the legacy Tauri backend, store,
i18n and services.

---

## 3. Progress board

Status of every tab the Dashboard sidebar exposes. **Update this when you
finish one.**

| Tab            | v2 status   | File                                              | Notes                                         |
| -------------- | ----------- | ------------------------------------------------- | --------------------------------------------- |
| Home           | ✅ done     | `tabs/HomeTabV2.tsx`                              | TodayPhase, Roster, Standings, Week, KPIs…    |
| Inbox          | ✅ done     | `tabs/InboxTabV2.tsx`                             | Master/detail, filters, search, inline actions |
| Schedule       | ✅ done     | `tabs/ScheduleTabV2.tsx`                          | Fixtures by matchday + standings switcher     |
| News           | ⬜ pending  |                                                   | Similar shape to Inbox — list+detail          |
| Social         | ⬜ pending  |                                                   |                                               |
| Manager        | ⬜ pending  |                                                   | Profile + history                             |
| Squad          | ⬜ pending  |                                                   | **High priority** — daily-use tool            |
| Tactics        | ⬜ pending  |                                                   |                                               |
| Training       | ⬜ pending  |                                                   |                                               |
| Scrims         | ⬜ pending  |                                                   |                                               |
| Meta           | ⬜ pending  |                                                   |                                               |
| Staff          | ⬜ pending  |                                                   |                                               |
| Scouting       | ⬜ pending  |                                                   |                                               |
| Youth          | ⬜ pending  |                                                   |                                               |
| Finances       | ⬜ pending  |                                                   | Numbers + tables                              |
| Transfers      | ⬜ pending  |                                                   |                                               |
| Players        | ⬜ pending  |                                                   | Global player search                          |
| Teams          | ⬜ pending  |                                                   |                                               |
| Tournaments    | ⬜ pending  |                                                   |                                               |
| ChampionsWorld | ⬜ pending  |                                                   |                                               |

For any tab **not yet in v2**, the legacy `DashboardWorkspaceContent` renders
unchanged. The conditional lives in `DashboardV2.tsx` — see the
`activeTab === "Inbox"` / `activeTab === "Schedule"` branches and add yours.

---

## 4. How to add a new tab (recipe)

The cleanest path is to mirror the **InboxTabV2** pattern. The template:

1. **Create `src/ui-v2/dashboard/tabs/<Name>TabV2.tsx`**
   - Default-export a function `<Name>TabV2(props)` that takes the same data
     the legacy tab consumes (`gameState`, `onGameUpdate`, `onSelectTeam`, etc.).
   - Reuse legacy helpers/services aggressively: `@/services/*`,
     `@/components/<tab>/<tab>.helpers`, `@/utils/backendI18n`, etc.
2. **Wire it in `src/ui-v2/dashboard/DashboardV2.tsx`**:
   - Add the import.
   - Add a new `: profileNavigation.activeTab === "<TabId>" && !viewingChampionKey && !profileNavigation.selectedPlayerId && !profileNavigation.selectedTeamId ? ( …<TabV2/>… )` branch alongside Inbox/Schedule.
   - Same overlay guards as the existing branches.
3. **Update the progress board in this file** (Section 3).
4. **Typecheck + build**:
   ```
   npx tsc --noEmit
   npm run build
   ```

The pattern is: keep state/services owned by the legacy layer, swap only the
presentation.

---

## 5. Design tokens cheatsheet

| Token                                    | Use                                  |
| ---------------------------------------- | ------------------------------------ |
| `bg-background`                          | Page bg (zinc 950)                   |
| `bg-card`                                | Card surface (zinc 900)              |
| `bg-muted` / `bg-muted/30`               | Subtle fills, table headers          |
| `text-foreground`                        | Default text (near white)            |
| `text-muted-foreground`                  | Secondary text (zinc 400)            |
| `text-primary`                           | Brand orange                         |
| `text-emerald-400` / `text-red-400`      | W/L, positive/negative values        |
| `border-border` / `border-border/40`     | Dividers                             |
| `font-heading`                           | Barlow Condensed (titles, numbers)   |
| `tabular-nums`                           | Always on stat columns/values        |
| `uppercase tracking-widest text-xs`      | Section labels, eyebrow text         |

**Shadcn primitives in use** (under `@/ui-v2/components/ui/`):
`button, card, badge, table, tabs, scroll-area, tooltip, avatar, separator, breadcrumb`.

Card composition:

```tsx
<Card className="h-full">                {/* h-full = stretch in grid */}
  <CardHeader className="flex-row items-center justify-between space-y-0">
    <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
      Section title
    </CardTitle>
    {/* optional CTA on the right */}
  </CardHeader>
  <CardContent>{/* content */}</CardContent>
</Card>
```

**Layout rule for grids with mixed heights:** put `h-full` on the `<Card>` so
siblings in the same row stretch to match the tallest one. Don't use
`grid-cols-[Xpx_1fr_…]` arbitrary values — flex with `shrink-0`/`flex-1` is
more reliable across Tailwind v4 + the Tauri webview.

---

## 6. Reusable helpers — don't reinvent

| Concern                  | Helper                                                              |
| ------------------------ | ------------------------------------------------------------------- |
| Team logo                | `resolveTeamLogo(name, logoUrl?)` from `@/lib/teamLogos`             |
| Player photo             | `resolvePlayerPhoto(id, matchName, profileImageUrl)` from `@/lib/playerPhotos` |
| Champion splash          | `resolveChampionSplash(normalizeChampionKey(name))` from `@/lib/championImages` + `@/lib/championIds` |
| Format dates             | `formatDateShort(date, lang)` / `formatMatchDate(date)` from `@/lib/helpers` |
| i18n backend messages    | `resolveMessage(msg)` / `resolveNewsArticle(article)` / `resolveBackendText(...)` from `@/utils/backendI18n` |
| LoL role / OVR           | `resolvePlayerLolRole`, `calculateLolOvr` from `@/lib/lolIdentity`, `@/lib/lolPlayerStats` |
| Next opponent            | `getNextOpponentWidgetData` from `@/components/home/HomeTab.helpers` |
| Roster overview          | `getHomeRosterOverview` from same helpers file                       |
| Recent results           | `getRecentResultsForTeam` from same helpers file                     |
| Standings sort           | `compareStandingsByLolScore` from `@/store/gameStore`                |
| Fixtures BO inference    | `inferBestOf`, `buildBestOfContext`, `normalizeLolScore` from `@/components/schedule/ScheduleTab.helpers` |

When in doubt, **find the equivalent legacy card** under `src/components/<tab>/`
and look at what helpers it imports. Reuse the same ones.

---

## 7. Gotchas (read this!)

### State shape (post 0.3-multileague merge)
- `gameState.leagues` is an **array**, never `gameState.league`. Use
  `gameState.leagues?.[0]` for the player's active league.
- `fixture.match_type` (not `fixture.competition`). The TypeScript type in
  `src/store/types.ts` was renamed to match the rest of the codebase.

### Data
- The canonical data tree is `data/` (no `data/lec/*` legacy paths). If you see
  a legacy path in old code, it has been moved.
- `data/draft/{ai-config,champion-timings,champions,players,teams}.json` exist
  again post-0.3 — you can import `DraftResultScreen` safely.
- Team JSONs must **not** contain both `stadium_name` and `arena_name` at once —
  `Team::stadium_name` has `#[serde(alias = "arena_name")]` and duplicate keys
  blow up serde. The OLMDBManager export at commit
  `9aa2807` strips the legacy key.

### Imports
- Use the `@` alias (`@/store/...`, `@/lib/...`, `@/ui-v2/...`). Path resolves
  to `src/*`.
- Avoid importing anything that transitively pulls in
  `LolMatchLive → lol-prototype/*` from a v2 tab unless the tab actually needs
  the live match engine — the bundle inflates fast.

### React / Tailwind
- Put hooks (`useMemo`, `useState`, …) **above** any conditional `return`.
  Rules of hooks aren't just a lint — Tauri's strict-mode React will refuse
  to re-render when you violate them.
- Tailwind v4 arbitrary-value grid templates with underscores
  (`grid-cols-[54px_1fr_80px]`) have been flaky inside the Tauri webview. Use
  flex with `shrink-0 / flex-1` widths.

### Save backwards compat
- Saves from pre-0.3 versions don't migrate cleanly: the DB schema gained a
  `competition_id` column on `competitions` that the legacy `league` table
  doesn't backfill. The user-facing message is "Sin liga activa — inicia
  partida nueva". Don't try to "fix" this in v2; it's a backend concern.

---

## 8. Workflow

- Branch: `feat/ui-v2` (current). Stay on it for all v2 work.
- Push to `origin` (fork). Never merge upstream into v1-only branches.
- Periodically merge `upstream/0.3-multileague` to stay current. Last merge:
  commit `4eed6ba3`.
- Commit style: `feat(ui-v2): …`, `fix(ui-v2): …`, `chore(ui-v2): …`.
  Co-author trailer for AI commits when relevant.

### Verifying changes

```
npx tsc --noEmit               # type check (some pre-existing legacy errors are ok)
npm run build                  # bundle smoke test
npm run tauri dev              # full app — needs Rust toolchain + cargo
```

Tauri dev recompiles Rust on first start (~minutes). Once running, refresh
the webview to pick up frontend changes. UI version toggle lives in
**Configuración** in-app — no env var, no restart.

---

## 9. Quick start for the next agent

1. Read this file (you're doing it).
2. Skim `src/ui-v2/dashboard/tabs/InboxTabV2.tsx` end-to-end. It's the
   canonical template — toolbar + filter chips + master/detail + actions.
3. Pick the next tab from Section 3.
4. Find its legacy file under `src/components/<tab>/<Tab>Tab.tsx` and its
   helpers under `src/components/<tab>/<Tab>Tab.helpers.{ts,tsx}`.
5. Follow Section 4 recipe.
6. Update Section 3 when done.

When in doubt about visual decisions, copy the **shape** of the legacy tab
(same data, same hierarchy) but the **chrome** from existing v2 tabs (Card +
CardHeader + CardContent + h-full + shadcn primitives).

---

## 10. Where to ask "why?"

- Architecture: `docs/ARCHITECTURE.md`, `docs/architecture-multileague.md`
- Data model: `docs/data-model.md`, `docs/data-migration.md`
- Legacy UI map: every `src/components/<tab>/<Tab>Tab.tsx` is the entry point
  for that tab — start there to understand inputs/outputs before maquetando v2.
