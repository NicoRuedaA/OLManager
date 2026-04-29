# LOL Sim V2 Refactor Guide

Estado actualizado del plan de división de `src-tauri/src/application/lol_sim_v2.rs`.

## Objetivo

Reducir `lol_sim_v2.rs` a una fachada real (reexports + wiring mínimo) y mover ownership por dominios.

---

## Estado General

- Archivo principal actual: `src-tauri/src/application/lol_sim_v2.rs` (todavía grande)
- Estrategia actual: agresiva pero ordenada, con `cargo check` en cada corte.

---

## Plan por pasos

## 1) Runtime facade

**Estado:** ✅ COMPLETADO

Movido a `src-tauri/src/application/lol_sim_v2/runtime.rs`:
- `init`
- `tick`
- `reset`
- `dispose`
- `run_to_completion`
- `skip_to_end`

`lol_sim_v2.rs` quedó reexportando estas funciones.

---

## 2) Telemetría

**Estado:** ✅ COMPLETADO (eliminación)

Decisión de producto: ya no se usa telemetría.

Se removió:
- wiring runtime de telemetría
- procesamiento/output JSONL
- config/params telemetry en API
- command clear telemetry y bridge asociado

---

## 3) State init / bootstrap

**Estado:** ✅ COMPLETADO

Movido a `src-tauri/src/application/lol_sim_v2/state_init.rs`:
- `build_team_tactics_state`
- `build_neutral_timers_state`
- `default_runtime_state`
- `ensure_runtime_state_defaults`

---

## 4) Waves / Minions

**Estado:** 🔲 PENDIENTE

Mover a `waves.rs` / `minions.rs`:
- `spawn_waves_if_due`
- `spawn_wave`
- `build_minion`
- `move_minions`
- `resolve_minion_combat`

### Próximo corte recomendado
1. Crear `waves.rs` y mover `spawn_waves_if_due`, `spawn_wave`, `build_minion`.
2. Crear `minions.rs` y mover `move_minions`, `resolve_minion_combat`.
3. Mantener wrappers en fachada solo si hace falta transición.

---

## 5) Vision

**Estado:** 🔲 PENDIENTE

Mover a `vision.rs`:
- wards
- sweepers
- vision checks
- (si aplica) trap/brush/line-of-sight helpers

---

## 6) Combat (ownership real)

**Estado:** 🟡 EN PROGRESO

Ya movido a `combat.rs` (parcial):
- helpers de target/scoring/filtros
- `pick_combat_target`
- bloques de clasificación de assist/eligibilidad

Falta para cerrar:
- más bloques del pipeline de `resolve_champion_combat`
- effects/dots/ignite (si corresponde)
- mantener side-effects pesados en pasos controlados hasta cierre

---

## 7) Objectives / Structures

**Estado:** 🟡 EN PROGRESO

Ya movido parcialmente:
- helpers de dragon cycle
- sync objetivos
- helpers de tower targetting
- partes de neutral timers y side-effects (voidgrubs por DTO)

Falta para cerrar:
- `tick_neutral_timers` completo
- `process_dragon_capture`
- `resolve_structure_combat` completo
- `apply_tower_shot_to_champion`
- `apply_damage_to_structure`

---

## 8) Tests

**Estado:** 🟡 EN PROGRESO

Existe transición:
- `src-tauri/src/application/lol_sim_v2/tests_transition.rs`

Falta:
- mover `mod tests` principal fuera de `lol_sim_v2.rs`
- ideal: dividir por dominio (`combat_tests`, `objectives_tests`, `structures_tests`) o `tests.rs` único primero

---

## Orden recomendado a partir de ahora

1. **Cerrar Paso 4** (waves/minions) para recortar muchas líneas rápidas.
2. **Cerrar Paso 5** (vision) para despejar infraestructura transversal.
3. **Terminar Paso 7** (objectives/structures) en bloques grandes controlados.
4. **Terminar Paso 6** (combat pipeline completo).
5. **Cerrar Paso 8** (tests fuera de fachada).

---

## Criterio de “Done” final

`lol_sim_v2.rs` se considera realmente dividido cuando:
- actúa como fachada (mods + reexports + wiring mínimo)
- no contiene bloques de dominio largos
- tests principales ya no viven dentro del archivo raíz

---

## Regla operativa vigente

- Sin commits automáticos.
- Sin build final en estas iteraciones.
- Validación obligatoria por corte: `cargo check -p openleaguemanager` en `src-tauri`.
