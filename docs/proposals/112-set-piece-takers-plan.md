# Plan #112: Reemplazar SetPieceTakers con LoL Roles

## Estrategia

Eliminar `free_kick_taker`, `corner_taker`, `penalty_taker` (no existen en LoL).  
Conservar solo `captain` (líder de equipo) y opcionalmente `shotcaller` (quien llama objectives).

---

## Fase 1: DB (primero, como pediste)

### 1a. Migration V41 — Renombrar columna `match_roles`

```sql
-- Añadir nueva columna con el nuevo nombre
ALTER TABLE teams ADD COLUMN team_roles TEXT NOT NULL DEFAULT '{}';

-- Migrar datos existentes (serde se encarga de ignorar campos extra)
UPDATE teams SET team_roles = match_roles;

-- Opcional: drop old column (o dejarla y ignorarla)
-- ALTER TABLE teams DROP COLUMN match_roles;  -- SQLite no soporta DROP COLUMN fácil
```

**En SQLite no se puede hacer `ALTER TABLE DROP COLUMN`** (es una limitación conocida). Alternativas:
1. **Dejar la columna**: `match_roles` queda como columna muerta, nunca se escribe. 0 riesgo, 0 data loss.
2. **Recrear la tabla**: CREATE TABLE new + INSERT INTO + DROP TABLE + RENAME. Más riesgoso.

**Recomendación**: Opción 1. La columna `match_roles` queda como legacy, nunca más se escribe. El código solo escribe/lee `team_roles`.

Archivos a tocar:
- `db/src/sql/v041_team_roles.sql` — nueva migration
- `db/src/migrations.rs` — agregar V41
- `db/src/repositories/team_repo.rs` — cambiar `match_roles` → `team_roles` en INSERT/SELECT
- `db/tests/academy_team_persistence.rs` — actualizar inline SQL

---

## Fase 2: Domain struct

### 2a. Renombrar `MatchRoles` → `TeamRoles`

```rust
// domain/src/team.rs
pub struct TeamRoles {
    pub captain: Option<String>,
    pub shotcaller: Option<String>,   // nuevo: reemplaza free_kick_taker
}
```

- Eliminar: `vice_captain`, `penalty_taker`, `free_kick_taker`, `corner_taker`
- `shotcaller`: el jugador que llama objectives/shots (opcional, futuro)

Archivos a tocar:
- `domain/src/team.rs` — struct definition + `Team::team_roles` field + Default

---

## Fase 3: DB Repository (ajuste post-domain)

- `team_repo.rs`: `t.match_roles` → `t.team_roles`, `match_roles_json` → `team_roles_json`
- Tests de roundtrip: actualizar asserts

---

## Fase 4: Engine

### 4a. Renombrar `SetPieceTakers` → `TeamRoles`

```rust
// engine/src/live_match/mod.rs
pub struct TeamRoles {
    pub captain: Option<String>,
    pub shotcaller: Option<String>,
}
```

### 4b. Renombrar fields del snapshot

```rust
pub home_roles: TeamRoles,
pub away_roles: TeamRoles,
```

### 4c. Renombrar/eliminar MatchCommand variants

```rust
pub enum MatchCommand {
    SetCaptain { side: Side, player_id: String },
    SetShotcaller { side: Side, player_id: String },
    // Eliminar: SetFreeKickTaker, SetCornerTaker, SetPenaltyTaker
}
```

Ambos commands siguen siendo no-ops (idempotentes, no afectan simulación).

Archivos a tocar:
- `engine/src/live_match/mod.rs` — struct, snapshot, MatchCommand, apply_command
- `engine/src/live_match/snapshot.rs` — inicialización
- `engine/src/lib.rs` — re-export
- `engine/tests/live_match_tests.rs` — actualizar tests

---

## Fase 5: ofm_core

### 5a. `auto_select_set_pieces`

Renombrar a `auto_select_team_roles`. Cambiar return type a `(Option<String>, Option<String>)` para `(captain, shotcaller)`.

Actualmente computa captain (leadership+teamwork), penalty (shooting+composure), free_kick (passing+vision), corner (passing+vision).  
Con el rename:
- `captain` se mantiene igual (leadership+teamwork)
- `shotcaller` = el mejor en shooting + vision + passing (hereda de free_kick)
- penalty/corner lógica se elimina

### 5b. `transfers.rs` + `contracts.rs`

Actualizar referencias de `match_roles.*` → `team_roles.*`. Eliminar limpieza de `penalty_taker`, `free_kick_taker`, `corner_taker`.

### 5c. Tests

Actualizar `live_match_manager_tests.rs`:
- `auto_select_set_pieces_picks_captain` → se mantiene
- `auto_select_set_pieces_excludes_gk_from_penalty` → eliminar (penalty no existe)
- `auto_select_set_pieces_prefers_high_shooting_penalty` → eliminar
- `auto_select_set_pieces_prefers_high_leadership_captain` → se mantiene

---

## Fase 6: Tauri Commands

- `squad.rs`: `set_team_match_roles` → `set_team_roles`. Actualizar JSON keys.
- `world.rs`: Actualizar seed JSON.
- `lib.rs`: Actualizar command registrations.

---

## Fase 7: Frontend TypeScript

### 7a. Types

```typescript
// src/store/types.ts
export interface TeamRolesData {
  captain: string | null;
  shotcaller: string | null;
}

// src/components/match/types.ts  
export interface TeamRoles {
  captain: string | null;
  shotcaller: string | null;
}
```

### 7b. Test files (~10 archivos)

Actualizar todos los mocks que construyen `match_roles: { captain: null, vice_captain: null, ... }` → `team_roles: { captain: null, shotcaller: null }`.

---

## Fase 8: Data files

- `lec_world.json`: Actualizar 38 equipos
- `generate-lec-world.mjs`: Actualizar generador

---

## Fase 9: Docs

- `ROADMAP.md`: Marcar #112 como done
- Eliminar referencias legacy en `docs/legacy/`

---

## Orden de implementación

```
DB (V41 migration) → Domain → DB Repo → Engine → ofm_core → Tauri Commands → Frontend TS → Data → Docs
```

Este orden permite:
1. DB migration primero (backwards compatible)
2. Domain struct cambia (base para todo)
3. DB repo se ajusta al nuevo struct
4. Engine consume el nuevo struct
5. ofm_core usa el nuevo domain + engine
6. Tauri commands conectan
7. Frontend refleja los cambios
8. Data files se actualizan al final

## Resumen de archivos (~27 únicos)

| Capa | Archivos |
|------|----------|
| DB | 3 (v041, migrations.rs, team_repo.rs, academy test) |
| Domain | 1 (team.rs) |
| Engine | 4 (mod.rs, snapshot.rs, lib.rs, tests) |
| ofm_core | 5 (team_builder, transfers, contracts, world_io, tests) |
| Tauri | 3 (squad.rs, world.rs, lib.rs) |
| Frontend | ~10 (types + test files) |
| Data | 2 (json + mjs) |
| Docs | 2 |
