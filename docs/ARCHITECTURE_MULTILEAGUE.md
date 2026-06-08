# Multi-League Architecture

## Domain Model

```
Competition                    Season                          FixtureRef
 ┌─────────────────────┐       ┌──────────────────────┐       ┌──────────────────────┐
 │ id: CompetitionId   │──┐    │ id: SeasonId         │       │ competition_id: Str  │
 │ name: String        │  │    │ competition_id: Str  │◄──────│ fixture_id: String   │
 │ region: String      │  │    │ season_number: u32   │       └──────────────────────┘
 │ tier: u8            │  │    │ fixtures: Vec<Fixture>│              ▲
 │ schedule_config:    │  │    │ standings: Vec<Entry> │              │
 │   ScheduleConfig    │  │    │ phase: SeasonPhase    │       usada por commands
 │ teams: Vec<Team>    │  │    └──────────────────────┘       para routing resultados
 │ players: Vec<Player>│  │              ▲                           
 │ staff: Vec<Staff>   │  │              │                           
 └─────────────────────┘  │    pertenece a una                      
         ▲                │    Competition                           
         │                │                                           
    contiene              │                                           
    muchas seasons        │                                           
                          │                                           
                    ┌─────┘                                           
                    │                                                  
              ┌─────┴──────────────────────────────────────────────────┐
              │                   Game                                │
              ├───────────────────────────────────────────────────────┤
              │ competitions: Vec<Competition>    // fuente de verdad  │
              │ competition_configs: HashMap     // ScheduleConfig     │
              │ academy_league: Option<League>   // legacy adapter     │
              │ clock, manager, teams, players...                      │
              └────────────────────────────────────────────────────────┘
```

## Contraste con lo que tenemos hoy

```
HOY (simplificado, funcional)              IDEAL (separación de concerns)
─────────────────────────────              ────────────────────────────────

Game                                      Game
 ├── leagues: Vec<League>                  ├── competitions: Vec<Competition>
 │    ┌──────────────────────┐             │    ┌──────────────────────────┐
 │    │ id: "lec"            │             │    │ id: 1                    │
 │    │ name: "LEC"          │             │    │ name: "LEC"              │
 │    │ season: 2025         │             │    │ teams/players/staff      │
 │    │ fixtures: [...]      │             │    │ seasons:                 │
 │    │ standings: [...]     │             │    │  ┌──────────────────┐    │
 │    └──────────────────────┘             │    │  │ season: 2025     │    │
 │    ┌──────────────────────┐             │    │  │ fixtures: [...]  │    │
 │    │ id: "lcs"            │             │    │  │ standings: [...] │    │
 │    │ name: "LCS"          │             │    │  └──────────────────┘    │
 │    │ season: 2025         │             │    └──────────────────────────┘
 │    │ fixtures: [...]      │             │
 │    │ standings: [...]     │             │    Cada Competition tiene SU
 │    └──────────────────────┘             │    historial de seasons.
 │                                         │    Al avanzar de año, se
 │ → Al avanzar de año, se                │    agrega una Season nueva,
 │   REEMPLAZA la league entera.           │    no se reemplaza.
 │   Se pierde la temporada anterior.      │
 │                                         │
 ├── competition_configs: HashMap          ├── competition_configs: HashMap
 │   (ScheduleConfig por competencia)      │   (misma idea, ya implementado)
 │                                         │
 └─────────────────────────────────────────┴──────────────────────────────────┘
```

## Ciclo de vida de una temporada

```
COMPETITION CREADA
  │
  ├── select_team()
  │     │
  │     ├── Se crea Competition desde manifest.json
  │     ├── Se genera Season 2025 via generate_schedule_from_config()
  │     └── Season 2025 se agrega a Competition.seasons
  │
  ├── process_day() — avanza el tiempo
  │     │
  │     ├── Season.fixtures se simulan (activa con prompt, bg automáticas)
  │     ├── Season.standings se actualizan
  │     └── Season.phase puede cambiar (Regular → Playoffs)
  │
  ├── end_of_season()
  │     │
  │     ├── Season actual se marca como completa
  │     ├── Se genera Season 2026 con nuevo schedule
  │     └── Season 2026 se pushea a Competition.seasons
  │
  └── save/load
        │
        ├── Se persisten todas las Competition con todas sus Seasons
        └── No se pierde histórico (ideal)
```

## Flujo de datos: de manifest a runtime

```
data/competitions/lec/manifest.json
  │
  ▼
CompetitionManifest (deserializado)
  │
  ├── id, name, region, tier → Competition.id, .name, .region, .tier
  ├── schedule              → Competition.schedule_config
  ├── teams_file            → Competition.teams (cargado del archivo)
  ├── players_file          → Competition.players (cargado del archivo)
  │
  ▼
Competition creada en memoria
  │
  ▼
generate_schedule_from_config(competition.schedule_config)
  │
  ▼
Season { season_number: 2025, fixtures: [...], standings: [...] }
  │
  ▼
Competition.seasons.push(Season)
  │
  ▼
game.competitions = [...]
```

## Relación con los otros issues

```
#164 Domain Model ──→ Define Competition, Season, FixtureRef
                        │
                        ▼
#167 Schema SQL     ──→ CREATE TABLE competitions, seasons, fixtures
                        │
                        ▼
#168 Repository     ──→ competition_repo.rs (save/load)
                        │
                        ▼
#170 FixtureRef     ──→ Result routing por competition_id + fixture_id
                        │
                        ▼
#172 Overrides      ──→ ManualOverride { fixture_ref, new_date }
                        │
                        ▼
#177 Frontend Browser ─→ UI que muestra Competition.seasons.history
```

## Lo que implementaríamos (si hacemos #164)

```
olm_core/src/domain/
  ├── competition.rs    // Competition, CompetitionId, SeasonId
  ├── league.rs         // Se mantiene como está (Fixture, StandingEntry, etc.)
  └── ...
```

```rust
// competition.rs — contenido propuesto

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompetitionId(uuid::Uuid);

impl CompetitionId {
    pub fn new() -> Self { Self(uuid::Uuid::new_v4()) }
    pub fn from_string(s: &str) -> Self { /* parse */ }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeasonId(uuid::Uuid);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SeasonPhase {
    Preseason,
    Regular,
    Playoffs,
    Completed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Competition {
    pub id: CompetitionId,
    pub name: String,
    pub region: String,
    pub tier: u8,
    pub seasons: Vec<Season>,
    pub teams: Vec<domain::team::Team>,      // cached
    pub players: Vec<domain::player::Player>, // cached
    pub staff: Vec<domain::staff::Staff>,     // cached
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Season {
    pub id: SeasonId,
    pub competition_id: CompetitionId,
    pub season_number: u32,
    pub phase: SeasonPhase,
    pub fixtures: Vec<domain::league::Fixture>,
    pub standings: Vec<domain::league::StandingEntry>,
}
```
