# OLManager — Análisis Exhaustivo del Proyecto

**Fecha:** 08-MAY-2026  
**Versión del Proyecto:** 0.2.0 (Pre-alpha)  
**Licencia:** GPL-3.0  
**Repositorio:** https://github.com/OpenLeagueManager/OLManager  

---

## 1. Resumen General & Propósito

OLManager (Open League Manager) es un **juego desktop de gestión de equipos de esports (League of Legends)** construido con **Tauri v2**, **React 19 + TypeScript** en el frontend y un **workspace Rust** en el backend. Es el sucesor espiritual de OpenFootManager, migrando de fútbol a League of Legends.

### Stack Tecnológico Principal

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Desktop shell | Tauri v2 | ^2.10 |
| Frontend | React + TypeScript | ^19.2 / ~6.0 |
| Bundler | Vite | ^8.0 |
| CSS | Tailwind CSS 4 | ^4.2 |
| Backend | Rust (edition 2024) | 1.80+ |
| Base de datos | SQLite (rusqlite) | 0.32.1 |
| Estado frontend | Zustand | ^5.0 |
| Routing | react-router-dom | ^7.14 |
| i18n | i18next | ^26.0 |
| Testing frontend | Vitest + Testing Library | ^4.1 / ^16.3 |
| Testing Rust | cargo test | — |

**Archivos clave:**
- `package.json` — Define scripts, dependencias, versión
- `src-tauri/Cargo.toml` — Define workspace Rust con 4 crates + binario
- `README.md` — Visión general, arquitectura, convenciones
- `docs/ARCHITECTURE.md` — Documentación técnica detallada

---

## 2. Arquitectura — Deep Dive

### 2.1 Diagrama de Arquitectura General

```
┌─────────────────────────────────────────────────────┐
│  FRONTEND (React 19 + TS 6.0 + Vite 8)              │
│                                                      │
│  Pages ─── Components ─── Services ─── Stores/Zustand│
│                                        │             │
│  Hooks ─── lib/utils ─── i18n ────────┤             │
│                                        │ Tauri IPC   │
├────────────────────────────────────────┼─────────────┤
│  BACKEND (Rust workspace)              │             │
│                                        ▼             │
│  Commands (thin handlers) ─── Application Services   │
│       │                                             │
│  ┌────┴─────────────────────────────────────┐       │
│  │  ofm_core (orquestación de juego)        │       │
│  │    ┌──────┐ ┌──────┐ ┌────────┐         │       │
│  │    │domain│ │engine│ │  db    │         │       │
│  │    └──────┘ └──────┘ └────────┘         │       │
│  └──────────────────────────────────────────┘       │
│                                                      │
│  StateManager (Mutex<Session>) + SaveManager         │
└─────────────────────────────────────────────────────┘
```

### 2.2 Frontend Architecture

#### Estructura de directorios (`src/`)

| Directorio | Propósito |
|-----------|-----------|
| `pages/` | 5 screens principales (MainMenu, TeamSelection, Dashboard, MatchSimulation, Settings) + ChampionPage, WorldEditor |
| `components/` | ~36 subdirectorios de feature (dashboard/, match/, squad/, training/, transfers/, scouting/, scrims/, etc.) |
| `services/` | 10 wrappers tipados sobre `invoke()` de Tauri |
| `store/` | 2 stores Zustand (gameStore, settingsStore) + types masivos |
| `hooks/` | useAdvanceTime, useUpdater, useScrimContextWithFallback |
| `lib/` | 36 archivos de utilidades/lógica de frontend |
| `i18n/` | Config i18next + 8 locales (en, es, pt, fr, de, it, pt-BR, tr) |
| `context/` | ThemeContext (dark/light/system) |
| `content/` | Social content system (lol/social/) |
| `utils/` | Backend i18n bridge utilities |

#### Routing (App.tsx)

```typescript
<BrowserRouter>
  <Routes>
    <Route path="/" element={<MainMenu />} />
    <Route path="/select-team" element={<TeamSelection />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/match" element={<MatchSimulation />} />
    <Route path="/settings" element={<Settings />} />
  </Routes>
</BrowserRouter>
```

Todas las rutas usan **`lazy()` + `Suspense`** para code-splitting automático. Además bloquea la navegación por botones de retroceso/adelante del navegador (típico en apps Tauri).

#### State Management

**Zustand** con dos stores:

- **`gameStore.ts`**: Estado de la sesión de juego (hasActiveGame, managerName, gameState, isDirty). El `gameState` es un objeto masivo `GameStateData` (~843 líneas de tipos) que contiene TODO el estado del juego serializado desde Rust. Esto significa que **todo el game state viaja completo por IPC** en cada respuesta.

- **`settingsStore.ts`**: Configuración de la app (tema, idioma, moneda, match speed, etc.). Persiste via `invoke("save_settings")` al backend.

#### Service Layer (IPC Boundary)

Los `services/` son wrappers tipados sobre `invoke()` de Tauri. Cada servicio es responsable de un área funcional:

- `academyService.ts` — Normaliza respuestas del backend (BackendAcademyAcquisitionOption → AcademyAcquisitionOptionData)
- `transfersService.ts` — Transfer bids, counter-offers, contract releases
- `playerService.ts` — Potential research, champion training
- `trainingService.ts` — Training focus, schedules, groups
- `staffService.ts` — Hire/release staff
- `scoutingService.ts` — Send scouts, scouting assignments
- `inboxService.ts` — Messages CRUD
- `advanceTimeService.ts` — Time advancement
- `socialService.ts` — Social feed
- `jobService.ts` — Job applications

**Patrón clave:** Los servicios devuelven `Promise<GameStateData>` típicamente, lo que significa que **casi toda mutación en el backend retorna el game state completo**.

### 2.3 Backend Architecture

#### Rust Workspace Structure

```
src-tauri/
├── Cargo.toml            # Workspace root + bin/lib
├── src/
│   ├── main.rs           # Entry point
│   ├── lib.rs            # Plugin setup, state management, command registration
│   ├── error.rs          # AppError enum (8 variantes)
│   ├── commands/         # 21 módulos de comandos Tauri
│   └── application/      # Orchestación (time_advancement, lol_sim_v2, team_talk)
└── crates/
    ├── domain/           # Tipos de dominio puros (sin Tauri/SQLite)
    ├── engine/           # Simulación de partidos (pura, sin I/O)
    ├── ofm_core/         # Lógica de gameplay (Game, StateManager, turnos)
    └── db/               # Persistencia SQLite (migrations, repositories)
```

#### `domain` crate

15 módulos con tipos serializables:
- `player.rs` (667 lines) — Player, PlayerAttributes, PlayerTrait enum (16 traits), ContractRenewalState, PlayerMoraleCore, TransferOffer
- `team.rs` (1266 lines) — Team, AcademyMetadata, Facilities, TrainingFocus/Groups, ScrimReports, LolTactics (6 dimensiones: strong_side, game_timing, jungle_style, jungle_pathing, fight_plan, support_roaming)
- `stats.rs` (278 lines) — LolRole con deserialización personalizada que mapea posiciones legacy de fútbol → LoL
- `manager.rs`, `league.rs`, `champion.rs`, `champion_stats.rs`, `staff.rs`, `message.rs`, `news.rs`, `social.rs`, `negotiation.rs`, `season.rs`, `identity.rs`

**Feature flag `typescript`**: Usa `ts-rs` para generar tipos TypeScript automáticamente desde los structs Rust. Esto es **brutal para mantener la sync** frontend/backend.

#### `engine` crate

Simulación de partidos LoL pura:
- `types.rs` — PlayerData, TeamData, MatchConfig, Side, Zone (con lógica de avance de zona)
- `live_match/` — Simulation state machine, snapshot system, LoL map walls (JSON)
- `engine/mod.rs` — `simulate_lol()` función principal
- `event.rs` — MatchEvent, EventType
- `report.rs` — MatchReport, KillDetail, PlayerMatchStats
- `ai.rs` — AI opponent behavior

El match simulator tiene un sistema de zonas (HomeBox → HomeDefense → Midfield → AwayDefense → AwayBox) con lógica de avance/retroceso.

#### `ofm_core` crate

43 módulos que contienen TODA la lógica de gameplay:
- `state.rs` — `StateManager` con `Mutex<Session>` (single-lock pattern para evitar deadlocks)
- `game.rs` — `Game` struct principal
- `turn/` — Sistema de turnos (mod.rs, post_match.rs, round_summary.rs, news.rs)
- `transfers.rs` (2104 lines) — Sistema de transferencias completo con negociación
- `training/` — Sistema de entrenamiento con fitness_warnings
- `scrim_flow.rs` — Flujo de scrims
- `generator/` — Generación de mundo (world_io, generation, definitions, data)
- `player_events/`, `random_events/`, `narrative/` — Sistemas de eventos narrativos
- `live_match_manager/` — Coordinación de partidos en vivo
- `social.rs`, `social_registry.rs`, `social_templates.rs` — Sistema social

#### `db` crate

Persistencia SQLite:
- `migrations.rs` — 52 migraciones (V1 a V51) usando `rusqlite_migration`
- `repositories/` — 15 repositorios (player_repo, team_repo, manager_repo, league_repo, etc.)
- `game_database.rs` — Abre/crea bases de datos por save, aplica migraciones
- `game_persistence.rs` — Reader/Writer para serializar/deserializar Game completo
- `save_manager.rs` (1280 lines) — Gestión completa de saves (crear, cargar, guardar, borrar, migrar)
- `save_index.rs` / `save_index_manager.rs` — Índice de saves con checksums
- `legacy_migration.rs` — Migración de saves legacy de OpenFootManager
- `sql/` — 48 archivos SQL (algunos orfanos, comentarios en migrations.rs)

### 2.4 Tauri Bridge

#### Commands registrados (lib.rs)

**~100+ comandos** Tauri agrupados en 21 módulos:

| Módulo | Comandos clave |
|--------|---------------|
| `game` | start_new_game, load_game, get_active_game, save_game, exit_to_menu |
| `time` | advance_time, advance_time_with_mode, skip_to_match_day |
| `club` | select_team, set_formation, set_play_style, upgrade_facility |
| `squad` | set_active_lineup, set_starting_xi, set_lol_tactics, set_team_roles |
| `transfers` | make_transfer_bid, respond_to_offer, counter_offer, toggle_transfer_list |
| `contracts` | propose_renewal, delegate_renewals, release_player_contract |
| `training` | set_training, set_training_schedule, set_training_groups, set_player_training_focus |
| `scouting` | send_scout, get_academy_acquisition_options, acquire_academy_team |
| `scrims` | set_weekly_scrims, finalize_weekly_scrim_setup, choose_post_scrim_decision |
| `staff` | hire_staff, release_staff |
| `academy` | promote_academy_player, create_academy |
| `live_match` | start_live_match, step_live_match, apply_match_command, finish_live_match |
| `season` | advance_to_next_season, check_season_complete, get_season_awards |
| `social` | get_social_feed, create_manager_social_post, get_social_accounts |
| `lol_sim_v2` | lol_sim_v2_init, lol_sim_v2_tick (simulación detallada LoL) |
| `settings` | get_settings, save_settings |
| `champion` | get_champions, seed_champions_from_json |
| `stats` | get_player_match_history, get_player_stats_overview, get_team_stats |

#### Managed State

```rust
// lib.rs
.manage(StateManager::new())          // ofm_core::state (Mutex<Session>)
.manage(LolSimV2StoreState::default()) // lol_sim_v2 state
.setup(|app| {
    let save_manager = SaveManager::init(...)?;
    app.manage(SaveManagerState(Mutex::new(save_manager)));
})
```

#### Error Handling

`AppError` enum con 8 variantes tipadas y códigos i18n:
```rust
pub enum AppError {
    SaveNotFound(String),  // "SAVE_NOT_FOUND"
    Database(String),      // "DATABASE_ERROR"
    Validation(String),    // "VALIDATION_ERROR"
    Session(String),       // "SESSION_ERROR"
    Lock(String),          // "LOCK_ERROR"
    Io(String),            // "IO_ERROR"
    NotFound(String),      // "NOT_FOUND"
    Conflict(String),      // "CONFLICT"
    Generic(String),       // "GENERIC_ERROR"
}
```

Implementa `From<String>` y `From<&str>` para usar `?` en comandos.

---

## 3. Calidad de Código & Patrones

### 3.1 TypeScript

**Strict mode habilitado:**
```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true
}
```

**TypeScript 6.0** — bleeding edge. Esto es risky porque TS 6.0 es muy reciente y puede tener breaking changes o bugs.

**Type safety patterns:**
- Tipos de dominio completos en `store/types.ts` (843 líneas)
- Servicios con tipos de entrada/salida explícitos
- Normalización de respuestas del backend en servicios (ej: `academyService.ts` mapea `BackendAcademyAcquisitionOption` → `AcademyAcquisitionOptionData`)
- Zod ^4.4.2 disponible pero no parece usado extensivamente todavía
- `LegacyCompatibilityValue = any` para campos legacy — esto ES un escape hatch

### 3.2 Rust

**Edition 2024** — muy moderna, recién estabilizada. Consistentemente usada en los 4 crates.

**Error handling patterns:**
- `thiserror` v2 para `AppError` en el crate principal
- En los crates de dominio: errores simples con `String` returns
- `StateManager::with_session()` y `with_session_mut()` — patrón de función closure para acceso sincronizado

**Clean architecture separation:**
- `domain` → NO dependencies pesadas (solo serde, log)
- `engine` → NO dependencies de dominio ni db
- `ofm_core` → Depende de domain + engine
- `db` → Depende de domain + ofm_core

**Clippy warnings suprimidos** en domain (derivable_impls) y engine (new_without_default, collapsible_if, useless_conversion) — tracking en issue #92.

### 3.3 Testing Strategy

#### Frontend (Vitest + jsdom + Testing Library)

**117 archivos de test** reportados según `README.md`. Distribución:

| Área | Tests encontrados |
|------|-----------------|
| `components/` | ~85 (dashboard, match, training, transfers, scrims, home, squad, staff, scouting, ui, etc.) |
| `lib/` | ~12 (finance, helpers, scrimContext, lolScrimPrep, lolPlayerStats, etc.) |
| `services/` | ~9 (academy, advanceTime, inbox, player, scouting, staff, training, transfers) |
| `store/` | ~4 (gameStore, settingsStore, academySelectors, academyContracts) |
| `pages/` | ~3 (Dashboard, MainMenu, MatchSimulation) |
| `hooks/` | ~1 (useAdvanceTime) |
| `content/` | ~6 (social schema, selectors, matchContext, guard, content, i18nCoverage) |
| `utils/` | ~3 (backendI18n, playerEvents, localeCoverage) |
| `context/` | ~1 (ThemeContext) |
| `i18n/` | ~1 (footballTermGuard) |

**Setup:** `src/test-setup.ts` importa `@testing-library/jest-dom/vitest`. Config en `vite.config.ts`:
- Environment: jsdom
- Globals: true
- Coverage excluye locales y test files

#### Rust (cargo test)

**22 archivos de test** (integración):

| Crate | Tests de integración |
|-------|---------------------|
| `ofm_core/tests/` | 18 (academy, club, contracts, end_of_season, finances, live_match_manager, messages, narrative_*, player_events, random_events, scouting, scrim_flow, training, transfers, turn) |
| `engine/tests/` | 2 (simulation_tests, live_match_tests) |
| `db/tests/` | 1 (academy_team_persistence) |
| `domain/` | Inline tests en player.rs, team.rs, identity.rs |

**Patrón de test en Rust:** Los tests de ofm_core usan `#[test]` directos con fixtures inline. Los tests de engine simulan partidos completos. db tests usan `tempfile` para bases de datos temporales.

### 3.4 Observaciones sobre Testing

✅ **Bueno:** Tests colocalizados, cobertura amplia en componentes, testing de stores y servicios.  
⚠️ **Precaución:** Muchos tests de componentes probablemente son snapshot/shallow — habría que verificar la profundidad.  
⚠️ **Missing:** `cargo test` para el crate principal `openleaguemanager` está comentado en CI (ver `pr.yml` línea 75-77: "tests blocked by lol_sim_v2.rs").  
⚠️ **CI:** `cargo clippy` y `cargo fmt` corren con `continue-on-error: true` — no blocking.

---

## 4. Features & Módulos Principales

### 4.1 Features Identificadas

| Feature | Frontend | Backend | Estado |
|---------|----------|---------|--------|
| **Main Menu** | `MainMenu.tsx` | `commands/game.rs` | ✅ |
| **Team Selection** | `TeamSelection.tsx` | `select_team` command | ✅ |
| **Dashboard** | `Dashboard.tsx` + 20 subcomponentes | Multiple commands | ✅ |
| **Gestión de Plantel** | `SquadTab` + players/ | `set_active_lineup`, etc. | ✅ |
| **Tácticas LoL** | `TacticsTab` | `set_lol_tactics`, `set_play_style` | ✅ |
| **Entrenamiento** | `TrainingTab` + TrainingGroups | `set_training*` | ✅ |
| **Scrims** | `ScrimsTab` | `scrim_flow.rs` (complejo) | ✅ |
| **Transferencias** | `TransfersTab` | `transfers.rs` (2104 lines) | ✅ |
| **Renovaciones** | Contract components | `contracts.rs`, `delegated_renewals.rs` | ✅ |
| **Scouting** | `ScoutingTab` | `scouting.rs` | ✅ |
| **Academia** | `YouthAcademyTab` | `academy.rs` | ✅ |
| **Staff** | `StaffTab` | `hire_staff`, `release_staff` | ✅ |
| **Finanzas** | `FinancesTab` | `finances.rs` | ✅ |
| **Partidos en Vivo** | `MatchSimulation.tsx` + LolMatchLive | `live_match_manager/` + `engine/` | ✅ |
| **Simulación Detallada LoL** | `LolLiveMap.tsx` | `lol_sim_v2/` (6376 lines!) | 🟡 Complejo |
| **Inbox/Mensajes** | `InboxTab` | `messages.rs` | ✅ |
| **Noticias** | `NewsTab` | `news.rs` + `news/` | ✅ |
| **Social Feed** | Social components | `social.rs`, `social_registry.rs` | ✅ |
| **Calendario** | `ScheduleTab` | `schedule.rs` | ✅ |
| **Tournament/Playoffs** | `TournamentsTab` | Fixture system | ✅ |
| **Season Progression** | Season context | `turn/`, `end_of_season.rs`, `season_awards.rs` | ✅ |
| **Board Objectives** | Board components | `board_objectives.rs` | ✅ |
| **Champion Stats** | `ChampionPage.tsx` | `champion_stats.rs` | 🟡 |
| **World Editor** | `WorldEditor.tsx` | `generator/` | 🟡 |
| **Updater** | `UpdateModal` | Tauri updater plugin | ✅ |
| **Configuración** | `Settings.tsx` | `commands/settings.rs` | ✅ |
| **Tema** | ThemeContext + CSS | — | ✅ |
| **i18n** | 8 idiomas | `backendI18n.ts` bridge | ✅ |
| **Manager Profile** | `ManagerTab` | Avatar save/load | ✅ |
| **Job Offers** | Job cards | `job_offers.rs` | ✅ |

### 4.2 Sistema Social (Content)

El sistema de contenido social en `src/content/lol/social/` es impresionante:
- `schema.ts` + `guard.ts` — Validación de contenido
- `content.ts` — Generación de posts
- `conversations.json`, `events.json`, `news.json`, `outlets.json`, `personas.json`, `questions.json`, `responses.json` — Datos de contenido
- `matchContext.ts` — Contexto de partido para contenido
- `selectors.ts` — Selectores de contenido

---

## 5. Dependencias & Tech Choices

### 5.1 Frontend (package.json)

| Dependencia | Versión | Propósito |
|------------|---------|-----------|
| `@tauri-apps/api` | ^2.11.0 | IPC bridge |
| `@tauri-apps/plugin-opener` | ^2 | Abrir URLs externas |
| `@tauri-apps/plugin-updater` | ^2.10.1 | Auto-updater |
| `react` | ^19.2.4 | UI framework |
| `react-router-dom` | ^7.14.0 | Routing |
| `zustand` | ^5.0.12 | State management |
| `zod` | ^4.4.2 | Schema validation |
| `i18next` + `react-i18next` | ^26.0 / ^17.0 | i18n |
| `lucide-react` | ^1.7.0 | Iconos |
| `country-flag-icons` | ^1.6.15 | Banderas |
| `i18n-iso-countries` | ^7.14.0 | Códigos de país |
| `@fontsource/barlow-condensed` | ^5.2.8 | Fuente headings |
| `@fontsource/inter` | ^5.2.8 | Fuente cuerpo |

**Dev Dependencies:**

| Dependencia | Versión | Propósito |
|------------|---------|-----------|
| `vite` | ^8.0.5 | Bundler |
| `@vitejs/plugin-react` | ^6.0.1 | React Fast Refresh |
| `tailwindcss` + `@tailwindcss/vite` | ^4.2.2 | CSS utility-first |
| `typescript` | ~6.0.2 | Type checking |
| `vitest` + `@vitest/coverage-v8` | ^4.1.2 | Testing |
| `@testing-library/react` | ^16.3.2 | Component testing |
| `@testing-library/jest-dom` | ^6.9.1 | DOM matchers |
| `jsdom` | ^29.0.1 | DOM environment |
| `sharp` | ^0.34.5 | Image processing |
| `@tauri-apps/cli` | ^2.11.0 | Tauri CLI |

### 5.2 Backend (Cargo.toml + Crates)

| Crate | Versión | Propósito |
|-------|---------|-----------|
| `tauri` | 2.10 | Desktop framework |
| `tauri-plugin-opener` | 2 | Open URLs |
| `tauri-plugin-log` | 2 | Logging |
| `tauri-plugin-updater` | 2 | Auto-update |
| `serde` + `serde_json` | 1 | Serialization |
| `rusqlite` | 0.32.1 | SQLite (bundled) |
| `rusqlite_migration` | 1.3 | Schema migrations |
| `chrono` | 0.4.44 | Date/time |
| `rand` | 0.10 | RNG |
| `uuid` | 1.21 | UUID generation |
| `base64` | 0.22 | Base64 encoding |
| `thiserror` | 2 | Error derive |
| `validator` | 0.19 | Input validation |
| `sha2` | 0.11 | Checksums |
| `ts-rs` | 10 | Rust→TS type generation |
| `log` | 0.4 | Logging facade |

### 5.3 Vite Config

```typescript
// Manual chunk splitting inteligente
manualChunks: {
  "react-vendor": react, react-dom, scheduler
  "router": react-router-dom
  "tauri": @tauri-apps/*
  "i18n": i18next/*
  "icons": lucide-react
}
```

Tauri-specific config:
- Puerto fijo 1420, strictPort: true
- HMR via ws cuando TAURI_DEV_HOST está seteado
- Ignora src-tauri/ en watch

### 5.4 Tauri Config

```json
{
  "windows": [{ "width": 1280, "height": 800, "minWidth": 960, "minHeight": 640 }],
  "security": { "csp": null },  // 👀 CSP deshabilitado
  "bundle": {
    "resources": ["databases/lec_world.json"],
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "...",
      "endpoints": ["https://github.com/.../latest.json"]
    }
  }
}
```

---

## 6. Build & Development Workflow

### Scripts disponibles

| Script | Comando | Propósito |
|--------|---------|-----------|
| `npm run dev` | `vite` | Dev server (Tauri inyecta `npm run dev` como beforeDevCommand) |
| `npm run build` | `vite build` | Build frontend |
| `npm run build:types` | `tsc -p tsconfig.release.json` | Type check sin emit |
| `npm test` | `vitest run` | Tests frontend |
| `npm run tauri` | `tauri` | Tauri CLI passthrough |

### CI/CD (GitHub Actions)

**PR Workflow** (`.github/workflows/pr.yml`):
1. `frontend-install` — npm ci
2. `rust-check` — cargo fmt, cargo check, clippy (continue-on-error), cargo test (core crates only)
3. `security-audit` — npm audit (high+), cargo audit
4. `frontend-full` — npm test, npm run build:types
5. `rust-full` — cargo clippy (continue-on-error), cargo test (core crates)

**⚠️ Notables en CI:**
- `cargo test` del crate principal está saltado por un bloqueo en `lol_sim_v2.rs` (línea 75-77)
- `cargo clippy` corre con `continue-on-error: true` en ambos jobs
- `cargo fmt` corre con `continue-on-error: true`
- `npm audit` con `continue-on-error: true`

---

## 7. Data Layer

### 7.1 SQLite Schema

**52 migraciones** desde V1 hasta V51, gestionadas con `rusqlite_migration`.

**Tablas principales:**
- `game_meta` — Metadata del juego (current_date, day_phase, etc.)
- `managers` — Manager profile + career stats
- `teams` — Teams con facilities, scrims, tácticas, finances (JSON columns)
- `players` — Players con attributes, contract, morale_core, potential
- `staff` — Staff members
- `league` — League metadata
- `fixtures` — Fixture schedule with best_of
- `standings` — League standings
- `messages` — In-game messages (i18n keys)
- `news` — News articles
- `social_posts` — Social feed
- `social_accounts` — Social accounts
- `social_templates` — Social post templates
- `board_objectives` — Board objectives
- `scouting_assignments` — Active scouting
- `lol_player_match_stats` — Player match statistics
- `lol_team_match_stats` — Team match statistics
- `champion_progression_state` — Champion mastery/patch state
- `champions` — LoL champion data

**Patrón de migraciones:** Usan hooks con `add_column_if_missing()` para idempotencia. Algunas migraciones usan `CREATE TABLE AS` para "dropear" columnas (SQLite no soporta DROP COLUMN nativamente en versiones anteriores).

### 7.2 Save System

- Per-save SQLite database: cada save es un archivo `.db` separado
- `SaveManager` con caché de conexiones (`game_db_cache: HashMap<String, Arc<Mutex<GameDatabase>>>`)
- `SaveIndexManager` para listar/metadatos de saves
- Checksums con SHA2 para integridad
- Legacy migration desde formato anterior (OpenFootManager)

### 7.3 Scraping & Data Generation

**`scraper/src/stats.ts`**: Script de generación determinista de stats de jugadores. Espeja el algoritmo Rust `build_lol_stats_from_seed()`:
- Hash del IGN del jugador
- Role bias matrix (Top/Jungle/Mid/Adc/Support → 9 stats)
- Normalización a target 70

**`scripts/`**: Scripts de Node.js + PowerShell para:
- `download-lol-item-icons.mjs` — Descarga de assets
- `fetch-leaguepedia-dobs.mjs` — Datos de jugadores reales
- `generate-lec-world.mjs` — Generación de mundo LEC
- `generate-lol-map-icons.ps1` — Iconos de mapa

**`data/`**: Datos del mundo (lec/, erls/)

---

## 8. Potenciales Issues & Áreas de Mejora

### 8.1 Arquitectura

🔴 **GameState completo via IPC**: Cada respuesta de comando incluye `GameStateData` completo. Esto puede ser un problema de performance cuando el estado crezca. Considerar actualizaciones incrementales o partial updates.

🔴 **`lol_sim_v2.rs` es MASIVO**: 6376 líneas en un solo archivo. Esto está bloqueando `cargo test` del crate principal. Necesita ser refactorizado en módulos más pequeños.

🔴 **`transfers.rs` es muy grande**: 2104 líneas. Podría beneficiarse de división en submódulos.

🟡 **`team.rs` en domain es enorme**: 1266 líneas. La estructura `Team` tiene ~50 campos. Considerar split en sub-entidades.

🟡 **`store/types.ts` es MASIVO**: 843 líneas con tipos duplicados entre frontend y backend. Si bien `ts-rs` ayuda, la duplicación manual persiste.

### 8.2 Code Quality

🟡 **`any` leak**: `LegacyCompatibilityValue = any` se usa como escape hatch en varios tipos. Esto rompe type safety.

🟡 **Clippy warnings suprimidos**: `#![allow(clippy::*)]` en domain y engine es técnicamente deuda técnica (tracked en #92, pero no resuelto).

🟡 **Rust edition 2024**: Muy reciente, puede tener problemas de compatibilidad con algunos crates. Monitorear.

✅ **Positivo**: `ts-rs` feature flag para generación automática de tipos TypeScript es una práctica excelente para mantener sync.

### 8.3 Security

🔴 **CSP deshabilitado**: `"csp": null` en tauri.conf.json. Esto significa que no hay Content Security Policy, lo que expone a XSS si hay vulnerabilidades en el frontend.

🟡 **npm audit en CI**: Corre pero con `continue-on-error: true`, lo que significa que no bloquea PRs con vulnerabilidades conocidas.

🟡 **cargo audit en CI**: Misma situación, corre pero no bloquea.

✅ **Positivo**: Política de seguridad documentada en `SECURITY.md`, proceso de reporting privado, y guías sobre secrets.

### 8.4 Testing

🔴 **Tests del crate principal bloqueados**: `cargo test` para el binario no corre en CI por `lol_sim_v2.rs`. Esto significa que los comandos Tauri en sí no tienen cobertura de tests automatizados en CI.

🟡 **continue-on-error generalizado**: Clippy, fmt, y auditorías de seguridad no bloquean el CI. Esto puede dejar pasar problemas.

🟡 **Muchos tests de componentes**: 117 archivos de test es impresionante, pero habría que verificar la calidad/profundidad. Tests solo de render vs. tests de interacción/comportamiento.

✅ **Muy positivo**: Tests de migrations con verificación de idempotencia y esquema.

### 8.5 Migraciones & Schema

🟡 **SQL orphan files**: En `sql/` hay archivos que no se usan directamente como migraciones (ej: `v028_avatar_path.sql`, `v029_profile_image_urls.sql`, `v030_nationality_code_migration.sql`, `v035_stadium_to_arena.sql`, `v036_stadium_to_arena_capacity.sql`, `v040_cleanup_teams_legacy.sql`). Los hooks en `migrations.rs` hacen el trabajo real.

🟡 **JSON columns**: Múltiples columnas JSON (facilities, scrim_reports, team_roles, etc.). SQLite no tiene soporte nativo de JSON como PostgreSQL, lo que complica queries.

### 8.6 Misceláneo

🟡 **`rand` v0.10**: Bastante nuevo. Verificar compatibilidad con otros crates.

🟡 **README.md tiene contenido de la rama `QoL-UI-2`** mezclado con la documentación principal (sección 9). Esto parece un merge residual.

✅ **Excelente documentación técnica**: ARCHITECTURE.md, GOVERNANCE.md, DATA_PROVENANCE.md, ADRs, etc. Muy completo para un proyecto pre-alpha.

✅ **Issue-first contribution model**: Bien documentado en CONTRIBUTING.md + templates de GitHub.

---

## 9. Security Considerations

### 9.1 Audit Setup

- **npm audit**: Corre en CI con `--audit-level=high --omit=dev`, pero `continue-on-error: true`
- **cargo audit**: Corre con `--deny warnings`, pero `continue-on-error: true` también
- **No hay dependabot** configurado visiblemente
- **No hay CodeQL** ni análisis SAST

### 9.2 Code-Level Security

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| CSP | 🔴 Deshabilitado | `"csp": null` — sin protección XSS |
| Input validation | 🟡 Parcial | `validator` crate disponible pero no usado consistentemente |
| SQL Injection | ✅ Prevenido | `rusqlite` usa queries parameterizadas |
| Error disclosure | ✅ Controlado | `AppError` con códigos i18n amigables |
| Secrets management | ✅ Documentado | `SECURITY.md` prohíbe commits de secrets |
| Safe file handling | ✅ Correcto | Path sanitization via `app_data_dir()` |
| Tauri capabilities | 🟡 Default | `capabilities/default.json` — revisar permisos |

### 9.3 Recomendaciones

1. **Implementar CSP** apropiado para Tauri (permitir solo `tauri://localhost` y recursos propios)
2. **Hacer blocking** las auditorías de seguridad en CI (sacar `continue-on-error`)
3. **Agregar dependabot** o renovate para actualizaciones automáticas de seguridad
4. **Agregar CodeQL** o similar para análisis estático
5. **Revisar capabilities** de Tauri para principios de mínimo privilegio

---

## 10. Conclusión General

OLManager es un proyecto **impresionantemente completo** para ser pre-alpha. La arquitectura es sólida, la separación de capas en Rust es correcta, y la cobertura de features es extensa para un juego de gestión de esports.

### Puntos Fuertes
✅ Arquitectura hexagonal en Rust con dependency direction clara  
✅ `ts-rs` para mantener tipos sync entre Rust y TypeScript  
✅ 52 migraciones SQLite bien estructuradas  
✅ Cobertura de tests amplia (~117 TS + ~22 Rust)  
✅ Sistema de contenido social complejo y bien diseñado  
✅ i18n completo con 8 idiomas  
✅ Feature flag system (`typescript`) para compilación condicional  
✅ Single-lock pattern en StateManager evita deadlocks  
✅ Auto-updater integrado  
✅ Legacy migration path desde OpenFootManager  

### Deuda Técnica Principal
🔴 `lol_sim_v2.rs` (6376 líneas) bloquea tests del crate principal  
🔴 GameState completo via IPC — escalabilidad  
🟡 CSP deshabilitado  
🟡 Clippy warnings suprimidos  
🟡 CI con `continue-on-error` generalizado  
🟡 `LegacyCompatibilityValue = any` rompe type safety  
🟡 README con merge residual de rama  

### Veredicto

> **OLManager es un proyecto serio, bien arquitecturado, con un equipo que entiende de clean architecture, domain-driven design, y testing. Está en pre-alpha pero tiene más estructura y calidad que muchos proyectos "production-ready".** Las áreas de mejora son principalmente deuda técnica acumulada por el crecimiento orgánico y decisiones pragmáticas para mantener el desarrollo ágil. Con resolver `lol_sim_v2.rs`, tightening del CI, y habilitar CSP, estaría en una posición sólida para una beta.

---

*Documento generado automáticamente el 08-MAY-2026.*
