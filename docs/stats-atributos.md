# Stats / Atributos — Guía completa

## 1. EQUIPO (`Team`)

### Finanzas

| Atributo | Tipo | ¿Qué hace? |
|----------|------|------------|
| `finance` | `i64` | Dinero disponible. Se gasta en adquisiciones de academia, staff, mejoras de instalaciones. Si es negativo → restricciones. |
| `wage_budget` | `i64` | Límite de salarios. Si los jugadores exceden esto, problemas de moral/finanzas. |
| `transfer_budget` | `i64` | Máximo que podés gastar en fichajes. |
| `season_income` / `season_expenses` | `i64` | Acumulador del año. Se usa para calcular balance de temporada. |

### Reputación

| Atributo | Rango | ¿Qué hace? |
|----------|-------|------------|
| `reputation` | `u32` (0+) | Atrae mejores jugadores libres, sponsors más grandes, staff de mayor nivel. A más reputación, más opciones de contratación y mejor valor de mercado. |

### Instalaciones (`Facilities`)

| Atributo | Rango | Efecto |
|----------|-------|--------|
| `main_hub_level` | 0-5 | Núcleo del centro de entrenamiento. Desbloquea módulos. |
| `training` | 0-5 | Velocidad de mejora de atributos en entrenamiento. |
| `medical` | 0-5 | Reduce tiempo de recuperación de lesiones. |
| `scouting` | 0-5 | Calidad y velocidad de informes de scouting. |
| `scrims_room_level` | 0-5 | Calidad de simulaciones en scrims. |
| `analysis_room_level` | 0-5 | Mejora `execution` en partidos. |
| `bootcamp_area_level` | 0-5 | Mejora `coaching` temporal durante bootcamps. |
| `recovery_suite_level` | 0-5 | Multiplica `recovery` del staff. |
| `content_studio_level` | 0-5 | Mejora ingresos por sponsorships/redes. |
| `scouting_lab_level` | 0-5 | Mejora `meta_discovery` del staff. |

### Tácticas (`LolTactics` + `DraftStrategy`)

| Atributo | Efecto |
|----------|--------|
| `draft_strategy` (Balanced/Aggressive/Passive/Scaling/CounterPick) | Modifica la composición del draft de la simulación. Cada estrategia da bonuses a distintas fases (ataque/defensa/mid) en el engine. |
| `lol_tactics.strong_side` (Top/Bot) | Define qué lado de la mapa recibe más recursos. |
| `lol_tactics.jungle_style` | Patrón de ruta del jungla (Enabler/Carry/etc.). |
| `lol_tactics.fight_plan` | Cómo pelea el equipo (FrontToBack/Flank/etc.). |
| `lol_tactics.support_roaming` | Si el support rota o se queda en línea. |

### Entrenamiento

| Atributo | Efecto |
|----------|--------|
| `training_focus` (Scrims/VODReview/IndividualCoaching/etc.) | Determina qué atributos mejoran más rápido en entrenamiento. |
| `training_intensity` (Low/Medium/High) | Velocidad de mejora vs. riesgo de lesiones/burnout. |
| `training_schedule` (Balanced/Intensive/Flexible) | Cuántos días por semana entrena el equipo. |

### Scrims

| Atributo | Efecto |
|----------|--------|
| `scrim_reputation` (0-100) | Calidad de oponentes disponibles para scrims. |
| `scrim_weekly_slots` | Cantidad de scrims por semana. |
| `scrim_weekly_played/wins/losses` | Estadísticas semanales. `scrim_loss_streak` afecta moral. |

---

## 2. JUGADOR (`Player`)

### Atributos principales (0-100) — `PlayerAttributes`

Estos 9 atributos son los que usa el **motor de simulación** (`engine`). Se mapean 1:1 a `PlayerData` en el engine.

```
               PlayerAttributes (domain)          PlayerData (engine)
               ───────────────────────            ─────────────────
               mechanics          ──────────────►  mechanics
               laning             ──────────────►  laning
               teamfighting       ──────────────►  teamfighting
               macro_play         ──────────────►  macro_play
               consistency        ──────────────►  consistency
               shotcalling        ──────────────►  shotcalling
               champion_pool      ──────────────►  champion_pool
               discipline         ──────────────►  discipline
               mental_resilience  ──────────────►  mental_resilience
```

**Overall (media simple):** `(mechanics + laning + teamfighting + macro_play + consistency + shotcalling + champion_pool + discipline + mental_resilience) / 9`

**Effective overall:** `overall * (condition / 100)` — lo que realmente se usa en partido.

| Atributo | Alias (legacy) | ¿Qué representa? |
|----------|---------------|------------------|
| `mechanics` | dribbling, reaction_speed | Habilidad mecánica (clicks precisos, micro) |
| `laning` | shooting | Fase de líneas (CS, trades early) |
| `teamfighting` | teamwork, coordination | Rendimiento en peleas de equipo |
| `macro_play` | vision, interception | Visión de mapa, rotaciones, objetivos |
| `consistency` | decisions, positioning | Regularidad partido a partido |
| `shotcalling` | leadership, aggression | Capacidad de liderazgo y llamadas |
| `champion_pool` | agility | Versatilidad de champions |
| `discipline` | composure, positional_defense | Control de errores, no morir regalado |
| `mental_resilience` | stamina, durability | Resistencia a presión, se mantiene estable en partidos largos |

### Estados dinámicos

| Atributo | Rango | Efecto |
|----------|-------|--------|
| `condition` | 0-100 | Energía del jugador (**se agota durante partidos**, se recupera diario). `effective_overall = overall * (condition/100)`. Si baja de ~40, el jugador rende muy por debajo. |
| `morale` | 0-100 | Moral. Baja si pierde, si está en banca, si hay promesas incumplidas. Afecta rendimiento en partido (multiplicador ~0.95-1.05). |
| `fitness` | 0-100 | Estado físico a largo plazo. Determina qué tan rápido se recupera `condition`. Baja lentamente si se juega mucho sin descanso. |
| `injury` | `Option<Injury>` | Si tiene lesión, `days_remaining` > 0. No puede jugar. |

### Potencial

| Atributo | Efecto |
|----------|--------|
| `potential_base` (0-99) | Techo máximo de `overall()` que puede alcanzar este jugador vía entrenamiento/experiencia. 99 = potencial generacional. |
| `potential_revealed` | Potencial "descubierto" por scouting (progresión). |
| `champion_mastery` | `Vec<PlayerChampionMastery>` — pares `(champion_id, mastery)`. Usado por `bootstrap_seed_masteries()` para inicializar el sistema de champion mastery. |

### Contrato

| Atributo | Efecto |
|----------|--------|
| `wage` (u32) | Salario semanal. Resta del `wage_budget` del equipo. |
| `market_value` (u64) | Valor de mercado estimado. Usado para ofertas de transferencia. |
| `contract_end` | Fecha de fin de contrato. Si se acerca, el jugador puede irse gratis o pedir renovación. |

### Ofertas de transferencia

| Atributo | Efecto |
|----------|--------|
| `transfer_listed` | El jugador está en el mercado. |
| `loan_listed` | El jugador está disponible para cesión. |
| `transfer_offers` | Lista de ofertas recibidas de otros clubes. |

### Imágenes

| Entidad | Campo | Cómo se resuelve |
|---------|-------|------------------|
| **Team** | No tiene campo de imagen. | El frontend resuelve el logo mediante `teamLogoMapping.ts` (mapping por slug del nombre del equipo). |
| **Player** | `profile_image_url: Option<String>` | Campo opcional. Si es `None`, el frontend usa `playerPhotoMapping.ts` por `match_name`. |
| **Staff** | `profile_image_url: Option<String>` | Campo opcional. Si es `None`, el frontend usa `staffPhotoMapping.ts` por nombre. |
| **Academia** | `AcademyMetadata.original_logo_url` / `current_logo_url` | Guardan el logo del equipo academy (puede diferir del main team). |

---

## 3. STAFF (`Staff`)

### Atributos base (`StaffAttributes`) — 0-100

| Atributo | ¿Quién lo usa? |
|----------|---------------|
| `coaching` | `Coach` + `AssistantManager` (promedio del equipo) |
| `judging_ability` | `Scout` (promedio del equipo) |
| `judging_potential` | `Scout` (promedio del equipo) |
| `physiotherapy` | `Physio` (promedio del equipo) |

### Roles (`StaffRole`)

| Rol | Atributo que importa |
|-----|---------------------|
| `AssistantManager` | `coaching` |
| `Coach` | `coaching` |
| `Scout` | `judging_ability` + `judging_potential` |
| `Physio` | `physiotherapy` |
| `Owner` | Ninguno — no afecta gameplay directamente |

### Relación Team ↔ Staff

```
Game
├── staff: Vec<Staff>         ← todos los staff del mundo
│   └── cada Staff tiene team_id → se vincula a un Team
├── teams: Vec<Team>          ← NO tienen lista de staff
│   └── para obtener su staff: filtrar game.staff por team_id
└── players: Vec<Player>
    └── cada Player tiene team_id → mismo patrón
```

**Team no tiene `staff_ids`** ni vector propio. La relación se resuelve dinámicamente filtrando `game.staff.iter().filter(|s| s.team_id == team_id)`. Es el mismo patrón que con los players. Como cada equipo tiene ~4 staff, no es un cuello de botella.

### Outputs del sistema (`LolStaffEffects`)

Los 4 atributos base se transforman en **8 multiplicadores** que afectan distintas áreas del juego:

```
StaffAttributes (input, 0-100)  ──►  LolStaffEffects (output, multipliers)
──────────────────────────────       ────────────────────────────────────
coaching         ──────────────►  coaching_mult  (0.85-1.25)
coaching         ──────────────►  development    (0.88-1.22)
coaching         ──────────────►  tactics         (0.90-1.18)
coaching         ──────────────►  morale          (0.95-1.15)
judging_ability  ──────────────►  analysis        (0.90-1.16)
judging_ability  ───┐
                   ├─► meta_discovery (0.90-1.20)
judging_potential ──┘
physiotherapy    ──────────────►  recovery        (0.95-1.25)
(tactics+analysis)/2 ──────────►  execution       (0.96-1.10)
```

| Output | Rango | ¿Qué afecta? |
|--------|-------|-------------|
| `coaching_mult` | 0.85-1.25 | Rendimiento general del equipo en entrenamiento y partido |
| `development` | 0.88-1.22 | Velocidad de mejora de atributos de los jugadores |
| `tactics` | 0.90-1.18 | Calidad de draft en simulación |
| `analysis` | 0.90-1.16 | Calidad de informes de scouting |
| `recovery` | 0.95-1.25 | Regeneración de `condition` post-partido |
| `morale` | 0.95-1.15 | Estabilidad de `morale` del equipo |
| `meta_discovery` | 0.90-1.20 | Descubrir nuevos metas / champion picks |
| `execution` | 0.96-1.10 | Ejecución de draft en partido |

### Fórmulas derivadas

**Match mastery multiplier:**
`(development * 0.65 + analysis * 0.35).clamp(0.88, 1.18)`
→ Ganancia de mastery en partidos

**Draft power bonus:**
`((tactics - 1.0) * 4.0 + (analysis - 1.0) * 3.0).clamp(-1.0, 3.0)`
→ Bonus de poder de draft en simulación

---

## 4. FLUJO COMPLETO EN PARTIDO

```
Team.facilities ────► staff effects ──► player condition recovery
                                                    
Staff.coaching ─────► coaching_mult ──► player training gain   ← de Coach + AssistantManager
Staff.judging_* ────► analysis ───────► scouting quality       ← de Scout
Staff.physio ───────► recovery ───────► condition regen        ← de Physio
Staff.Owner ────────► (sin efecto directo en simulador)
                                                    
Player.attributes ──► overall ────────► match simulation
Player.condition ───► effective_overall
Player.champion_mastery ──────────────► draft quality
                                                    
Team.lol_tactics ───► draft_strategy ─► match modifiers
Team.draft_strategy ──────────────────► phase bonuses
```

El engine recibe:
- `PlayerData` con los 9 atributos + `condition`
- `TeamData` con `draft_strategy` + jugadores
- `LolStaffEffects` como multiplicadores externos
