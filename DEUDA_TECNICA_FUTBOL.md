# Análisis Exhaustivo: Deuda Técnica de Fútbol en OLManager

**Fecha:** 08-MAY-2026  
**Proyecto:** OLManager (Open League Manager)  
**Contexto:** Migración incompleta desde OpenFootManager (fútbol) a OLManager (League of Legends esports)  
**Método:** Búsqueda exhaustiva con grep en todo el codebase (347 archivos TS + 189 archivos Rust + i18n + scripts + datos + migraciones SQL)  

---

## Resumen Ejecutivo

Se encontraron **53 issues distintos** de deuda técnica relacionados con fútbol distribuidos en todo el codebase. La migración está **parcialmente completa**: la capa visible (UI principal, enums de roles, comandos Tauri) está migrada, pero hay **capas profundas** (domain model, datos serializados, SQL migrations, scripts de seed, assets públicos, i18n keys, test data) que aún arrastran terminología de fútbol.

| Categoría | Cantidad | Impacto |
|-----------|----------|---------|
| **Crítico (🔴)** | 14 | Afecta producción, datos activos, o comportamiento actual |
| **Medio (🟡)** | 22 | Debe migrarse, no afecta funcionalidad crítica inmediata |
| **Bajo (🟢)** | 17 | Cosméticos, documentación, naming legacy |
| **Total** | **53** | — |

**Archivos más afectados:**
- `src-tauri/crates/domain/src/team.rs` — 4 issues críticos
- `src-tauri/crates/domain/src/stats.rs` — enum Position con 16 variantes de fútbol
- `src-tauri/crates/domain/src/player.rs` — Footedness, clean_sheets, goals
- `src/components/squad/SquadTab.helpers.ts` — TODO el archivo es fútbol
- `src/store/types.ts` — CompactTeamMatchStatsData con shots/fouls/corners/cards
- `src-tauri/databases/lec_world.json` — Seed data activo con stadium_name, formation: "4-4-2", play_style
- `src-tauri/crates/db/src/save_manager.rs` — Test data con alineaciones de 11 jugadores de fútbol

---

## 🔴 Crítico — Afecta producción, datos activos o comportamiento actual

### C1. Enum `Position` con 16 variantes de fútbol
- **Archivo:** `src-tauri/crates/domain/src/stats.rs:79-98`
- **Hallazgo:** El enum `Position` todavía tiene 16 variantes de fútbol: `Goalkeeper`, `RightBack`, `CenterBack`, `LeftBack`, `RightWingBack`, `LeftWingBack`, `DefensiveMidfielder`, `Midfielder`, `CentralMidfielder`, `AttackingMidfielder`, `RightMidfielder`, `LeftMidfielder`, `Forward`, `RightWinger`, `LeftWinger`, `Striker`, `Defender`.
- **Impacto:** Se usa activamente en `to_group_position()`, `From<Position> for LolRole`, `From<LolRole> for Position`, y en deserialización legacy.
- **Recomendación:** Deprecar completamente para lógica nueva. Debe mantenerse solo para deserialización legacy de saves viejos. Toda la lógica de negocio debe usar `LolRole`.

### C2. `play_style: PlayStyle` en Team — pendiente de migrar a `draft_strategy`
- **Archivo:** `src-tauri/crates/domain/src/team.rs:46`
- **Hallazgo:** El campo `play_style` (tipo `PlayStyle` con variantes `Balanced`, `Attacking`, `Defensive`, `Possession`, `Counter`, `HighPress`) sigue siendo fútbol.
- **Impacto:** 268+ referencias en el backend (engine, turns, save_manager, integration tests) y 78+ referencias en frontend (ChampionDraft, MatchLive, HalfTimeBreak, test data en TODOS los tests de componentes).
- **Recomendación:** Migrar a `draft_strategy: DraftStrategy`. Ya existe propuesta `51-draft-strategy` con design y specs listos.

### C3. `stadium_name` / `stadium_capacity` en Domain
- **Archivo:** `src-tauri/crates/domain/src/team.rs:14-15`
- **Hallazgo:** El struct `Team` del domain todavía usa `stadium_name: String` y `stadium_capacity: u32`.
- **Impacto:** Las migraciones SQL V35/V36 ya renombraron las columnas en la base de datos a `arena_name` / `arena_capacity`, pero los tipos del domain no se actualizaron.
- **Recomendación:** Renombrar a `arena_name` / `arena_capacity` con `#[serde(alias = "stadium_name")]` para compatibilidad con saves existentes.

### C4. `formation: String` en Team — artefacto de fútbol
- **Archivo:** `src-tauri/crates/domain/src/team.rs:45`
- **Hallazgo:** `formation: String` con valores como `"4-4-2"`, `"4-3-3"`, etc.
- **Impacto:** 154+ referencias en frontend (test data, `SquadTab.helpers.ts`, `parseFormationSlots`, `buildPitchRows`), 58+ en backend. Todo el sistema de "formación" es un modelo de fútbol que no tiene sentido en LoL (5 roles fijos).
- **Recomendación:** Reemplazar con `composition: LolComposition` o similar, con lógica de 5 roles fijos. Requiere migración V43.

### C5. Enum `Footedness` y campo `footedness`
- **Archivo:** `src-tauri/crates/domain/src/player.rs:96-106`
- **Hallazgo:** `pub enum Footedness { Left, Right, Both }` con comentario "Footedness is deprecated — LoL roles are lane-agnostic".
- **Impacto:** 41 referencias activas (save_manager, player_repo, legacy_migration crean jugadores con footedness). El campo se serializa/deserializa.
- **Recomendación:** Marcar `#[deprecated]` y dejar de poblarlo en nuevo código. Remover de `save_manager.rs` y `legacy_migration.rs`.

### C6. `clean_sheets: u32` en PlayerSeasonStats
- **Archivo:** `src-tauri/crates/domain/src/player.rs:329`
- **Hallazgo:** `clean_sheets` es un concepto de fútbol (partidos sin recibir goles). En LoL no tiene sentido directo.
- **Impacto:** Se usa en `season_awards.rs` ("Clean Sheet King"), `post_match.rs` (incrementa), y tests.
- **Recomendación:** Reemplazar con métrica LoL apropiada (ej. `games_with_zero_deaths`, `kda_threshold`) o eliminar.

### C7. `goals: u32` en CareerEntry
- **Archivo:** `src-tauri/crates/domain/src/player.rs:348`
- **Hallazgo:** `pub goals: u32` en `CareerEntry` — término de fútbol. Debería ser `kills`.
- **Recomendación:** Renombrar a `kills` con alias serde para compatibilidad.

### C8. `home_goals` / `away_goals` en message & news domain
- **Archivo:** `src-tauri/crates/domain/src/message.rs:194-195` y `src-tauri/crates/domain/src/news.rs:57-58`
- **Hallazgo:** `pub home_goals: u8, pub away_goals: u8` en `NewsMatchScore` y `MessageContext`.
- **Recomendación:** Renombrar a `home_wins` / `away_wins` o `home_kills` / `away_kills` (ya existen en `MatchResult` pero los tipos de mensajes/news usan goals).

### C9. Método `goal_difference()` en StandingEntry
- **Archivo:** `src-tauri/crates/domain/src/league.rs:148`
- **Hallazgo:** Método llamado `goal_difference()` (fútbol) pero calcula `kills_for - kills_against`.
- **Recomendación:** Renombrar a `kill_difference()` o `map_difference()`.

### C10. `drawn: u32` en StandingEntry
- **Archivo:** `src-tauri/crates/domain/src/league.rs:127`
- **Hallazgo:** `pub drawn: u32` (concepto de fútbol — empates). En LoL best-of series no hay empates.
- **Impacto:** También en `CompactTeamMatchStats` donde NUNCA se usa en LoL (siempre 0).
- **Recomendación:** Deprecar y eliminar. En LoL Bo3/Bo5 no hay empates.

### C11. `CompactTeamMatchStatsData` con stats de fútbol
- **Archivo:** `src/store/types.ts:617-625`
- **Hallazgo:** El frontend TypeScript tiene un tipo `CompactTeamMatchStatsData` completamente de fútbol: `shots`, `shots_on_target`, `fouls`, `corners`, `yellow_cards`, `red_cards`.
- **Impacto:** Se usa en `CompactMatchReportData`, `MatchResult`, y componentes de match.
- **Recomendación:** Reemplazar con stats LoL (`kills`, `deaths`, `gold_earned`, `damage_dealt`, `objectives`).

### C12. `WorldEditorTab.tsx` genera `football_nation` y `position: "Midfielder"`
- **Archivo:** `src/components/worldEditor/WorldEditorTab.tsx:192-195`
- **Hallazgo:** `createNewPlayer()` produce `football_nation: "KR"` y `position: "Midfielder"`. La UI también tiene campo "Nación competitiva" ligado a `football_nation`.
- **Recomendación:** Eliminar `football_nation` del editor. Usar `LolRole` en vez de `Midfielder`.

### C13. `CORE_POSITIONS` y `CANONICAL_POSITION_MAP` de fútbol
- **Archivo:** `src/components/squad/SquadTab.helpers.ts:42-87`
- **Hallazgo:** `CORE_POSITIONS = ["Goalkeeper", "Defender", "Midfielder", "Forward"]` y `CANONICAL_POSITION_MAP` mapea 25+ abreviaturas de fútbol (gk, rb, cb, lb, dm, cm, am, rm, lm, rw, lw, st, etc.) a posiciones de fútbol.
- **Impacto:** `buildPitchRows()` genera completamente en términos de fútbol (GK, DEF, DM, AM, FWD labels, Goalkeeper positions, defenderLine/midfieldLine/forwardLine helpers).
- **Recomendación:** Reemplazar todo el sistema con visualización de roles LoL (Top, Jungle, Mid, ADC, Support).

### C14. `buildPitchRows()` en SquadTab.helpers
- **Archivo:** `src/components/squad/SquadTab.helpers.ts:275`
- **Hallazgo:** `buildPitchRows()` — "pitch" es cancha de fútbol.
- **Recomendación:** Renombrar a `buildRiftRows()` o `buildLaneRows()` y reescribir la lógica para roles LoL.

---

## 🟡 Medio — Debe migrarse, no afecta funcionalidad crítica inmediata

### M1. `lec_world.json` seed data usa `stadium_name`, `formation`, `play_style`
- **Archivo:** `src-tauri/databases/lec_world.json`
- **Hallazgo:** 36 equipos LEC con `"stadium_name": "... Arena"`, `"formation": "4-4-2"`, `"play_style": "Balanced"`.
- **Impacto:** Es el seed activo del juego. Todos los nuevos saves heredan estos valores.
- **Recomendación:** Cambiar a `arena_name`, eliminar `formation`, cambiar `play_style` → `draft_strategy`.

### M2. Android gen `lec_world.json` con `football_nation`
- **Archivo:** `src-tauri/gen/android/app/src/main/assets/databases/lec_world.json`
- **Hallazgo:** Este JSON tiene `football_nation` en CADA equipo (todavía no migrado) + `stadium_name`.
- **Impacto:** Es build output de Android. Contiene datos legacy activos.
- **Recomendación:** Regenerar desde el seed source sin football_nation.

### M3. `generate-lec-world.mjs` genera `football_nation`
- **Archivo:** `scripts/generate-lec-world.mjs:26,236,299,372,393`
- **Hallazgo:** Usa `footballNation` en team definitions y `football_nation` en output JSON.
- **Recomendación:** Eliminar. Usar `nationality_code` / `competitive_region`.

### M4. `be.source.footballHerald` i18n key
- **Archivo:** `src-tauri/crates/ofm_core/src/news/match_report.rs:169`
- **Hallazgo:** `"be.source.footballHerald"` se usa como source key para artículos de match report. En locales: `"footballHerald": "LoL Esports"` o `"The Rift Herald"`.
- **Impacto:** El nombre del key expone fútbol en el sistema de i18n.
- **Recomendación:** Renombrar a `be.source.lolesports` o `be.source.riftHerald`.

### M5. `footballTermGuard.test.ts`
- **Archivo:** `src/i18n/locales/footballTermGuard.test.ts`
- **Hallazgo:** El test de football term guard tiene allowlists con términos como "lineup", "Starting Five", "Rift". El nombre del archivo y el concepto sigue siendo fútbol.
- **Recomendación:** Renombrar a `localeTermGuard.test.ts`.

### M6. `FOOTBALL_IDENTITIES` en countries.ts
- **Archivo:** `src/lib/countries.ts:27-102`
- **Hallazgo:** `interface FootballIdentityDefinition` y `const FOOTBALL_IDENTITIES` con códigos UK (ENG, SCO, WAL, NIR).
- **Impacto:** Necesario para backward compat con saves legacy, pero el naming es fútbol.
- **Recomendación:** Renombrar a `LEGACY_NATIONAL_IDENTITIES` o similar.

### M7. `openfootlogo.svg` y `openfootball.svg` en public/
- **Archivos:** `public/openfootlogo.svg`, `public/openfootball.svg`
- **Hallazgo:** Assets con branding "OpenFoot" (OpenFootManager). El logo SVG tiene `id="openfoot"`.
- **Impacto:** El MainMenu.tsx referencia `/openfootlogo.svg` (línea 381).
- **Recomendación:** Reemplazar con logo OLManager.

### M8. Tests con nombres de fútbol
- **Múltiples archivos**
- **Hallazgo:** Tests con nombres como `upgrade_game_football_identities`, `upgrade_world_football_identities`, `active_lec_world_seed_does_not_contain_football_nation`, `export_world_to_json_writes_canonical_football_identity_fields`, `test_load_game_upgrades_football_identity_fields`.
- **Recomendación:** Renombrar tests a `upgrade_game_identities`, etc.

### M9. Funciones `defender_line`, `midfield_line`, `forward_line`
- **Archivo:** `src-tauri/crates/ofm_core/src/player_rating.rs:34-65`
- **Hallazgo:** Funciones con nombres de fútbol que convierten counts a `Vec<LolRole>`.
- **Recomendación:** Renombrar a `top_line`, `jungle_line`, `bot_line` o eliminar (son dead code ya que `formation_slots` ignora formation).

### M10. `narrative_news.rs` test con "football"
- **Archivo:** `src-tauri/crates/ofm_core/tests/narrative_news.rs:12`
- **Hallazgo:** El test usa `"football"` como forbidden term detector — correcto pero indicativo de que aún hay términos de fútbol en el sistema.
- **Recomendación:** Actualizar test para reflejar estado actual post-migración.

### M11. `"be.source.footballHerald"` en locales
- **Archivos:** `src/i18n/locales/*.json`
- **Hallazgo:** En TODOS los locales: `en.json:2349`, `es.json:2354`, `fr.json:2308`, `de.json:2300`, `it.json:1652`, `pt.json:2256`, `pt-BR.json:2308`, `tr.json:2233`.
- **Recomendación:** Renombrar key a `be.source.lolEsports`.

### M12. `pitchInteractionHint` i18n key
- **Archivos:** `src/i18n/locales/*.json`
- **Hallazgo:** En TODOS los locales. El texto ya habla de "Rift" en lugar de "pitch", pero el nombre del key es `pitchInteractionHint`.
- **Recomendación:** Renombrar key a `riftInteractionHint`.

### M13. `yellow_cards` / `red_cards` en frontend types
- **Archivo:** `src/store/types.ts:623-624`
- **Hallazgo:** `CompactTeamMatchStatsData` tiene `yellow_cards: number; red_cards: number`.
- **Recomendación:** Eliminar (no existen en LoL).

### M14. `goals_for` / `goals_against` legacy aliases en StandingData
- **Archivo:** `src/store/types.ts:642-645`
- **Hallazgo:** Deprecados con `@deprecated` pero todavía referenciados en `getStandingKillsFor`/`getStandingKillsAgainst`.
- **Recomendación:** Una vez migrados todos los fixtures, eliminar los campos deprecated.

### M15. `draws?: number` en ManagerCareerStats
- **Archivo:** `src/store/types.ts:566,579`
- **Hallazgo:** `draws` término de fútbol. En LoL no hay empates.
- **Recomendación:** Eliminar o deprecar.

### M16. `fixture` / `fixture_id` naming en frontend
- **Archivo:** `src/store/types.ts` y `src/lib/fixtures.ts`
- **Hallazgo:** 528+ referencias a "fixture". Si bien "fixture" no es exclusivo de fútbol, el sistema completo de fixtures (home_team_id, away_team_id, status, etc.) es un modelo de fútbol.
- **Recomendación:** Evaluar si migrar a `series` (más apropiado para LoL Bo3/Bo5).

### M17. `v001_initial_schema.sql` con stadium_name, stadium_capacity, formation, play_style
- **Archivo:** `src-tauri/crates/db/src/sql/v001_initial_schema.sql:34-35,43-44`
- **Hallazgo:** Schema inicial tiene `stadium_name`, `stadium_capacity`, `formation TEXT NOT NULL DEFAULT '4-4-2'`, `play_style TEXT NOT NULL DEFAULT 'Balanced'`.
- **Nota:** Es el schema inicial, no se puede modificar porque rompería migraciones. Deuda conocida histórica.
- **Recomendación:** Dejar como está por compatibilidad de migraciones. Documentar como deuda conocida.

### M18. `v015_match_stats_history.sql` con columnas de fútbol
- **Archivo:** `src-tauri/crates/db/src/sql/v015_match_stats_history.sql`
- **Hallazgo:** La tabla `player_match_stats` (deprecated, renombrada en V37 a `_deprecated_player_match_stats`) tenía columnas de fútbol.
- **Nota:** Ya está deprecated, pero el SQL de migración existe.
- **Recomendación:** Aceptar como deuda histórica, no tocar.

### M19. `v014_football_identity.sql` como migration
- **Archivo:** `src-tauri/crates/db/src/sql/v014_football_identity.sql`
- **Hallazgo:** Migration V14 que agrega `football_nation` a todas las tablas.
- **Recomendación:** No tocar (migración histórica). V39 ya la revierte.

### M20. `v006_team_match_roles.sql` con `penalty_taker`, `corner_taker`
- **Archivo:** `src-tauri/crates/db/src/sql/v006_team_match_roles.sql:2`
- **Hallazgo:** Columna JSON con roles de fútbol: `penalty_taker`, `free_kick_taker`, `corner_taker`.
- **Recomendación:** No tocar (migración histórica). Documentar como deuda.

### M21. `openfootlogo.svg` en MainMenu test
- **Archivo:** `src/pages/MainMenu.test.tsx:381`
- **Hallazgo:** Test espera `src="/openfootlogo.svg"`.
- **Recomendación:** Actualizar test cuando se reemplace el logo.

### M22. `MatchResult` con index signature legacy
- **Archivo:** `src/store/types.ts:596-607`
- **Hallazgo:** `MatchResult` tiene index signature para compatibilidad legacy con campos de fútbol (home_goals, away_goals, etc.).
- **Recomendación:** Una vez migrados todos los consumidores, eliminar.

---

## 🟢 Bajo — Cosméticos, documentación, naming legacy

### L1. Comentarios "football" en código Rust
- **Múltiples archivos**
- `src-tauri/crates/ofm_core/src/player_rating.rs:155` — `"In LoL, there's no left/right distinction like football"`
- `src-tauri/crates/ofm_core/src/live_match_manager/team_builder.rs:41` — `"NOTE: For LoL/live prototype we should not apply football injury filtering"`
- `src-tauri/crates/db/src/save_manager.rs:432` — `"In LoL, there's no strict left/right position pairing like in football."`
- `src-tauri/crates/db/src/repositories/player_repo.rs:88` — `"// Handles UPPERCASE (new serde), PascalCase (Debug, legacy write), AND legacy football"`
- `src-tauri/src/commands/squad.rs:499` — `"// In LoL, filter out Support role (the \\"goalkeeper\\" equivalent)"`
- `src-tauri/crates/engine/tests/simulation_tests.rs:19-20` — `"/// Map football Position to LoL role for test data"`
- `src-tauri/crates/engine/tests/live_match_tests.rs:13-14` — `"/// Map football Position to LoL role for test data"`
- **Recomendación:** Actualizar comentarios a terminología LoL.

### L2. `CHANGELOG.md` referencias a migración de fútbol
- **Archivo:** `CHANGELOG.md:23-94`
- **Hallazgo:** Menciona la migración desde fútbol.
- **Recomendación:** Es histórico, no tocar.

### L3. `pr_body.txt` con referencias a football nation
- **Archivo:** `pr_body.txt:9`
- **Recomendación:** No tocar (documento histórico de PR).

### L4. `docs/legacy/` — documentación heredada de fútbol
- `docs/legacy/simulation.rst` — "Simulating a football/soccer match"
- `docs/legacy/inherited-docs/GETTING_STARTED.md` — guía de fútbol
- `docs/legacy/inherited-docs/DEFINITIONS.md` — definiciones con football_nation
- `docs/legacy/inherited-docs/MATCH_SIMULATION.md` — descripción de simulación de fútbol
- `docs/legacy/inherited-docs/SAVE_SYSTEM_DESIGN.md` — schema con football_nation
- **Recomendación:** Ya están en `docs/legacy/`, es intencional. No tocar.

### L5. Propuestas de migración en `docs/proposals/`
- `docs/proposals/FOOTBALL_NATION_REMOVAL.md`
- `docs/proposals/FOOTBALL_REMNANTS.md`
- `docs/proposals/DATA_MIGRATION_PLAN.md`
- **Hallazgo:** Planes de migración que documentan la deuda. Son documentos de planificación.
- **Recomendación:** Archivar en `docs/legacy/archived-proposals/` cuando se complete la migración.

### L6. `data/default_teams.json` con `stadium_name`
- **Archivo:** `src-tauri/data/default_teams.json:15-315`
- **Hallazgo:** 16 equipos default con `"stadium_name": "City Arena"`.
- **Recomendación:** Cambiar a `"arena_name"`.

### L7. "Test FC" / "Home FC" / "Away FC" / "Test Stadium" en test data
- **Múltiples archivos**
- simulation_tests.rs, live_match_tests.rs, helpers.test.ts, etc.
- **Recomendación:** Cambiar a "Test Team" / "Home Team" / "Away Team".

### L8. `football_position_to_lol_role()` helper en tests
- **Archivo:** `src-tauri/crates/engine/tests/simulation_tests.rs:20`
- **Recomendación:** Renombrar a `position_to_lol_role()`.

### L9. `footballTermGuard.ts`
- **Archivo:** `src/content/lol/social/guard.ts`
- **Hallazgo:** La función `FOOTBALL_ERA_TERMS` tiene términos como `manager`, `coach`, `transfer` que también son válidos en LoL. Incluye `stadium`.
- **Recomendación:** Revisar el allowlist. Renombrar archivo a solo `guard.ts` (el path `lol/social/` ya indica el contexto).

### L10. `lec_world.json` description
- **Archivos:** `src-tauri/databases/lec_world.json:3` y Android gen copy
- **Hallazgo:** `"description": "Mundo predefinido de League of Legends (LEC) para OpenFootManager adaptado."`
- **Recomendación:** Cambiar a `"OLManager"`.

### L11. `save_manager.rs` con formación 4-4-2 en test data
- **Archivo:** `src-tauri/crates/db/src/save_manager.rs:711,714,718,726-736,899,920,942`
- **Hallazgo:** Tests con lineups de 11 jugadores de fútbol (gk, lb, cb1, cb2, rb, lm, cm1, cm2, rm, st1, st2).
- **Recomendación:** Refactorizar tests a lineups de 5 roles LoL.

### L12. `legacy_migration.rs` con formación de fútbol
- **Archivo:** `src-tauri/crates/db/src/legacy_migration.rs:324,368-378,389,920`
- **Hallazgo:** Tests de migración legacy con posiciones de fútbol completas (11 jugadores).
- **Recomendación:** Refactorizar tests (son legacy, baja prioridad).

### L13. Comentarios "legacy football" en player_repo.rs
- **Archivo:** `src-tauri/crates/db/src/repositories/player_repo.rs:107`
- **Hallazgo:** `"// === Legacy football position strings (for backward compatibility) ==="` — código correcto (necesario), pero el comentario podría simplificarse.
- **Recomendación:** Actualizar comentario a "legacy position strings".

### L14. `offsides: 0` en test data
- **Archivo:** `src/components/playerProfile/PlayerProfileHeroCard.test.tsx:62`
- **Hallazgo:** Campo `offsides` en test data de player profile.
- **Recomendación:** Eliminar del test data.

### L15. `revenue_per_match` / `calc_matchday` en finances
- **Archivo:** `src-tauri/crates/ofm_core/src/finances.rs:74,79,321`
- **Hallazgo:** `stadium_capacity` usado como parámetro. Si se renombra el campo en Team, actualizar aquí.
- **Recomendación:** Vincular al rename de `stadium_capacity` → `arena_capacity`.

### L16. `tactics/TacticsTab.helpers.ts` con descripciones de fútbol
- **Archivo:** `src/components/tactics/TacticsTab.helpers.ts:28,34`
- **Hallazgo:** `"Pushes more bodies forward, creates extra support around the box"` — descripciones estilo fútbol para play styles.
- **Recomendación:** Actualizar textos a descripciones de draft strategy LoL.

### L17. `ChampionDraft.tsx` comentario "football positions"
- **Archivo:** `src/components/match/ChampionDraft.tsx:479`
- **Hallazgo:** `"// Fallback: map football positions to LoL roles"`.
- **Recomendación:** Simplificar a `"// Map legacy positions to LoL roles"`.

---

## Plan de Acción Recomendado

### Prioridad 1: Críticos (Fase A)
1. Renombrar `stadium_name`/`stadium_capacity` → `arena_name`/`arena_capacity` en domain types
2. Eliminar `formation` field del domain→engine→DB→frontend
3. Reescribir `SquadTab.helpers.ts` — football pitch → LoL lineup builder
4. Remover `football_nation` de tipos de store + script de generación
5. Renombrar `goals_for`/`goals_against` → `maps_won`/`maps_lost` en StandingEntry
6. Reemplazar `CompactTeamMatchStatsData` con stats LoL
7. Deprecar `Footedness` y `clean_sheets`
8. Renombrar `goal_difference()` → `kill_difference()`
9. Eliminar `drawn` de StandingEntry
10. Arreglar `WorldEditorTab.tsx` para no generar football_nation

### Prioridad 2: Medios (Fase B)
1. Reemplazar `openfootlogo.svg` con logo OLManager
2. Renombrar i18n keys (`footballHerald` → `lolEsports`, `pitchInteractionHint` → `riftInteractionHint`)
3. Migrar test data de 4-4-2 a rosters de 5 roles LoL
4. Renombrar `fixture` → `match` / `series` donde aplique
5. Arreglar `generate-lec-world.mjs` para no emitir football_nation
6. Renombrar tests con nombres de fútbol
7. Limpiar `FOOTBALL_IDENTITIES` → `LEGACY_NATIONAL_IDENTITIES`
8. Eliminar `yellow_cards`/`red_cards` de tipos frontend
9. Remover `draws` de ManagerCareerStats
10. Evaluar migración `PlayStyle` → `DraftStrategy` (ver propuesta #51)

### Prioridad 3: Bajos (Fase C)
1. Marcar `#[deprecated]` en `Position` enum
2. Actualizar comentarios "football" → "legacy" en Rust
3. Limpiar test data de 11 jugadores de fútbol en save_manager.rs
4. Actualizar `data/default_teams.json` a `arena_name`
5. Renombrar `footballTermGuard.ts` → `guard.ts`
6. Cambiar description de `lec_world.json` a OLManager
7. Actualizar comentarios en `ChampionDraft.tsx`
8. Archivar propuestas de migración en `docs/legacy/archived-proposals/`
9. Limpiar `offsides` de test data
10. Actualizar descripciones de tactics helpers

### Migración de Base de Datos Requerida
- **V43:** Eliminar columna `formation` de tabla `teams`
- **V44:** Renombrar columnas `stadium_name`/`stadium_capacity` → `arena_name`/`arena_capacity` (si no se hizo en V35/V36)
- **V45:** Eliminar `football_nation` de tablas de jugadores y equipos

### Riesgos y Mitigaciones
| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Romper saves existentes al eliminar formation | Media | Migración V43 con default a 5 roles LoL en carga |
| SquadTab.helpers.ts tightly coupled | Alta | Reescribir helpers primero, mantener interfaz, luego SquadTab.tsx |
| `stadium`→`arena` rompe IPC | Baja | Grep `stadium_` en frontend antes de renombrar |
| `football_nation` en scripts de generación | Alta | Arreglar script primero, regenerar seed, assertion en CI |
| Tests rotos tras renombrar | Media | Correr `cargo test` y `npm test` después de cada fase |

---

*Documento generado automáticamente el 08-MAY-2026.*
