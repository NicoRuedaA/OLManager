# Análisis de Restos de Fútbol en OLManager

> Fecha: 2026-05-02  
> Rama: `feat/85-remove-football-nation` (post-removal de `football_nation`)

---

## ✅ YA RESUELTOS (Fase 1 + PRs recientes)

| Término | Dónde | Estado |
|---------|-------|--------|
| `football_nation` | Domain types, repos, DB | ✅ Eliminado (V39) |
| `Position` (enum legacy) | `domain/src/stats.rs` | ✅ Se mantiene para backward compat |
| `goals` → `kills` | `PlayerSeasonStats` | ✅ Renombrado |
| `draws` | `ManagerCareerStats`, `StandingEntry` | ✅ Eliminado |
| `stadium_name/capacity` → `arena_*` | Migraciones SQL | ✅ Migrado (V35/V36) |
| `football_identity.rs` → `identity_upgrade.rs` | Archivo | ✅ Renombrado |
| `player_match_stats` → `lol_*` | Tablas DB | ✅ Migrado (V37/V38) |

---

## 🟡 PUEDEN QUEDAR (código legacy, sin impacto)

| Término | Archivo | Motivo |
|---------|---------|--------|
| `Goalkeeper`, `Defender`, `Midfielder`, `Forward`, `Striker`, `Winger` | `domain/src/stats.rs` — `Position` enum | Legacy enum mantenido para deserializar saves viejos |
| `goalkeeper`, `defender`, etc. | Tests en `save_manager.rs`, `player_repo.rs` | Data de test legacy — no afecta producción |
| `penalty`, `foul`, `substitution` | `engine/src/report.rs` | Engine de simulación de partidos (general purpose) |

---

## 🔴 PENDIENTE DE REVISIÓN

### 1. `StandingEntry.goals_for` / `goals_against` — 11 ocurrencias

**Archivo:** `domain/src/league.rs`

```rust
pub struct StandingEntry {
    pub goals_for: u32,     // → renombrar a maps_won / games_won
    pub goals_against: u32, // → renombrar a maps_lost / games_lost
}
```

**Impacto:** Afecta `ofm_core`, `db`, frontend (types.ts).  
**Esfuerzo:** ~30 min (cambio en domain + repos + frontend).  
**Prioridad:** 🟡 Media (solo semántica, no afecta funcionalidad).

### 2. `GoalDetail` en engine — 4 ocurrencias

**Archivo:** `engine/src/report.rs`

```rust
pub struct GoalDetail {     // → KillDetail (ya existe como concepto en LoL)
    pub is_penalty: bool,   // → eliminar o renombrar
}
```

**Impacto:** Solo engine crate, no afecta IPC.  
**Esfuerzo:** ~15 min.  
**Prioridad:** 🟢 Baja (engine es legacy).

### 3. Engine soccer terms — ~80 ocurrencias

Términos como `Penalty`, `FreeKick`, `Offside`, `Substitution`, `Foul` en el engine crate.

**Impacto:** Solo engine crate — NO afecta el frontend ni la DB. El engine es un crate separado que simula partidos de fútbol (herencia de OpenFootManager).  
**Prioridad:** 🔴 Ninguna — el engine no se usa para la simulación LoL (`lol_sim_v2.rs` es el motor actual).

---

## 📊 RESUMEN

| Prioridad | Item | Esfuerzo | ¿Hacer? |
|-----------|------|----------|---------|
| 🟡 Media | Renombrar `goals_for`/`goals_against` → `maps_won`/`maps_lost` | 30 min | ✅ Recomendado |
| 🟢 Baja | `GoalDetail` → `KillDetail` | 15 min | 🔲 Si hay tiempo |
| ⚪ Ninguna | Engine soccer terms (Penalty, Foul, etc.) | — | ❌ No tocar (código legacy aislado) |
