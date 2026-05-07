# Open League Manager (OLManager) - Análisis Completo del Proyecto

> **Fecha del análisis:** 2026-05-07
> **Rama analizada:** `multileague-system`

---

## 1. Stack Tecnológico Completo

| Componente | Tecnología | Versión |
|------------|-----------|---------|
| **Runtime** | Tauri 2 (framework desktop nativo) | 2.x |
| **Backend** | Rust | edition 2021/2024 |
| **Frontend** | React + TypeScript | React 19.2.4, TS ~6.0.2 |
| **Bundler** | Vite | 8.0.5 |
| **CSS** | Tailwind CSS | 4.2.2 |
| **Desktop** | Tauri (WebView nativo) | 2.x |
| **Base de datos** | SQLite (via rusqlite) | 0.32.1 (bundled) |
| **DB Migrations** | rusqlite_migration | 1.3 |
| **State Management (FE)** | Zustand | 5.0.12 |
| **Routing (FE)** | react-router-dom | 7.14.0 |
| **i18n** | i18next + react-i18next | 26.x / 17.x |
| **Testing (FE)** | Vitest + Testing Library | 4.x / 6.x |
| **Testing (BE)** | Rust built-in `#[cfg(test)]` | — |
| **Serialization** | serde + serde_json | 1.x |
| **Type generation** | ts-rs (TypeScript bindings desde Rust) | 10.x (opt-in) |
| **Validation** | validator (Rust) | 0.19 |
| **Date/Time** | chrono | 0.4.44 |
| **UUID** | uuid | 1.x (v4) |
| **RNG** | rand | 0.10 |
| **Hashing** | sha2 | 0.11 |

**Plugins Tauri:** opener, log, updater (con auto-actualizaciones via GitHub Releases).

---

## 2. Arquitectura del Proyecto

### Estructura General

```
OLManager/
├── src/                          # Frontend (React + TypeScript, ~73k LOC)
│   ├── components/               # 36 subdirectorios de componentes UI
│   ├── pages/                    # 11 paginas (Dashboard, MatchSim, etc.)
│   ├── store/                    # Zustand stores (gameStore, settingsStore)
│   ├── services/                 # APIs de comunicacion con backend Tauri
│   ├── hooks/                    # Custom hooks (useAdvanceTime, useUpdater)
│   ├── i18n/                     # 9 idiomas (en, es, fr, de, it, pt, pt-BR, tr)
│   ├── lib/                      # Utilidades de dominio (34 archivos)
│   ├── content/                  # Contenido de juego (LoL)
│   ├── context/                  # React context (ThemeProvider)
│   └── utils/                    # Utilidades generales
│
├── src-tauri/                    # Backend Rust (~64k LOC)
│   ├── src/                      # App principal (~25k LOC)
│   │   ├── commands/             # Handlers de comandos Tauri (21 modulos)
│   │   ├── application/          # Capa de aplicacion (8 modulos)
│   │   ├── lib.rs                # Entry point, registro de comandos
│   │   └── main.rs               # Binario
│   │
│   └── crates/                   # Workspace Rust
│       ├── domain/               # ~3.4k LOC — Modelos de dominio puros
│       ├── engine/               # ~2.6k LOC — Motor de simulacion LoL
│       ├── ofm_core/             # ~24.5k LOC — Logica de juego principal
│       └── db/                   # ~8k LOC — Persistencia SQLite
│
├── data/                         # Datos de competiciones
│   └── competitions/
│       ├── lec/                  # LEC (EU)
│       └── cblol/                # CBLOL (Brazil)
│
└── legacy/                       # Datos legacy migrados
```

### Crates de Rust (Workspace)

1. **`domain`** — Corazon del modelo de dominio. SIN dependencias externas excepto serde. Contiene:
   - `champion.rs`, `champion_stats.rs` — Campeones de LoL
   - `competition.rs` — Competiciones (modelo nuevo)
   - `league.rs` — Ligas (modelo legacy)
   - `player.rs`, `team.rs`, `staff.rs` — Entidades principales
   - `manager.rs`, `message.rs`, `negotiation.rs`, `news.rs`, `social.rs`, `season.rs`

2. **`engine`** — Motor de simulacion de partidas LoL. Independiente de domain.
   - `simulate_lol()` — Simulacion principal
   - `live_match/` — Estado de partida en vivo, roles, comandos
   - `ai.rs`, `event.rs`, `report.rs`, `types.rs`

3. **`ofm_core`** — **Crate principal**. Logica de todas las mecanicas del juego:
   - `game.rs` — Estado global del juego (`Game` struct)
   - `turn/mod.rs` — Avance de tiempo (corazon del game loop)
   - `competition_runner.rs` — Simulacion de competiciones background
   - `competition_adapter.rs` — Adaptador Competition <-> League
   - `competition_registry.rs` — Carga de manifests
   - `calendar.rs` — Generacion de calendarios
   - `calendar_overrides.rs` — Rescheduling manual
   - `academy.rs`, `academy_affiliation.rs` — Sistema de academias
   - `transfers.rs`, `contracts.rs`, `finances.rs` — Economia
   - `training.rs`, `scrim_flow.rs` — Entrenamiento y scrims
   - `live_match_manager.rs` — Gestion de partidas en vivo
   - `narrative/`, `news/`, `messages/` — Narrativa del juego
   - `champions.rs` — Sistema de campeones
   - `generator/` — Generacion de mundos/databases
   - `state.rs` — StateManager para Tauri

4. **`db`** — Capa de persistencia SQLite:
   - `migrations.rs` — 53 migraciones
   - `repositories/` — 17 repositorios (1 por entidad)
   - `save_manager.rs` — Gestion de partidas guardadas
   - `game_database.rs` — Conexion a DB por save

### Frontend Features (73k LOC en 341 archivos TS/TSX)

36 componentes: dashboard, squad, tactics, training, scrims, transfers, scouting, youth academy, staff, finances, match simulation, champions, playoffs, schedule, social, news, world editor, updater, etc.

---

## 3. Proposito del Proyecto

**Open League Manager** es un **simulador/manager de deportes electronicos (e-sports) para League of Legends**, comparable a Football Manager pero para LoL. El jugador asume el rol de **manager/coach de un equipo de LoL** y gestiona:

- **Gestion del equipo**: Formacion, tacticas (LoL tactics con estilos de juego), roles (captain, shotcaller)
- **Jugadores**: Atributos (20+ stats tipo LoL: pace, stamina, vision, mechanics, etc.), contratos, transferencias, prestamos
- **Staff**: Assistant manager, coaches, scouts, physios
- **Entrenamiento y Scrims**: Planificacion semanal de scrims, focus training, champion training
- **Competiciones multiples**: LEC, CBLOL, etc. con temporadas regulares y playoffs
- **Sistema de academias**: Afiliacion con equipos de ERL (European Regional Leagues)
- **Partidos en vivo**: Simulacion 3D/2D con comandos tacticos en tiempo real
- **Economia**: Presupuestos, salarios, sponsorship, financial ledger
- **Narrativa**: Noticias, mensajes del staff, redes sociales, eventos aleatorios
- **Scouting**: Scouts que evaluan jugadores con reportes detallados
- **Campeones LoL**: Sistema de maestria, counter-picks, synergies, parches
- **Carrera del manager**: Historial, reputacion, satisfaccion, ofertas de trabajo

---

## 4. Patrones de Diseno

### Clean Architecture / Hexagonal (en evolucion)

Se ve claramente la intencion de **Arquitectura Hexagonal**:

- **Domain** (`crates/domain`) — Capa mas interna, cero dependencias externas. Define las entidades puras.
- **Application** (`src-tauri/src/application/`) — Casos de uso (live_match, time_advancement, team_talk, lol_sim_v2).
- **Infrastructure** (`crates/db/`) — Persistencia SQLite, repositorios.
- **Framework** (`src-tauri/src/commands/`) — Handlers Tauri, adaptadores de entrada/salida.

### Repository Pattern

`crates/db/src/repositories/` tiene **17 repositorios** (uno por entidad): `player_repo.rs`, `team_repo.rs`, `competition_repo.rs`, etc. Cada uno con `load_all`, `save`, `delete`.

### Adapter Pattern (legado <-> nuevo)

`competition_adapter.rs` es un adaptador explicito para convertir entre el modelo nuevo `Competition` y el legacy `League`. Esto permite la migracion gradual.

```rust
// competition_adapter.rs
pub fn competition_to_league(comp: &Competition) -> Result<League, AdapterError>
pub fn sync_league_to_competition(comp: &mut Competition, league: &League)
pub fn league_to_competition(league: League, ...) -> Competition
```

### State Pattern (gestionado)

`StateManager` en `ofm_core` y `SaveManagerState` en Tauri manejan el estado global del juego. El `Game` struct es el **estado raiz** que se pasa por referencia mutable.

### Command Pattern (Tauri)

Cada accion del jugador es un `#[tauri::command]` en `commands/`. Son 186+ comandos registrados en `lib.rs`.

### JSON Blob Storage para datos complejos

Las competiciones se almacenan como JSON blobs en la tabla `competitions` (V52), mismo patron que `game_meta.game_data` que ya usaba el juego.

### Transicion de Football -> LoL

El proyecto migro de una base de futbol a LoL. Se ve en:
- Migraciones V35-V42: `stadium_name` -> `arena_name`, `football_nation` drop, stats tables renombradas
- `PlayStyle` incluye valores legacy: Attacking, Defensive, Possession, Counter, HighPress, **Balanced**
- Atributos de jugador incluyen `pace`, `shooting`, `tackling` (futbol) y roles `TOP/JUNGLE/MID/ADC/SUPPORT` (LoL)

---

## 5. Estado Actual de Funcionalidades

### Completamente Implementado

- **Inicio de partida**: Seleccion de equipo desde mundos pre-generados, setup inicial
- **Dashboard**: Navegacion por tabs (Home, Inbox, Squad, Tactics, Training, Scrims, Staff, Finances, Transfers, Scouting, Youth Academy, etc.)
- **Sistema de partidos en vivo**: Simulacion con comandos tacticos
- **Entrenamiento**: Grupos de entrenamiento, focus individual, champion training
- **Scrims**: Planificacion semanal, resultados, reports, decisiones post-scrim
- **Transferencias**: Ofertas, counter-offers, negotiation rounds
- **Contratos**: Renovaciones delegadas, expiraciones
- **Staff**: Contratacion, despido, atributos
- **Scouting**: Asignacion de scouts, reportes detallados
- **Sistema economico**: Budgets, financial ledger, sponsorship
- **Sistema de campeones**: Maestria, parches, meta
- **Mensajeria y noticias**: Bandeja de entrada con acciones, generacion procedural de noticias
- **Redes sociales**: Posts, cuentas, templates
- **Academias**: Adquisicion/creacion de equipos academy, afiliacion con ERLs
- **Potencial**: Research de potencial de jugadores
- **Eventos aleatorios**: Narrativa procedural
- **Internacionalizacion**: 9 idiomas
- **Auto-updater**: Tauri updater con GitHub Releases
- **World Editor**: Edicion de mundos/databases
- **Manager career**: Historial, reputacion, ofertas de trabajo de otros equipos

### En Progreso (Rama `multileague-system`)

El **multi-league system** es el feature principal en desarrollo actual:

- **Nuevo modelo `Competition`** en `domain::competition` — abstraccion sobre el legacy `League`
- **`CompetitionRegistry`** — Sistema de manifests JSON para definir competiciones externamente
- **`CompetitionRunner`** — Simulacion automatica de competiciones background (no activas)
- **`CompetitionAdapter`** — Puente entre Competition y League legacy
- **`Calendar`** — Generacion procedural de fixtures (RoundRobin, SingleElimination)
- **`CalendarOverrides`** — Rescheduling manual con tracking de overrides
- **`FixtureRef`** — Referencia cross-competition a fixtures
- **`AcademyAffiliation`** — Asociacion de academias a competiciones especificas
- **V52 migration** — Tabla `competitions` con JSON blob storage
- **Manifests de ejemplo**: LEC y CBLOL con sus seed data
- **UI**: `CompetitionBrowser` (pagina), `TournamentsTab` en dashboard
- **E2E tests** en `ofm_core/tests/multi_league_e2e.rs`

**Detalles tecnicos de lo nuevo**:

| Archivo | Proposito |
|---------|-----------|
| `domain::competition` | Modelo Competition, Phase, Tier, Rules, Runtime |
| `competition_registry.rs` | Carga/validacion de manifests JSON (versionados) |
| `competition_runner.rs` | Procesa fixtures background, usa engine::simulate_lol |
| `competition_adapter.rs` | Competition <-> League (migracion gradual) |
| `calendar.rs` | `generate_calendar()` con RoundRobin y SingleElimination |
| `calendar_overrides.rs` | `reschedule_fixture()` con tracking |
| `fixture_ref.rs` | FixtureRef(competition_id, fixture_id) para routing correcto |
| `academy_affiliation.rs` | `set_academy_competition()` para afiliacion de academias |

### Pendiente / No Implementado

- **Player vs Player online** (hay ramas `online-mvp` y `online-mvp-p2p` pero no mergeadas)
- **Migracion completa del legacy `game.league` a `game.competitions`** — aun coexisten
- **GroupStage** en calendar (`PhaseType::GroupStage` devuelve fixtures vacios)
- **Playoffs reales** en el nuevo sistema (el runner los omite por ahora)

---

## 6. Testing

### Cobertura

| Capa | Archivos | LOC de tests | Framework |
|------|----------|-------------|-----------|
| **Rust unit tests** (inline) | En casi todos los `.rs` | — | `#[cfg(test)]` |
| **Rust integration tests** | 19 archivos en `ofm_core/tests/`, 2 en `engine/tests/`, 1 en `db/tests/` | **11,388 LOC** | Rust test harness |
| **Frontend tests** | 114 archivos `.test.ts/.test.tsx` | **21,377 LOC** | Vitest + Testing Library |
| **Total tests** | ~136 archivos | **~32,765 LOC** | — |

### Analisis de Tests Rust

**`ofm_core/tests/`** (los mas importantes):
- `multi_league_e2e.rs` — E2E del multi-league system (NUEVO)
- `turn_tests.rs` — Ciclo completo de avance de tiempo
- `transfers_tests.rs`, `contracts_tests.rs` — Sistema economico
- `scrim_flow_tests.rs` — Simulacion de scrims
- `training_tests.rs` — Entrenamiento
- `academy_tests.rs` — Sistema de academias
- `live_match_manager_tests.rs` — Partidas en vivo
- `messages_tests.rs` — Sistema de mensajeria
- `narrative_*.rs` — Narrativa procedural
- `player_events_tests.rs`, `random_events_tests.rs` — Eventos
- `end_of_season_tests.rs`, `finances_tests.rs` — Fin de temporada
- `club_tests.rs`, `scouting_tests.rs`

**`engine/tests/`**:
- `simulation_tests.rs` — Tests de simulacion de partidas
- `live_match_tests.rs` — Partidas en vivo

**`db/tests/`**:
- `academy_team_persistence.rs` — Persistencia de academias

**Tests inline**: Practicamente todos los archivos de `domain`, `db/repositories/`, y varios de `ofm_core` tienen tests inline (`#[cfg(test)]`).

### Analisis de Tests Frontend (114 archivos)

- `gameStore.test.ts`, `settingsStore.test.ts` — Stores Zustand
- `Dashboard.test.tsx`, `MainMenu.test.tsx`, `MatchSimulation.test.tsx` — Pages
- `DashboardWorkspaceContent.test.tsx`, `SquadTab.test.tsx` — Componentes
- `helpers.test.ts`, `lolPlayerStats.test.ts`, `scrimContext.test.ts` — Utilidades
- `ChampionDraft.knowledge.test.ts` — Draft de campeones
- `TournamentsTab.test.tsx`, `TeamsListTab.test.tsx` — Tabs del dashboard
- Multiples archivos de test por servicio (`academyService.test.ts`, `transfersService.test.ts`, etc.)

---

## 7. Dependencias Clave

### Tauri 2
- Framework desktop que combina Rust (backend nativo) con WebView (frontend)
- Plugins: opener (links externos), log (logging rotativo), updater (auto-actualizaciones)
- CSP configurado restrictivamente

### SQLite (rusqlite 0.32.1 + bundled)
- **53 migraciones** (V1 -> V52, con saltos por hooks)
- Schema final incluye 20+ tablas: `game_meta`, `managers`, `teams`, `players`, `staff`, `fixtures`, `standings`, `league`, `messages`, `news`, `social_posts`, `competitions`, `champions`, etc.
- Migraciones con sistema de hooks para transformaciones complejas (recreacion de tablas, renombres)
- `ensure_compatible_schema()` para reparar schemas divergentes de branches

### Engine de simulacion (custom)
- `engine` crate: simulador de partidas LoL con stats, roles, eventos
- `engine::simulate_lol()` — funcion principal de simulacion
- `engine::live_match` — estado de partida en vivo, comandos, fases
- Sistema de atributos: 20 stats (pace, stamina, vision, mechanics...)
- `MatchConfig`, `PlayStyle`, `TeamData`, `PlayerData`

### Mecanicas de juego complejas
- Sistema de **scrims**: planificacion semanal, slots, reports, decisiones post-scrim
- Sistema de **training**: grupos, focus individual, champion training targets
- Sistema de **narrativa**: eventos aleatorios, conversaciones de jugadores, noticias procedurales
- Sistema de **potencial**: research de jugadores con ETA y revelacion
- Sistema de **redes sociales**: posts generados proceduralmente con templates y sentimientos

---

## 8. Problemas y Deuda Tecnica

### Criticos

1. **Coexistencia Competition/League sin timeline de migracion**: `game.league` (legacy) y `game.competitions` (nuevo) conviven. El adapter oculta la complejidad pero no hay un plan claro de cuando se eliminara el legacy.

2. **Multi-league sin integracion completa en el game loop**: El `CompetitionRunner` funciona pero el sistema legacy de `game.league` sigue siendo el primario para el matchday del jugador. Los playoffs en el nuevo sistema no estan implementados.

3. **53 migraciones SQLite con hooks complejos**: Migraciones que recrean tablas enteras (V39, V42), con logica condicional para branches divergentes. Esto es fragil y dificil de mantener.

### Significativos

4. **JSON Blob Storage**: Las competiciones se guardan como JSON en una sola columna (`data_json`). Esto imposibilita queries SQL, joins, y cualquier operacion que no sea load-all/save-all. Es practico para prototipado pero no escala.

5. **`LegacyCompatibilityValue` en types.ts**: El frontend usa `[legacyField: string]: LegacyCompatibilityValue` como `any` para compatibilidad durante la migracion. Esto erosiona type safety.

6. **Game state gigante**: El `Game` struct serializa TODO el estado del juego (jugadores, equipos, staff, mensajes, 50+ fields). Carga/guarda monoliticamente. Cualquier cambio menor requiere re-serializar todo.

7. **Acoplamiento ofm_core -> engine -> domain**: `ofm_core` depende de `engine` y `domain`. `engine` tambien tiene tipos duplicados de `domain` (ej: `LolRole` existe en ambos).

### Menores

8. **Player photos como WebP**: Migracion a WebP con fallback a PNG. El sistema de fotos de jugadores es fragil (global onError handler).

9. **Warnings de clippy suprimidos**: `#![allow(clippy::derivable_impls)]` y similares estan trackeados en `#92` pero nunca resueltos.

10. **package.json atrasado**: Las dependencias tienen versiones muy modernas comparadas con un Tauri app tipico (React 19, Vite 8, TS 6).

---

## 9. Flujo de Datos

```
Usuario (UI React)
  |
  v
Tauri IPC invoke("comando", args)
  |
  v
commands/comando.rs  <--- Deserializa args (serde)
  |
  v
application/caso_de_uso.rs  <--- Logica de aplicacion
  |
  v
ofm_core::game::Game  <--- Estado mutable del juego
  |
  |---> engine::simulate_lol()  <--- Simulacion (solo match engine)
  |
  v
db::repositories/*  <--- Persistencia (SQLite)
  |
  v
SQLite .db file  <--- 53 migraciones aplicadas
```

**Flujo detallado del avance de tiempo:**

```
advance_time() [comando Tauri]
  -> time_advancement.rs [aplicacion]
    -> turn::process_day() [ofm_core]
      |-- competition_runner::process_competitions() [competencias background]
      |-- simulate_matchday() [partido del jugador si aplica]
      |-- training::process_training()
      |-- contracts::process_contract_expiries()
      |-- finances::process_weekly_finances()
      |-- player_events::check_player_events()
      |-- random_events::check_random_events()
      |-- scouting::process_scouting()
      |-- transfers::generate_incoming_transfer_offers()
      |-- firing::check_manager_firing()
      |-- job_offers::check_job_offers()
      |-- potential::process_potential_research()
      |-- champions::process_daily_champion_system()
  -> clock.advance_days(1)
  -> season_context::refresh_game_context()
  -> db::save_manager -> SQLite
```

**Flujo del multi-league system:**

```
Game.competitions: Vec<Competition>
  |
  |-- [competition_runner] Para comps background:
  |     build_engine_team() -> engine::simulate_lol() -> aplicar resultados
  |
  |-- [competition_adapter] Para comp activa:
  |     competition_to_league() -> game.league (legacy)
  |     <- sync_league_to_competition()
  |
  |-- [persistencia]
        competition_repo::save_all() -> SQLite (JSON blob)
```

---

## 10. Proximos Pasos Logicos

### Basado en la rama `multileague-system`:

1. **Integrar la competicion activa en el game loop**: Hoy el `CompetitionRunner` omite la competicion activa porque `game.league` la maneja. Hay que migrar el matchday flow para que use `Competition` directamente.

2. **Implementar GroupStage y playoffs en el nuevo sistema**: `PhaseType::GroupStage` devuelve fixtures vacios. Los playoffs funcionan en el legacy pero no en el nuevo modelo.

3. **UI de gestion de competiciones**: La pagina `CompetitionBrowser` ya existe pero es basica. Falta:
   - Vista detallada de fixtures por competicion
   - Standings interactivos
   - Rescheduling desde UI
   - Asociacion de academias a competiciones

4. **Migrar todos los consumidores de `game.league` a `game.competitions`**: El adapter es un puente temporal. Cada referencia a `game.league` en `turn/mod.rs`, `commands/`, etc. debe migrarse.

5. **Agregar mas competiciones**: Los manifests LEC y CBLOL existen. Habria que agregar LCK, LCS, LPL, etc. con sus seed data reales.

6. **Sistema de promocion/relegacion entre competiciones**: Actualmente no existe. Seria el siguiente feature logico.

7. **Finalizar la migracion Football -> LoL**: Remover columnas legacy auditadas (V40), eliminar `LegacyCompatibilityValue` del frontend.

---

## Metricas del Proyecto

| Metrica | Valor |
|---------|-------|
| **Total LOC** | ~170,000 |
| **Rust backend** | ~64,328 LOC (176 archivos) |
| **Frontend TS/TSX** | ~72,685 LOC (341 archivos) |
| **Tests totales** | ~32,765 LOC (136+ archivos) |
| **Crates Rust** | 4 (domain, engine, ofm_core, db) |
| **Comandos Tauri** | 186+ |
| **Migraciones DB** | 53 |
| **Tablas SQLite** | 20+ |
| **Idiomas** | 9 |
| **Git branches activas** | 4 (multileague-system actual) |

---

> **Nota:** Este analisis fue generado automaticamente a partir de una exploracion exhaustiva del codigo fuente. Para actualizaciones, ejecutar nuevamente el analisis sobre la rama deseada.
