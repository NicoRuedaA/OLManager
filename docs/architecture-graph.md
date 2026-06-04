# Multi-League Architecture Graph

> **Last updated:** 2026-05-12
>
> This document describes the **actual runtime architecture** (as implemented) and the **ideal target model** (aspirational). The current system uses `League` (legacy name) which is equivalent to `Competition` in the ideal model.

---

## 1. Estado Actual (Implementado)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                           GAME (runtime state)                              │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Game struct                                  │   │
│  │                                                                      │   │
│  │  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────────────┐ │   │
│  │  │   clock      │  │   manager        │  │  players: Vec<Player>   │ │   │
│  │  │   day_phase  │  │   messages       │  │  ├── team_id: Some(..)  │ │   │
│  │  └──────────────┘  └──────────────────┘  │  └── team_id: None  ← FA│ │   │
│  │                                          ├─────────────────────────┤ │   │
│  │                                          │  staff: Vec<Staff>      │ │   │
│  │                                          │  ├── team_id: Some(..)  │ │   │
│  │                                          │  └── team_id: None  ← FA│ │   │
│  │                                          ├─────────────────────────┤ │   │
│  │                                          │  teams: Vec<Team>       │ │   │
│  │                                          │  └── competition_id     │ │   │
│  │                                          └─────────────────────────┘ │   │
│  │                                                                      │   │
│  │  ┌───────────────────────────────────────────────────────────────┐   │   │
│  │  │           leagues: Vec<League>  ← equivale a Competition     │   │   │
│  │  │           (cada una con fixtures, standings)                  │   │   │
│  │  │                                                               │   │   │
│  │  │  ┌──────────────────────┐  ┌──────────────────────┐           │   │   │
│  │  │  │  League "LEC"        │  │  League "LCS"        │  ...     │   │   │
│  │  │  │  id: "lec"           │  │  id: "lcs"           │          │   │   │
│  │  │  │  season: 2025        │  │  season: 2025        │          │   │   │
│  │  │  │  competition_id      │  │  competition_id      │          │   │   │
│  │  │  │  fixtures[]          │  │  fixtures[]          │          │   │   │
│  │  │  │  standings[]         │  │  standings[]         │          │   │   │
│  │  │  └──────────────────────┘  └──────────────────────┘           │   │   │
│  │  │                                                               │   │   │
│  │  │  // NO tiene players ni staff:                                │   │   │
│  │  │  // se resuelven filtrando game.players / game.staff          │   │   │
│  │  │  // por team_id → team.competition_id                         │   │   │
│  │  └───────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │  ┌───────────────────────────────────────────────────────────────┐   │   │
│  │  │   competition_configs: HashMap<String, ScheduleConfig>        │   │   │
│  │  │   academy_league: Option<League>                              │   │   │
│  │  └───────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
          │                              ▲
          │  commands / tauri            │  turn engine
          ▼                              │
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                        TURN ENGINE (process_day)                            │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  for each league in game.leagues {                                   │   │
│  │    let active = league.id == user_team.competition_id                │   │
│  │                                                                      │   │
│  │    if league has due fixtures today {                                │   │
│  │      if active ──────────► simulate_matchday()  // player prompt     │   │
│  │      if !active ─────────► simulate_background()  // auto-sim        │   │
│  │    }                                                                 │   │
│  │                                                                      │   │
│  │    if season_completed(league) {                                     │   │
│  │      process_end_of_season(league)                                   │   │
│  │      new_season = generate_next_season(competition_configs[league.id])│   │
│  │      // TODO: seasons.push(new_season) for historical tracking       │   │
│  │    }                                                                 │   │
│  │  }                                                                   │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          │ reads/writes league.fixtures, league.standings
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                     FILESYSTEM / PERSISTENCE                                │
│                                                                             │
│  ┌──────────────────────┐    ┌──────────────────────┐                       │
│  │  data/competitions/  │    │  saves/*.db          │                       │
│  │                      │    │                      │                       │
│  │  lec/manifest.json   │    │  competitions table  │                       │
│  │  lcs/manifest.json   │    │  seasons table       │                       │
│  │  lck/manifest.json   │    │  fixtures table      │                       │
│  │  lpl/manifest.json   │    │  standings table     │                       │
│  │  cblol/manifest.json │    │                      │                       │
│  │  lcp/manifest.json   │    └──────────────────────┘                       │
│  │                      │                                                   │
│  │  teams/              │                                                   │
│  │  players/            │                                                   │
│  │  staffs/             │                                                   │
│  └──────────────────────┘                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          │ carga inicial (select_team)
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                       DATA LOADING (select_team)                            │
│                                                                             │
│  scan_competitions() ───► 6 manifests cargados                              │
│       │                                                                     │
│       ├── validate_competition_manifest()  // tier, files, schedule         │
│       │                                                                     │
│       └── for each valid manifest:                                          │
│             ├── League { id, name, season, competition_id }                 │
│             ├── competition_configs[id] = manifest.schedule                 │
│             ├── load_competition_teams()  → game.teams                      │
│             ├── load_competition_players() → game.players                   │
│             ├── load_competition_staff()   → game.staff                     │
│             ├── generate_schedule_from_config() → League.fixtures           │
│             └── game.leagues.push(League)                                   │
│                                                                             │
│  NOTA: players y staff son GLOBALES en game, NO por competición.            │
│        Se vinculan a través de team_id → team.competition_id.               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Modelo Ideal (Aspiracional)

> These types **do not exist yet** in the codebase. `League` is the current equivalent of `Competition`, and fixtures are stored directly on `League` rather than inside `Season`.

### 2.1 Player (Global)

```rust
Player {
  id: String,                          // e.g. "lec-player-98767975961872793"
  match_name: String,                  // "Caps"
  full_name: String,                   // "Rasmus Winther"
  date_of_birth: String,               // "1999-11-17"
  nationality: String,                 // "DK"
  position: LolRole,                   // Top | Jungle | Mid | Adc | Support
  attributes: PlayerAttributes,        // 9 skills (0-100)
  condition: u8,                       // 0-100 (energy)
  morale: u8,                          // 0-100
  fitness: u8,                         // 0-100
  injury: Option<Injury>,
  team_id: Option<String>,             // None = free agent
  contract_end: Option<String>,
  wage: u32,
  market_value: u64,
  // ... (see data-model.md for full fields)
}
```

### 2.2 Staff (Global)

```rust
Staff {
  id: String,                          // e.g. "staff-b45e1420"
  first_name: String,
  last_name: String,
  role: StaffRole,                     // Coach | Scout | Analyst | Physio | Manager
  attributes: StaffAttributes,         // coaching, judging_ability, judging_potential, physiotherapy
  team_id: Option<String>,             // None = free agent
  wage: u32,
  contract_end: Option<String>,
}

// Team NO tiene staff_ids. Se resuelve filtrando game.staff por team_id.
```

### 2.3 Team

```rust
Team {
  id: String,                          // e.g. "lec-fnatic"
  name: String,                        // "Fnatic"
  short_name: String,                  // "FNC"
  country: String,
  city: String,
  competition_id: Option<String>,      // "lec" | "lcs" | etc.
  manager_id: Option<String>,
  reputation: u32,                     // 0-1000
  finance: i64,
  wage_budget: i64,
  transfer_budget: i64,
  facilities: Facilities,
  draft_strategy: DraftStrategy,
  lol_tactics: LolTactics,
  active_lineup_ids: Vec<String>,
  // ... (see data-model.md for full fields)
}

// Team NO tiene players[] ni staff[].
// Se resuelve filtrando game.players / game.staff por team_id.
```

### 2.4 Competition (Ideal) / League (Actual)

```rust
// ASPIRACIONAL — actualmente se llama `League` y no tiene `seasons[]`
Competition {
  id: CompetitionId,                   // "lec"
  name: String,                        // "LEC"
  region: String,                      // "EMEA"
  tier: u8,                            // 1 = top, 2 = regional
  logo: Option<String>,
  teams: Vec<Team>,                    // o solo team_ids: Vec<String>
  schedule_config: ScheduleConfig,
  seasons: Vec<Season>,                // ASPIRACIONAL: historial de temporadas
  // NOTA: NO tiene players ni staff (son globales en Game)
}

// ACTUAL — lo que existe hoy en domain::league::League
League {
  id: String,
  name: String,
  season: u32,                         // solo la temporada actual
  fixtures: Vec<Fixture>,
  standings: Vec<StandingEntry>,
  competition_id: Option<String>,
}
```

### 2.5 Season (Aspiracional)

> **Not implemented.** Currently `League` holds fixtures directly. Historical seasons are not tracked.

```rust
Season {
  id: SeasonId,
  competition_id: String,              // FK a Competition
  season_number: u32,                  // 2025
  // phase: SeasonPhase,              // ASPIRACIONAL: Preseason | Regular | Playoffs | Completed
  fixtures: Vec<Fixture>,
  standings: Vec<StandingEntry>,
}

// SeasonPhase (por implementar):
// enum SeasonPhase { Preseason, Regular, Playoffs, Completed }
```

### 2.6 Fixture

```rust
Fixture {
  id: String,                          // UUID único global
  matchday: u32,
  date: String,                        // "2025-02-15"
  home_team_id: String,
  away_team_id: String,
  match_type: MatchType,               // Regular | Friendly | PreseasonTournament | Playoffs
  best_of: u8,                         // 1 | 3 | 5
  status: FixtureStatus,               // Scheduled | InProgress | Completed
  result: Option<MatchResult>,
  // ASPIRACIONAL:
  // competition_id: CompetitionId,   // FK a la competición padre (implícito hoy via League padre)
}

enum MatchType {
  League,              // Regular season
  Friendly,            // Amistoso / scrim
  PreseasonTournament, // Torneo de pretemporada
  Playoffs,            // Eliminación directa
}
```

> **Note on naming:** The current codebase uses `competition: FixtureCompetition` for what should be `match_type: MatchType`. This will be renamed in a future refactor for clarity.

---

## 3. Decisiones de Diseño Documentadas

### 3.1 ¿Por qué `game.players` y `game.staff` son globales?

| Aspecto | Global (`game.players`) | Por Competición (`Competition.players`) |
|---------|------------------------|----------------------------------------|
| **Memoria** | Un solo Vec (~12k players) | N × Vec (12k × N competiciones) |
| **Free agents** | `team_id: None` — trivial | Necesita referencia a "competición global" o duplicación |
| **Transferencias** | Cambiar `team_id` es atómico | Mover entre competiciones = eliminar + insertar |
| **Historial** | `Player.career[]` tiene season + team_id | Más complejo: necesita snapshot por temporada |
| **Trade-off** | Simple, eficiente | Necesario para seasons históricas con roster congelado |

**Decisión:** Global para MVP. Cuando implementemos seasons históricas, evaluaremos snapshot por temporada o cambio a modelo por-competición.

### 3.2 ¿Por qué `Competition` / `League` NO tiene `players` ni `staff`?

Porque:
1. Duplicaría datos masivamente (12k players × N competiciones)
2. Rompería el single source of truth
3. Los players ya se vinculan indirectamente: `player.team_id → team.competition_id`
4. Para listar "players de la LEC": `game.players.iter().filter(|p| p.team_id.map(|tid| teams.iter().find(|t| t.id == tid).competition_id == "lec"))`

### 3.3 ¿Por qué `Fixture` no necesita `FixtureRef`?

`Fixture.id` ya es un UUID único global. No hay colisiones posibles. Un `FixtureRef = competition_id + fixture.id` sería redundante.

- **Si es para routing** (URLs tipo `/match/lec/550e8400...`): es un concern de presentación, no de dominio. El frontend puede construir la URL sin necesidad de un tipo compuesto en el backend.
- **Si es para queries** ("dame todos los fixtures de la LEC 2025"): usar un `FixtureQuery` struct en vez de un identificador compuesto.

---

## 4. Mapeo: Actual → Ideal

| Concepto (Ideal) | Implementación Actual | Diferencias |
|------------------|----------------------|-------------|
| `Competition` | `League` | `League` no tiene `region`, `tier`, `logo`, `teams[]`, `seasons[]` |
| `Season` | `League.season: u32` + `League.fixtures` | La season actual está aplanada en `League`; no hay historial |
| `Fixture.match_type` | `Fixture.competition: FixtureCompetition` | Nombre confuso; el campo indica el **tipo** de partido, no la competición |
| `CompetitionId` newtype | `String` | Falta type safety; todos los IDs son String crudos |
| `SeasonPhase` enum | **No existe** | Solo se infiere del estado de los fixtures |

---

## 5. Cambios Pendientes (Roadmap)

### Phase 1: Renombrar `Fixture.competition` → `Fixture.match_type`
- **Razón:** El nombre actual es confuso porque `competition` ya es una entidad (`Competition`/`League`).
- **Impacto:** Buscar todas las referencias a `fixture.competition` en Rust y frontend.
- **Backward compat:** Usar `#[serde(alias = "competition")]` en el nuevo campo.

### Phase 2: Extraer `Season` como entidad separada
- **Razón:** Permitir múltiples seasons por competición (historial).
- **Impacto:** Cambiar `League { season, fixtures, standings }` → `League { seasons: Vec<Season> }`.
- **Nota:** Breaks save format. Requiere migración o versionado.

### Phase 3: Implementar `SeasonPhase`
- **Razón:** Modelar explícitamente las fases de una temporada.
- **Valores:** `Preseason`, `Regular`, `Playoffs`, `Completed`.
- **Impacto:** El turn engine consultaría `season.phase` en vez de inferirlo de los fixtures.

### Phase 4: Convertir IDs a newtypes
- **Razón:** Type safety en compilación (`CompetitionId`, `SeasonId`, `FixtureId`).
- **Impacto:** Refactor masivo pero mecánico. Mejora errores en compile-time.

---

*Documento mantenido por el equipo de arquitectura. Para cambios, abrir un PR con justificación técnica.*
