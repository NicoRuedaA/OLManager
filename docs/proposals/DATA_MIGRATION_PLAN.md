# Data Migration Plan: Football → LoL

> **Estado**: En progreso | **Última actualización**: 2026-04-29 | **Responsable**: SDD Architecture

## Resumen Ejecutivo

El proyecto OLManager heredó una base de código de fútbol (futbol) y está en proceso de migración hacia League of Legends (LoL). Esta migración implica renombrar campos, modificar tipos Rust, actualizar esquemas de base de datos y reescribir scripts de generación de datos.

### Estado actual de la migración

| Componente | Estado | Notas |
|------------|--------|-------|
| Stats de partido (v020) | ✅ Hecho | Mapeo `goals` → `kills`, `shots` → `creep_score` |
| Tablas puras LoL (v021) | ✅ Hecho | `lol_player_match_stats`, `lol_team_match_stats` |
| `football_nation` (v014) | 🔲 Pendiente | Renombrar a `nationality_code` + agregar `competitive_region` |
| Position enum → Role | 🔲 Pendiente | Requiere nuevo enum y migración de datos |
| Stadium → Arena | 🔲 Pendiente | Requiere nuevo campo `arena_name` |
| Formation → Composición | 🔲 Pendiente | Requiere análisis de formato |
| PlayStyle → DraftStrategy | 🔲 Pendiente | Requiere nuevo enum |

### Objetivo del documento

Proporcionar un plan accionable para que cualquier desarrollador pueda ejecutar la migración de datos de fútbol a LoL de forma sistemática y sin perder información existente.

---

## Inventario de Datos

### Base de Datos (SQLite)

Las migraciones de base de datos se encuentran en `src-tauri/crates/db/src/sql/`.

#### Esquema actual (v001)

```sql
-- managers
id, first_name, last_name, date_of_birth, nationality, reputation, satisfaction, fan_approval, team_id, career_stats, career_history

-- teams
id, name, short_name, country, city, stadium_name, stadium_capacity, finance, manager_id, reputation, wage_budget, transfer_budget, season_income, season_expenses, formation, play_style, training_focus, ...

-- players
id, match_name, full_name, date_of_birth, nationality, position, attributes, condition, morale, injury, team_id, traits, ...

-- staff
id, first_name, last_name, date_of_birth, nationality, role, attributes, team_id, specialization, ...
```

#### Migraciones aplicadas

| Migración | Fecha | Descripción | Estado |
|-----------|-------|-------------|--------|
| v014 | - | Agrega `football_nation`, `birth_country` a managers, teams, players, staff | ⚠️ Migración con campos a renombrar |
| v020 | - | Agrega columnas LoL a `player_match_stats` (`kills`, `deaths`, `creep_score`, etc.) y mapea datos existentes | ✅ Hecho |
| v021 | - | Crea tablas `lol_player_match_stats` y `lol_team_match_stats` con datos migrados | ✅ Hecho |
| v022-v027 | - | Otras migraciones (potential, scrims, etc.) | Sin cambios relevantes para migración |

### Tipos Rust (domain crate)

Los tipos de dominio se encuentran en `src-tauri/crates/domain/src/`.

#### Estructuras que necesitan actualización

| Archivo | Estructura | Campos a migrar |
|---------|------------|-----------------|
| `player.rs` | `Player` | `football_nation` → `nationality_code` + `competitive_region`, `Position` enum → `Role` enum |
| `team.rs` | `Team` | `football_nation` → `nationality_code` + `competitive_region`, `stadium_name` → `arena_name`, `formation` → team composition |
| `manager.rs` | `Manager` | `football_nation` → `nationality_code` + `competitive_region` |
| `staff.rs` | `Staff` | `football_nation` → `nationality_code` + `competitive_region` |

> **Nota importante sobre identidad en LoL**: En League of Legends, "región competitiva" y "nacionalidad" son conceptos **DISTINTOS**:
> - `nationality_code` → país de origen del jugador (ej: "KR", "ES", "FR")
> - `competitive_region` → liga donde compite (ej: "LCK", "LEC", "LCS")
> - Un jugador coreano (`nationality_code: "KR"`) puede competir en `LEC` (`competitive_region: "LEC"`)
>
> El campo anterior `football_nation` era un código de 3 letras que representaba la nacionalidad competitiva, pero mezclaba ambos conceptos. La migración los separa correctamente.

#### Enums a actualizar

```rust
// player.rs - Position actual
pub enum Position {
    Goalkeeper,
    Defender,
    Midfielder,
    Forward,
    RightBack,
    CenterBack,
    LeftBack,
    RightWingBack,
    LeftWingBack,
    DefensiveMidfielder,
    CentralMidfielder,
    AttackingMidfielder,
    RightMidfielder,
    LeftMidfielder,
    RightWinger,
    LeftWinger,
    Striker,
}

// team.rs - PlayStyle actual
pub enum PlayStyle {
    Balanced,
    Attacking,
    Defensive,
    Possession,
    Counter,
    HighPress,
}
```

### Datos JSON/Externos

#### Archivos de datos

| Archivo | Descripción | Uso actual |
|---------|-------------|------------|
| `data/lec/seed.teams-players.json` | Equipos y jugadores LEC | Generación de mundo inicial |
| `data/lec/draft/players.json` | Datos crudos de jugadores | Generación avanzada |
| `data/lec/draft/teams.json` | Datos crudos de equipos | Generación avanzada |
| `data/lec/draft/champions.json` | Lista de campeones | Simulación |
| `src-tauri/data/default_teams.json` | Equipos por defecto | Inicialización |
| `src-tauri/data/default_names.json` | Nombres por defecto | Generación |

#### Scripts de generación

| Script | Descripción | Estado |
|--------|-------------|--------|
| `scripts/generate-lec-world.mjs` | Genera mundo LEC con mapeo de roles | Usa mapeo antiguo (Top→Defender, etc.) |
| `scripts/fetch-leaguepedia-dobs.mjs` | Busca fechas de nacimiento | Dependiente de fuente externa |
| `scripts/ml/tune-lol-thresholds.mjs` | Ajusta umbrales de simulación | Listo para LoL |

---

## Mapeo de Campos

### Tabla de mapeo completa

| Entidad | Campo Actual | Campo Destino | Tipo Actual | Tipo Destino | Estado | Migración SQL |
|---------|--------------|---------------|-------------|--------------|--------|---------------|
| players | `football_nation` | `nationality_code` | TEXT | TEXT | 🔲 Pendiente | v028 |
| teams | `football_nation` | `nationality_code` | TEXT | TEXT | 🔲 Pendiente | v028 |
| managers | `football_nation` | `nationality_code` | TEXT | TEXT | 🔲 Pendiente | v028 |
| staff | `football_nation` | `nationality_code` | TEXT | TEXT | 🔲 Pendiente | v028 |
| players | _(nuevo)_ | `competitive_region` | — | TEXT (nullable) | 🔲 Pendiente | v028 |
| teams | _(nuevo)_ | `competitive_region` | — | TEXT (nullable) | 🔲 Pendiente | v028 |
| managers | _(nuevo)_ | `competitive_region` | — | TEXT (nullable) | 🔲 Pendiente | v028 |
| staff | _(nuevo)_ | `competitive_region` | — | TEXT (nullable) | 🔲 Pendiente | v028 |
| players | `Position` enum | `Role` enum | enum | enum | 🔲 Pendiente | Código |
| teams | `stadium_name` | `arena_name` | TEXT | TEXT | 🔲 Pendiente | v029 |
| teams | `stadium_capacity` | `arena_capacity` | INTEGER | INTEGER | 🔲 Pendiente | v029 |
| teams | `formation` | `team_composition` | STRING | STRING | 🔲 Pendiente | Código |
| teams | `play_style` | `draft_strategy` | enum | enum | 🔲 Pendiente | Código |
| player_match_stats | `goals` → `kills` | — | INTEGER | INTEGER | ✅ Hecho | v020 |
| player_match_stats | `shots` → `creep_score` | — | INTEGER | INTEGER | ✅ Hecho | v020 |
| player_match_stats | `shots_on_target` → `deaths` | — | INTEGER | INTEGER | ✅ Hecho | v020 |
| player_match_stats | `passes_completed` → `vision_score` | — | INTEGER | INTEGER | ✅ Hecho | v020 |
| player_match_stats | `passes_attempted` → `wards_placed` | — | INTEGER | INTEGER | ✅ Hecho | v020 |

### Mapeo de Posiciones de Fútbol a Roles LoL

El script `scripts/generate-lec-world.mjs` ya tiene un mapeo, pero necesita actualizarse:

```javascript
// Mapeo ACTUAL (incorrecto para LoL)
function roleToPosition(role) {
  case "top":       return "Defender";
  case "jungle":    return "Midfielder";
  case "mid":       return "AttackingMidfielder";
  case "bot":       return "Forward";
  case "support":   return "DefensiveMidfielder";
}

// Mapeo PROPUESTO (correcto para LoL)
function footballPositionToLolRole(position) {
  switch (position) {
    case "Goalkeeper":       return "Support";  // GK → Support (protector)
    case "Defender":
    case "RightBack":
    case "CenterBack":
    case "LeftBack":
    case "RightWingBack":
    case "LeftWingBack":     return "Top";     // Defensores → Top (solo lane)
    case "Midfielder":
    case "DefensiveMidfielder":
    case "CentralMidfielder": return "Mid";    // Centrocampistas → Mid
    case "AttackingMidfielder":
    case "RightMidfielder":
    case "LeftMidfielder":  return "Mid";     // Medias → Mid
    case "Forward":
    case "RightWinger":
    case "LeftWinger":
    case "Striker":          return "ADC";     // Delanteros → ADC (Bot)
  }
}
```

### Mapeo de PlayStyle a DraftStrategy

```rust
// PlayStyle actual
pub enum PlayStyle {
    Balanced,    // → Balanced
    Attacking,   // → Aggressive
    Defensive,    // → Passive
    Possession,   // → Scaling
    Counter,      // → CounterPick
    HighPress,    // → Aggressive
}

// Nuevo enum DraftStrategy (propuesto)
pub enum DraftStrategy {
    Balanced,     // Equipo balanceado
    Aggressive,   // Early game focus
    Passive,       // Late game focus
    Scaling,       // Farm heavy
    CounterPick,  // Counter pick strategy
    PriorityBans, // Ban priority targets
}
```

---

## Migraciones de Base de Datos Pendientes

### v028: Renombrar football_nation → nationality_code + agregar competitive_region

```sql
-- Rename football_nation to nationality_code in all tables
ALTER TABLE players RENAME COLUMN football_nation TO nationality_code;
ALTER TABLE teams RENAME COLUMN football_nation TO nationality_code;
ALTER TABLE managers RENAME COLUMN football_nation TO nationality_code;
ALTER TABLE staff RENAME COLUMN football_nation TO nationality_code;

-- Add competitive_region column (nullable - not all entities have a region)
ALTER TABLE players ADD COLUMN competitive_region TEXT;
ALTER TABLE teams ADD COLUMN competitive_region TEXT;
ALTER TABLE managers ADD COLUMN competitive_region TEXT;
ALTER TABLE staff ADD COLUMN competitive_region TEXT;

-- Update sequences/metadata
INSERT INTO db_sequence (name, value) VALUES ('schema_version', 28)
ON CONFLICT(name) DO UPDATE SET value = 28;
```

**Notas**:
- SQLite soporta `RENAME COLUMN` desde 3.25.0 (2018)
- `competitive_region` es nullable porque no todos los registros tienen una región competitiva asignada
- Verificar que no haya foreign keys que referencien `football_nation`
- Backup de la base de datos antes de ejecutar
- **¿Por qué `nationality_code` y no `region`?**: En LoL, "región" (LEC, LCK, LCS) y "nacionalidad" (KR, ES, FR) son conceptos distintos. Un jugador coreano puede competir en la LEC. Separar ambos campos permite representar correctamente esta realidad.

### v029: Migrar stadium → arena

```sql
-- Add arena columns
ALTER TABLE teams ADD COLUMN arena_name TEXT;
ALTER TABLE teams ADD COLUMN arena_capacity INTEGER;

-- Copy data from stadium columns
UPDATE teams SET arena_name = stadium_name, arena_capacity = stadium_capacity;

-- Note: Keep stadium columns for backward compatibility during transition
-- They can be removed in a future migration (v032+)

INSERT INTO db_sequence (name, value) VALUES ('schema_version', 29)
ON CONFLICT(name) DO UPDATE SET value = 29;
```

### v030: Agregar team_composition

```sql
-- Add team composition field (stores 5 roles as JSON array)
ALTER TABLE teams ADD COLUMN team_composition TEXT DEFAULT '[]';

-- Convert existing formations to team compositions
-- 4-4-2: ["Top", "Jungle", "Mid", "ADC", "Support"]
-- 4-3-3: ["Top", "Jungle", "Mid", "ADC", "Support"]
-- 5-3-2: ["Top", "Jungle", "Mid", "ADC", "Support"]
-- etc.

UPDATE teams SET team_composition = 
  CASE 
    WHEN formation LIKE '%4-4-2%' THEN '["Top","Jungle","Mid","ADC","Support"]'
    WHEN formation LIKE '%4-3-3%' THEN '["Top","Jungle","Mid","ADC","Support"]'
    WHEN formation LIKE '%5-3-2%' THEN '["Top","Jungle","Mid","ADC","Support"]'
    WHEN formation LIKE '%3-5-2%' THEN '["Top","Jungle","Mid","ADC","Support"]'
    ELSE '["Top","Jungle","Mid","ADC","Support"]'
  END;

INSERT INTO db_sequence (name, value) VALUES ('schema_version', 30)
ON CONFLICT(name) DO UPDATE SET value = 30;
```

### v031: Agregar draft_strategy

```sql
-- Add draft_strategy field
ALTER TABLE teams ADD COLUMN draft_strategy TEXT DEFAULT 'Balanced';

-- Migrate play_style to draft_strategy
UPDATE teams SET draft_strategy =
  CASE play_style
    WHEN 'Balanced' THEN 'Balanced'
    WHEN 'Attacking' THEN 'Aggressive'
    WHEN 'Defensive' THEN 'Passive'
    WHEN 'Possession' THEN 'Scaling'
    WHEN 'Counter' THEN 'CounterPick'
    WHEN 'HighPress' THEN 'Aggressive'
    ELSE 'Balanced'
  END;

INSERT INTO db_sequence (name, value) VALUES ('schema_version', 31)
ON CONFLICT(name) DO UPDATE SET value = 31;
```

---

## Tipos Rust a Actualizar

### domain/src/player.rs

```rust
// AGREGAR: Role enum (nuevo)
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Role {
    Top,
    Jungle,
    Mid,
    ADC,
    Support,
}

impl Position {
    // AGREGAR: Método de conversión
    pub fn to_lol_role(&self) -> Role {
        match self {
            Position::Goalkeeper => Role::Support,
            Position::Defender | Position::RightBack | Position::CenterBack 
            | Position::LeftBack | Position::RightWingBack | Position::LeftWingBack => Role::Top,
            Position::Midfielder | Position::DefensiveMidfielder 
            | Position::CentralMidfielder | Position::RightMidfielder 
            | Position::LeftMidfielder | Position::AttackingMidfielder => Role::Mid,
            Position::Forward | Position::RightWinger | Position::LeftWinger 
            | Position::Striker => Role::ADC,
        }
    }
}

// MODIFICAR: Struct Player
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    // ... campos existentes ...
    #[serde(default, alias = "football_nation")]
    pub nationality_code: String,  // Código de nacionalidad (ej: "KR", "ES")
    #[serde(default)]
    pub competitive_region: Option<String>,  // Región competitiva (ej: "LEC", "LCK")
    // ...
}
```

### domain/src/team.rs

```rust
// AGREGAR: DraftStrategy enum (nuevo)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub enum DraftStrategy {
    #[default]
    Balanced,
    Aggressive,
    Passive,
    Scaling,
    CounterPick,
    PriorityBans,
}

// MODIFICAR: Struct Team
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Team {
    // ... campos existentes ...
    #[serde(default, alias = "football_nation")]
    pub nationality_code: String,
    #[serde(default)]
    pub competitive_region: Option<String>,
    #[serde(default, alias = "stadium_name")]
    pub arena_name: String,
    #[serde(default, alias = "stadium_capacity")]
    pub arena_capacity: u32,
    #[serde(default, alias = "formation")]
    pub team_composition: Vec<String>,
    #[serde(default, alias = "play_style")]
    pub draft_strategy: DraftStrategy,
    // ...
}
```

### domain/src/manager.rs

```rust
// MODIFICAR: Struct Manager
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manager {
    // ... campos existentes ...
    #[serde(default, alias = "football_nation")]
    pub nationality_code: String,
    #[serde(default)]
    pub competitive_region: Option<String>,
    // ...
}
```

### domain/src/staff.rs

```rust
// MODIFICAR: Struct Staff
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Staff {
    // ... campos existentes ...
    #[serde(default, alias = "football_nation")]
    pub nationality_code: String,
    #[serde(default)]
    pub competitive_region: Option<String>,
    // ...
}
```

---

## Scripts de Migración

### migrate-lol-roles.mjs (nuevo)

Script para migrar posiciones de jugadores existentes a roles LoL.

```javascript
// scripts/migrate-lol-roles.mjs

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const savePath = resolve(ROOT, "src-tauri/databases/default.db");

function footballPositionToLolRole(position) {
  const pos = String(position).toLowerCase();
  if (pos.includes("goalkeeper")) return "Support";
  if (pos.includes("defender") || pos.includes("back")) return "Top";
  if (pos.includes("midfielder") || pos.includes("mid")) return "Mid";
  if (pos.includes("forward") || pos.includes("winger") || pos.includes("striker")) return "ADC";
  return "ADC";
}

async function migrate() {
  console.log("Migrating player positions to LoL roles...");
  // Read save file
  // Update each player's position
  // Write back
  console.log("Migration complete");
}

migrate().catch(console.error);
```

### migrate-existing-saves.mjs (nuevo)

Script para migrar guardados existentes (JSON o SQLite).

```javascript
// scripts/migrate-existing-saves.mjs

import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

const ROOT = resolve(process.cwd());

const FIELD_MAPPINGS = {
  football_nation: "nationality_code",
  stadium_name: "arena_name",
  stadium_capacity: "arena_capacity",
  play_style: "draft_strategy",
};

async function migrateJsonFile(filePath) {
  const content = await readFile(filePath, "utf-8");
  const data = JSON.parse(content);
  
  // Recursively rename fields
  function renameFields(obj) {
    if (Array.isArray(obj)) return obj.map(renameFields);
    if (typeof obj !== "object" || obj === null) return obj;
    
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = FIELD_MAPPINGS[key] || key;
      result[newKey] = renameFields(value);
    }
    return result;
  }
  
  const migrated = renameFields(data);
  await writeFile(filePath, JSON.stringify(migrated, null, 2));
  console.log(`Migrated: ${filePath}`);
}

async function main() {
  const databasesDir = resolve(ROOT, "src-tauri/databases");
  // Find and migrate all save files
  console.log("Migration complete");
}

main().catch(console.error);
```

### generate-lec-world.mjs (actualizar)

El script existente necesita actualización del mapeo de roles:

```javascript
// ACTUAL (líneas 96-114)
function roleToPosition(role) {
  // Mapeo incorrecto para LoL
}

// NUEVO
function roleToPosition(role) {
  switch (String(role || "").toLowerCase()) {
    case "top":       return "Top";
    case "jungle":    return "Jungle";
    case "mid":       return "Mid";
    case "bot":
    case "adc":       return "ADC";
    case "support":
    case "sup":       return "Support";
    default:          return "Mid";
  }
}
```

---

## Cronograma

### Fase 1: Base de Datos (Semana 1)

| Tarea | Estimación | Dependencias | Estado |
|-------|------------|--------------|--------|
| v028: Renombrar `football_nation` → `nationality_code` + agregar `competitive_region` | 2 horas | Ninguna | 🔲 Pendiente |
| v029: Migrar stadium → arena | 2 horas | v028 | 🔲 Pendiente |
| v030: Agregar team_composition | 2 horas | v029 | 🔲 Pendiente |
| v031: Agregar draft_strategy | 2 horas | v030 | 🔲 Pendiente |
| Test de migración en SQLite | 4 horas | v031 | 🔲 Pendiente |

### Fase 2: Tipos Rust (Semana 1-2)

| Tarea | Estimación | Dependencias | Estado |
|-------|------------|--------------|--------|
| Agregar `Role` enum en player.rs | 4 horas | Ninguna | 🔲 Pendiente |
| Actualizar `Player` struct con backwards compatibility | 4 horas | Role enum | 🔲 Pendiente |
| Agregar `DraftStrategy` enum en team.rs | 4 horas | Ninguna | 🔲 Pendiente |
| Actualizar `Team` struct con backwards compatibility | 4 horas | DraftStrategy | 🔲 Pendiente |
| Actualizar `Manager` struct | 2 horas | Ninguna | 🔲 Pendiente |
| Actualizar `Staff` struct | 2 horas | Ninguna | 🔲 Pendiente |
| Compilación y tests | 4 horas | Todos los cambios | 🔲 Pendiente |

### Fase 3: Scripts de Generación (Semana 2)

| Tarea | Estimación | Dependencias | Estado |
|-------|------------|--------------|--------|
| Actualizar `generate-lec-world.mjs` | 4 horas | Tipos Rust | 🔲 Pendiente |
| Crear `migrate-existing-saves.mjs` | 8 horas | v028-v031 | 🔲 Pendiente |
| Test de generación de mundo | 4 horas | Scripts | 🔲 Pendiente |

### Fase 4: Limpieza (Semana 3)

| Tarea | Estimación | Dependencias | Estado |
|-------|------------|--------------|--------|
| Remover aliases de backwards compatibility | 4 horas | Migración completa | 🔲 Pendiente |
| Documentar cambios en CHANGELOG.md | 2 horas | Ninguna | 🔲 Pendiente |
| Test de regression | 8 horas | Todo | 🔲 Pendiente |

---

## Riesgos y Mitigación

| Riesgo | Impacto | Probabilidad | Mitigación |
|--------|---------|--------------|------------|
| **Pérdida de datos en migración** | Crítico | Media | 1. Full backup antes de cada migración 2. Tests automatizados de verificación post-migración 3. Mantener campos old durante transición |
| **Incompatibilidad con guardados existentes** | Alto | Media | Usar aliases de serde para backwards compatibility durante transición |
| **Errores en mapeo de posiciones** | Alto | Baja | Documentar mapeo explícito, agregar tests unitarios |
| **SQLite no soporta RENAME COLUMN** | Medio | Baja | Verificar versión de SQLite en runtime, fallback a COPY+DROP |
| **Scripts de migración fallan en datos edge case** | Medio | Media | 1. Validar datos antes de migración 2. Loguear errores y continuar 3. Reporte de auditoría post-migración |
| **Regresión de rendimiento por nuevos campos** | Bajo | Baja | Benchmarks antes y después, optimizar queries si es necesario |

### Estrategia de Rollback

Para cada migración SQL:
1. Crear tabla backup antes de modificar
2. Generar script de rollback SQL
3. En caso de falla, ejecutar rollback y notificar al usuario

```sql
-- Template de backup
CREATE TABLE teams_backup AS SELECT * FROM teams;
-- Para rollback:
-- DROP TABLE teams;
-- ALTER TABLE teams_backup RENAME TO teams;
```

---

## Referencias

- [DATA_PROVENANCE.md](../DATA_PROVENANCE.md) - Política de datos externos
- [INHERITED_DOCS_AUDIT.md](../INHERITED_DOCS_AUDIT.md) - Auditoría de documentación heredada
- Migraciones en `src-tauri/crates/db/src/sql/`
  - v014: `football_identity.sql`
  - v020: `lol_stats_schema.sql`
  - v021: `lol_pure_stats_tables.sql`
- Tipos domain en `src-tauri/crates/domain/src/`
  - `player.rs`
  - `team.rs`
  - `manager.rs`
  - `staff.rs`
- Scripts de generación:
  - `scripts/generate-lec-world.mjs`
  - `scripts/fetch-leaguepedia-dobs.mjs`

---

## Notas Adicionales

### Sobre backwards compatibility

Se recomienda mantener los nombres de campos old con aliases de serde durante al menos 2-3 versiones para permitir que los usuarios migren sus guardados gradualmente. Después de eso, se pueden remover en una major release.

### Sobre la conversión de formaciones

Las formaciones de fútbol (4-4-2, 4-3-3, etc.) no tienen una correspondencia directa 1:1 con equipos LoL. Se propone:
- Por defecto, usar 5 roles básicos: `["Top", "Jungle", "Mid", "ADC", "Support"]`
- Permitir custom team compositions en el futuro
- La formación old se puede conservar como referencia histórica

### Sobre nationality_code vs region

El campo original `football_nation` era un código de 3 letras que representaba la identidad competitiva (ej: "ENG", "SCO"). En el contexto de LoL, esto se divide en dos conceptos:

1. **`nationality_code`** — Sigue siendo un código de nacionalidad, pero renombrado para claridad. Representa el país de origen. Ejemplos: "KR" (Corea), "ES" (España), "FR" (Francia), "DK" (Dinamarca).

2. **`competitive_region`** — Nuevo campo que representa la liga/región competitiva donde el jugador/equipo participa. Ejemplos: "LEC" (Europa), "LCK" (Corea), "LCS" (Norteamérica), "LPL" (China).

Esta separación es esencial en LoL porque los importes (jugadores de otras nacionalidades en una liga) son una práctica común. Por ejemplo:
- Faker (`nationality_code: "KR"`) juega en la `LCK` (`competitive_region: "LCK"`)
- Humanoid (`nationality_code: "CZ"`) juega en la `LEC` (`competitive_region: "LEC"`)

### Orden de ejecución

1. **Primero**: Migraciones de base de datos (SQL)
2. **Segundo**: Tipos Rust con backwards compatibility
3. **Tercero**: Scripts de generación
4. **Cuarto**: Tests de integración
5. **Quinto**: Cleanup y documentación
