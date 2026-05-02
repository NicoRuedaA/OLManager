# Plan: Eliminar `football_nation` de domain types y activar V39

**Issue:** #85 (Database Defutbolization)  
**Branch:** `feat/85-remove-football-nation`  
**Migración:** V39 (deshabilitada — SQL listo en `sql/v039_drop_football_nation.sql`)

---

## Contexto

El campo `football_nation` es un legacy de la migración desde OpenFootManager (fútbol → LoL). Fue reemplazado por `nationality_code` + `competitive_region` pero nunca se eliminó de las tablas ni de los tipos domain.

---

## ⚠️ Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| V39 recrea tablas (DROP + CREATE) — si falla a mitad, la partida se corrompe | `rusqlite-migration` envuelve cada migración en transacción SQLite. Si falla, hace rollback automático |
| El conteo de placeholders `?N` en INSERT es fácil de romper | Verificar cada archivo con `cargo build -p db` después de cada cambio |
| `player_repo.rs` tiene 34 columnas en INSERT — el conteo de params es tedioso | Hacerlo con paciencia, verificando cada columna contra la lista original |
| `identity_upgrade.rs` es compartido por `save_manager.rs` y `world.rs` | Refactorizar identity_upgrade.rs completo antes de tocar los otros archivos |

---

## Plan de Ejecución

### Paso 1: Identity Upgrade (1 archivo)

**`ofm_core/src/identity_upgrade.rs`** debe ser refactorizado primero porque es el módulo que más referencias tiene y que usan `save_manager.rs` y `world.rs`.

**Cambios:**
- Eliminar todas las referencias a `football_nation`
- Mantener solo la lógica de `birth_country` (sigue siendo relevante para migración de identidad)
- Simplificar `build_team_nation_map` y `upgrade_team_identity` para no leer football_nation
- Actualizar el test `upgrade_game_football_identities_populates_new_fields` para usar solo `birth_country`

**Verificación:** `cargo build -p ofm_core` + `cargo test -p ofm_core -- identity_upgrade`

---

### Paso 2: Domain Types (4 archivos) + Tests juntos

Eliminar el campo `football_nation` de los tipos domain. Como los repos DB también usan estos tipos, este paso provocará errores de compilación en `db` crate — es esperado.

| Archivo | Eliminar |
|---------|----------|
| `domain/src/player.rs` | `pub football_nation: String`, inicialización en `new()` |
| `domain/src/team.rs` | `pub football_nation: String`, `let football_nation = normalize(...)` en `new()` |
| `domain/src/manager.rs` | `pub football_nation: String`, `let football_nation = normalize(...)` en `new()` |
| `domain/src/staff.rs` | `pub football_nation: String`, `football_nation: String::new()` en `new()` |

**Verificación:** `cargo build -p domain` debe compilar. `cargo build -p ofm_core` también (gracias a Paso 1).

---

### Paso 3: DB Repositories + Tests en una sola pasada (4 archivos)

Cada archivo de repositorio se modifica en UNA sola visita, incluyendo tanto el código de producción como los tests `#[cfg(test)]`.

**Para cada repo, cambiar:**
1. **INSERT**: eliminar `football_nation` de lista de columnas, re-numerar `?N` placeholders, eliminar `x.football_nation` de `params![]`
2. **SELECT**: eliminar `football_nation` de lista de columnas, eliminar `football_nation: row.get(N)?,` del struct parser
3. **Tests**: eliminar `x.football_nation = "..."`, `x.football_nation.clear()`, y `assert_eq!(x.football_nation, "...")`

| Archivo | INSERT columns original | INSERT columns final | Notas |
|---------|------------------------|---------------------|-------|
| `db/src/repositories/player_repo.rs` | 34 cols | 33 cols | El más grande. Cuidado con los `?` placeholders |
| `db/src/repositories/team_repo.rs` | ~35 cols | ~34 cols | Tiene muchas columnas JSON |
| `db/src/repositories/manager_repo.rs` | 16 cols | 15 cols | El más simple |
| `db/src/repositories/staff_repo.rs` | 15 cols | 14 cols | Similar a manager |

**Verificación:** `cargo build -p db` + `cargo test -p db` debe pasar.

---

### Paso 4: Tests externos y World Export (2 archivos + 1 test de integración)

Archivos con tests que referencian `football_nation` fuera de los repositorios:

| Archivo | Cambios |
|---------|---------|
| `db/src/save_manager.rs` | `test_identity_upgrade_football_identities`: eliminar `.football_nation.clear()` y asserts |
| `db/tests/academy_team_persistence.rs` | INSERT SQL: eliminar `football_nation` de columnas |
| `ofm_core/src/generator/world_io.rs` | `export_world_to_json_writes_canonical_football_identity_fields`: eliminar `.clear()` y asserts |
| `src/commands/world.rs` | `export_world_database_internal_writes_canonicalized_world_json`: eliminar `.clear()` y asserts |
| `src/commands/world.rs` | `write_temp_database_roundtrips_football_identity_fields`: eliminar asserts |

**Verificación:** `cargo test -p db -p ofm_core` debe pasar.

---

### Paso 5: Activar V39 (1 archivo)

1. En `migrations.rs`:
   ```rust
   // Cambiar:
   // V39: (reserved — remove football_nation from tables)
   // Por:
   M::up_with_hook("SELECT 1;", migrate_drop_football_nation),
   ```
2. Incrementar `MIGRATION_COUNT` de 40 a 41

La función hook `migrate_drop_football_nation` ya existe en el código (agrega columnas faltantes + ejecuta `v039_drop_football_nation.sql`). **No necesita cambios.**

**Verificación:** 
- `cargo build -p db` compila
- `cargo test -p db` pasa (123 tests con V39 aplicando recreación de tablas)
- El test `test_apply_migrations_to_empty_db` verifica que no haya `football_nation` ni `player_match_stats` legacy

---

### Paso 6: Cleanup (1 archivo)

1. `domain/src/identity.rs`: remover `normalize_football_nation_code()` y sus tests. Si `identity_upgrade.rs` ya no lo usa y ningún otro módulo lo referencia, se puede borrar.
2. Verificar con `cargo build --workspace` que no haya `unused function` warnings.

---

## Orden de commits sugerido

```
1. feat(core): simplify identity_upgrade.rs without football_nation
2. feat(domain): remove football_nation field from Player, Team, Manager, Staff  
3. feat(db): remove football_nation from repository INSERT/SELECT and tests
4. fix(tests): update world export and save_manager tests without football_nation
5. feat(db): enable V39 migration to drop football_nation column
6. chore(domain): remove unused normalize_football_nation_code
```

Se verifican 1-2 (domain compila), 1-3 (db compila), 1-4 (tests pasan), 1-5 (migración funciona), 1-6 (limpio).

---

## Tiempo estimado (revisado)

| Paso | Archivos | Esfuerzo | Riesgo |
|------|----------|----------|--------|
| 1. Identity upgrade | 1 | 15 min | Bajo |
| 2. Domain types | 4 | 15 min | Bajo |
| 3. DB repos + tests | 4 | 45 min | **Medio** — conteo de params en player_repo |
| 4. Tests externos | 5 | 20 min | Bajo |
| 5. Activar V39 | 1 | 5 min | Bajo |
| 6. Cleanup | 1 | 5 min | Bajo |
| **Total** | **16** | **~1h 45min** | |
