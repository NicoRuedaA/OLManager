# Game Creation Flow — Arquitectura

> **Propósito**: Documentar el flujo completo de creación de una nueva partida, desde que el usuario completa el formulario hasta que llega al dashboard con su equipo seleccionado y la partida persistida.

---

## Vista General

La creación de partida ocurre en **2 fases** separadas, cada una con su propio comando Tauri:

```
LeagueSelection.tsx         TeamSelection.tsx               Dashboard
      │                           │                             │
      │  start_new_game           │  select_team                │
      ├──────────────────────────►│  ────────►                  │
      │   (crea manager + mundo)  │  (asigna equipo +           │
      │                           │   guarda partida)           │
      │                           │                             │
      ◄──────── "ok" ────────────►│                             │
      │                           ◄────── Game ───────────────► │
```

---

## Fase 1: `start_new_game`

**Comando**: `src-tauri/src/commands/game.rs` → `start_new_game()`

**Frontend**: `src/pages/LeagueSelection.tsx` → `invoke("start_new_game", { ... })`

```
┌─ start_new_game ─────────────────────────────────────────────────────────────┐
│                                                                              │
│  1. Validación                                                               │
│     ├── Nombre no vacío, ≤ 30 chars                                          │
│     ├── Nickname ≤ 20 chars                                                  │
│     ├── Nacionalidad no vacía                                                │
│     └── DOB válido (YYYY-MM-DD, edad < 99)                                   │
│                                                                              │
│  2. Creación de entidades base                                               │
│     ├── Manager::new(...)          → domain::manager::Manager                │
│     └── GameClock(2025-01-01)      → ofm_core::clock::GameClock              │
│                                                                              │
│  3. World Source (resolución)                                                │
│     ┌────────────────────────────────────────────────────────────────────┐   │
│     │ Dato: competition_id determina el default                          │   │
│     │ "lec"  → world_source = "lec-default"                              │   │
│     │ "cblol" → world_source = "cblol-default"                           │   │
│     └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│     Cada source sigue un camino distinto:                                    │
│                                                                              │
│     a) "lec-default"                                                         │
│        └── load_world_from_split_dir(dir)                                    │
│            ├── Lee databases/teams/   → *_teams.json (agrega todos)          │
│            ├── Lee databases/players/ → *_players.json                       │
│            ├── Lee databases/players/ → free_agents.json                     │
│            ├── Lee databases/staffs/  → *_staffs.json                        │
│            └── Lee databases/staffs/  → free_agents.json                     │
│                                                                              │
│     b) "cblol-default"                                                       │
│        └── load_world_from_json(seed.json)                                   │
│            └── Un solo JSON con teams, players, staff                        │
│                                                                              │
│     c) "random"                                                              │
│        └── generate_world(None)                                              │
│            ├── default_names_definition() / default_teams_definition()       │
│            ├── 16 equipos con stats aleatorias                               │
│            ├── 22 jugadores por equipo (352 total)                           │
│            ├── 4 staff por equipo (AssistantManager, Coach, Scout, Physio)   │
│            └── 12 free agent staff                                           │
│                                                                              │
│     d) Ruta de archivo                                                       │
│        └── load_world_from_json(file)                                        │
│                                                                              │
│  4. Post-procesamiento (siempre, pase lo que pase)                           │
│     ├── apply_seed_potential_defaults()  si ningún player tiene              │
│     │                                     potential_base explícito           │
│     ├── bootstrap_example_academy_pool_from_example()                        │
│     │   └── Crea equipos academy + sus jugadores                             │
│     ├── remove_free_agents_shadowed_by_academy()                             │
│     │   └── Saca free agents que coinciden con jugadores de academy          │
│     ├── inject_seed_free_agents()                                            │
│     │   └── Agrega free agents de semilla                                    │
│     └── apply_default_initial_contract_end()                                 │
│         └── Asigna fin de contrato por defecto                               │
│                                                                              │
│  5. Game::new(clock, manager, teams, players, staff, [])                     │
│     ├── upgrade_game_football_identities()                                   │
│     │   └── Migra identidades football → LoL (country codes, posiciones)     │
│     └── refresh_game_context()                                               │
│         └── Inicializa SeasonContext (split actual, seed, etc.)              │
│                                                                              │
│  6. bootstrap_competition(game, competition_id)                              │
│     └── data/competitions/{id}/manifest.json                                 │
│         ├── phases, scheduling, best_of                                      │
│         └── generate_calendar() → CompetitionRuntime                         │
│                                                                              │
│  7. state.set_game(game)        → memoria (StateManager, Arc<RwLock<Game>>)  │
│     state.set_stats_state(...)  → memoria                                    │
│                                                                              │
│  8. → "ok"                                                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Detalle de World Loading

El split dir se resuelve así (`commands/world.rs`):

```rust
// Orden de búsqueda:
cwd / src-tauri / databases     // desarrollo
cwd / databases                 // debug
resource_dir() / databases      // producción
```

Los JSON de cada subdirectorio tienen esta estructura:

```json
{
  "name": "LEC",
  "description": "...",
  "teams|players|staff": [ ... ]
}
```

---

## Fase 2: `select_team`

**Comando**: `src-tauri/src/commands/game.rs` → `select_team()`

**Frontend**: `src/pages/TeamSelection.tsx` → `invoke("select_team", { teamId })`

```
┌─ select_team ───────────────────────────────────────────────────────────────┐
│                                                                              │
│  1. Obtiene Game desde StateManager (in-memory)                             │
│                                                                              │
│  2. Validaciones                                                             │
│     ├── Team existe                                                          │
│     └── No es academy team                                                   │
│                                                                              │
│  3. Asignación del manager                                                   │
│     ├── manager.hire(team_id)      → actualiza team_id del manager          │
│     └── team.manager_id = mgr.id   → el equipo sabe quién lo maneja         │
│                                                                              │
│  4. Generación del fixture (LEC Winter)                                     │
│     ├── Single round-robin (n-1 fechas)                                      │
│     ├── Superweeks: Sáb/Dom/Lun, +7 días entre semanas                      │
│     ├── Límite: máximo 20 equipos                                            │
│     └── Preseason friendlies contra todos los oponentes (3 días antes)      │
│                                                                              │
│  5. Post-calendario                                                          │
│     ├── bootstrap_champion_state()    → estado inicial de champions          │
│     └── refresh_game_context()        → actualiza SeasonContext              │
│                                                                              │
│  6. Mensajes de bienvenida                                                   │
│     ├── welcome_message()             → "Bienvenido a {team}"               │
│     ├── academy_overview_message()    → info de academy (si aplica)         │
│     ├── season_schedule_message()     → "Temporada LEC Winter arranca..."   │
│     ├── staff_advice_message()        → "Revisá tu staff..."                │
│     └── generate_contract_concern_messages()                                 │
│                                                                              │
│  7. Persistencia (SaveManager)                                               │
│     ├── create_save(&game, "Nico's Career")                                 │
│     │   ├── GameDatabase::open(path)           → SQLite                     │
│     │   ├── canonicalize_game_starting_xi_ids()                             │
│     │   ├── GamePersistenceWriter::write_game()  → tablas SQL               │
│     │   ├── compute_checksum()                                              │
│     │   └── SaveIndexManager.record_new_save()                              │
│     │                                                                       │
│     ├── state.set_save_id(id)                                               │
│     └── state.set_game(game)     → actualizado con calendario y msgs        │
│                                                                              │
│  8. → Game (serializado al frontend)                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Persistencia

### Estructura de archivos

```
%USERPROFILE%/Documents/Open League Manager/
└── databases/                              ← world editor exports
└── {uuid}.db                               ← save files (SQLite)
└── saves_index.json                        ← índice de saves
```

Cada save es un archivo SQLite independiente. El índice (`saves_index.json`) mantiene metadatos:

```json
{
  "version": 1,
  "saves": [{
    "id": "uuid",
    "name": "Nico's Career",
    "manager_name": "Nico",
    "db_filename": "{uuid}.db",
    "checksum": "abc123...",
    "created_at": "2026-05-07T...",
    "last_played_at": "2026-05-07T..."
  }]
}
```

### Componentes de persistencia (`db` crate)

| Componente | Archivo | Rol |
|---|---|---|
| `SaveManager` | `save_manager.rs` | Orquesta CRUD de saves |
| `SaveIndexManager` | `save_index_manager.rs` | Maneja `saves_index.json` |
| `GameDatabase` | `game_database.rs` | Wrapper SQLite (abrir, migrar) |
| `GamePersistenceWriter` | `game_persistence.rs` | Escribe Game → SQLite |
| `GamePersistenceReader` | `game_persistence.rs` | Lee SQLite → Game |

---

## Estructura de Datos del Mundo

### Directorio de datos (`databases/`)

```
src-tauri/databases/
├── teams/
│   ├── lec_teams.json        ← 10 equipos LEC
│   └── cblol_teams.json      ← 10 equipos CBLOL
├── players/
│   ├── lec_players.json      ← jugadores LEC (con team_id)
│   ├── cblol_players.json    ← jugadores CBLOL
│   └── free_agents.json      ← jugadores libres (sin team_id)
└── staffs/
    ├── lec_staffs.json        ← staff LEC
    ├── cblol_staffs.json      ← staff CBLOL
    └── free_agents.json       ← staff libres
```

### Formato de competiciones (`data/competitions/`)

```
data/competitions/
├── lec/manifest.json
│   ├── phases (winter split, spring split, playoffs, etc.)
│   ├── scheduling (rounds, best_of, días de la semana)
│   └── rules (roster size, salary cap, etc.)
└── cblol/manifest.json
```

---

## Estado en Memoria

`StateManager` (`ofm_core::state`) es el singleton que mantiene el estado activo:

```rust
pub struct StateManager {
    game: Arc<RwLock<Option<Game>>>,     // partida activa
    save_id: Arc<RwLock<Option<String>>>, // save ID activo
    stats_state: Arc<RwLock<StatsState>>, // estado de stats
}
```

Flujo:
1. `start_new_game` → escribe `game` en memoria
2. `select_team` → lee `game` de memoria, lo modifica, lo persiste a SQLite, y lo vuelve a escribir en memoria
3. `load_game` → lee de SQLite, escribe en memoria
4. Cualquier comando de gameplay → lee/escribe `game` desde memoria

---

## Diagrama de Componentes

```
Frontend (React + TS)
│
│ invoke("start_new_game")
│ invoke("select_team")
│ invoke("load_game")
│ invoke("save_game")
│
▼
Commands Layer (src-tauri/src/commands/)
├── game.rs       → start_new_game, select_team, load_game, save_game
├── world.rs      → list/export/import world databases
│
▼
ofm_core (crates/ofm_core)
├── generator/    → generate_world, load_world_from_*, export_world_to_json
│   ├── mod.rs
│   ├── generation.rs
│   ├── world_io.rs
│   ├── definitions.rs
│   └── data.rs
├── game.rs       → Game struct, Game::new
├── state.rs      → StateManager
├── clock.rs      → GameClock
├── schedule.rs   → fixture generation
├── champions.rs  → champion state bootstrap
├── messages.rs   → welcome messages
├── identity_upgrade/ → football → LoL migrations
└── season_context.rs → SeasonContext
│
▼
db (crates/db)
├── save_manager.rs       → SaveManager
├── save_index_manager.rs → SaveIndexManager
├── game_database.rs      → GameDatabase (SQLite)
└── game_persistence.rs   → GamePersistenceWriter/Reader
│
▼
domain (crates/domain)
├── staff.rs       → Staff, StaffRole, StaffAttributes
├── player.rs      → Player, PlayerAttributes, Position
├── team.rs        → Team, TeamKind, TeamColors
├── manager.rs     → Manager
├── competition.rs → Competition, CompetitionRules, etc.
└── ...
```

---

## Flujo de Carga (Load Game)

```
load_game(save_id)
├── SaveManager::load_game(save_id)
│   ├── Busca entrada en saves_index.json
│   ├── GameDatabase::open(path)
│   └── GamePersistenceReader::read_game(db) → Game
│
├── remove_free_agents_shadowed_by_academy()
├── inject_seed_free_agents()
├── bootstrap_champion_state()
├── refresh_game_context()
│
└── state.set_game(game) + state.set_save_id(save_id) + state.set_stats_state(...)
```

---

## Observaciones / Puntos de Atención

1. **World Source hardcodeado** → `LeagueSelection.tsx` pasa `worldSource: "lec-default"` fijo. No se usa "random" desde el frontend ni se expone como opción.

2. **Dos fases frágiles** → El game vive en memoria entre `start_new_game` y `select_team`. Si el usuario cierra la app entre fase 1 y 2, pierde la partida. No hay autosave parcial.

3. **Identity Upgrade multi-ejecución** → `upgrade_game_football_identities()` / `upgrade_world_football_identities()` se llama en varios puntos: `Game::new()`, `load_world_from_json()`, `load_world_from_split_dir()`. Es idempotente pero agrega overhead.

4. **SQLite por save** → Cada partida es un archivo `.db` independiente. No hay un schema compartido entre saves. Migraciones se manejan por save.

5. **Competition bootstrap non-fatal** → Si falla `bootstrap_competition()`, el juego arranca sin competiciones (log warning, no error).

6. **Academy teams se crean en post-procesamiento** → No vienen en los JSON de datos, se generan con `bootstrap_example_academy_pool_from_example()`.

7. **Staff Owner** → El enum `StaffRole` incluye `Owner` para poder deserializar staff existente en los JSON que usan ese rol, pero el generador de mundo aleatorio nunca produce owners.
