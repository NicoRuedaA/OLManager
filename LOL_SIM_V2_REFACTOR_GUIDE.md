# LOL Sim V2 Refactor Guide

## Guía de archivos (ES)

Esta sección resume **qué hace cada archivo** de `lol_sim_v2` y **qué datos/funciones son clave** para continuar programando.

### Fachada y API

- `src-tauri/src/application/lol_sim_v2.rs`
  - **Rol:** Fachada principal del simulador.
  - **Importante:**
    - Declara `mod ...` de todos los submódulos.
    - Expone/reexporta tipos y funciones públicas consumidas por commands Tauri.
    - Ya no debe contener lógica de dominio grande; si aparece, moverla al módulo dueño.

- `src-tauri/src/application/lol_sim_v2/runtime.rs`
  - **Rol:** Orquestación runtime pública.
  - **Importante:**
    - `init`, `tick`, `reset`, `dispose`, `run_to_completion`, `skip_to_end`.
    - Punto central del ciclo de simulación; mantiene wiring entre módulos.

- `src-tauri/src/application/lol_sim_v2/api.rs`
  - **Rol:** Contratos de entrada/salida y config del simulador.
  - **Importante:**
    - DTOs request/response usados por commands.
    - Cualquier cambio aquí impacta frontend/commands.

- `src-tauri/src/application/lol_sim_v2/session.rs`
  - **Rol:** Estado de sesión/store en runtime.
  - **Importante:**
    - Modelo de sesión activa.
    - Helpers de lifecycle del store.

### Inicialización / Bootstrap

- `src-tauri/src/application/lol_sim_v2/state_init.rs`
  - **Rol:** Construcción del estado inicial.
  - **Importante:**
    - `default_runtime_state`
    - `ensure_runtime_state_defaults`
    - `build_team_tactics_state`
    - `build_neutral_timers_state`
    - `create_initial_state`

- `src-tauri/src/application/lol_sim_v2/layout.rs`
  - **Rol:** Layout estático de mapa/estructuras/paths base.
  - **Importante:**
    - Posiciones base, seeds de roles, layout de estructuras/líneas.

### Dominios de simulación

- `src-tauri/src/application/lol_sim_v2/waves.rs`
  - **Rol:** Spawn de oleadas y creación de minions.
  - **Importante:**
    - `spawn_waves_if_due`, `spawn_wave`, `build_minion`.

- `src-tauri/src/application/lol_sim_v2/minions.rs`
  - **Rol:** Movimiento/combate de minions y presión estructural básica.
  - **Importante:**
    - `move_minions`, `resolve_minion_combat`.

- `src-tauri/src/application/lol_sim_v2/vision.rs`
  - **Rol:** Sistema de visión (wards/sweeper/checks).
  - **Importante:**
    - `team_has_vision_at`, `place_wards`, `process_sweepers`.

- `src-tauri/src/application/lol_sim_v2/pathing.rs`
  - **Rol:** Movimiento/pathing y utilidades de posicionamiento.
  - **Importante:**
    - `move_champions`.
    - Helpers de anclaje lane/wave front/pressure usados por macro/trading.

- `src-tauri/src/application/lol_sim_v2/macro_ai.rs`
  - **Rol:** Decisión macro de campeones.
  - **Importante:**
    - `decide_champion_state`.
    - Selección de objetivos, rotación, disengage macro, lógica de prioridades de jungla.

- `src-tauri/src/application/lol_sim_v2/trading.rs`
  - **Rol:** Evaluación de trades en lane.
  - **Importante:**
    - `evaluate_open_trade_window`, `evaluate_disengage_champion_trade`.
    - Cálculo de confianza/ventana de intercambio.

- `src-tauri/src/application/lol_sim_v2/combat.rs`
  - **Rol:** Pipeline de combate de campeones.
  - **Importante:**
    - `resolve_champion_combat`.
    - `pick_combat_target`.
    - Reglas de priorización/selección de target y ejecución de combate.

- `src-tauri/src/application/lol_sim_v2/objectives.rs`
  - **Rol:** Objetivos neutrales y ciclo de dragones/elder/baron/herald.
  - **Importante:**
    - `tick_neutral_timers`, `process_dragon_capture`.
    - Sync de estado de objetivos y reglas de unlock/spawn.

- `src-tauri/src/application/lol_sim_v2/structures.rs`
  - **Rol:** Torres/inhibidores/nexus y daño a estructuras.
  - **Importante:**
    - `resolve_structure_combat`.
    - `apply_tower_shot_to_champion`.
    - `apply_damage_to_structure`.

- `src-tauri/src/application/lol_sim_v2/economy.rs`
  - **Rol:** Reglas de recompensas/economía.
  - **Importante:**
    - kill rewards y helpers económicos usados por combate/objetivos.

- `src-tauri/src/application/lol_sim_v2/util.rs`
  - **Rol:** Helpers puros compartidos.
  - **Importante:**
    - utilidades matemáticas y helpers genéricos de estado/serde.

- `src-tauri/src/application/lol_sim_v2/types.rs`
  - **Rol:** Tipos runtime transversales.
  - **Importante:**
    - structs base de entidades/runtime compartidos entre módulos.

- `src-tauri/src/application/lol_sim_v2/events.rs`
  - **Rol:** Registro/emisión de eventos runtime.
  - **Importante:**
    - helpers para push/log de eventos consumidos por UI/reportes.

### Tests

- `src-tauri/src/application/lol_sim_v2/test_helpers.rs`
  - **Rol:** Fixtures/helpers compartidos de tests.
  - **Importante:**
    - `test_champion`, `test_minion`, `test_structure`, `test_runtime`, `test_neutral_timer`, `empty_neutral`.

- `src-tauri/src/application/lol_sim_v2/runtime_tests.rs`
- `src-tauri/src/application/lol_sim_v2/combat_tests.rs`
- `src-tauri/src/application/lol_sim_v2/objectives_tests.rs`
- `src-tauri/src/application/lol_sim_v2/structures_tests.rs`
- `src-tauri/src/application/lol_sim_v2/vision_tests.rs`
- `src-tauri/src/application/lol_sim_v2/macro_ai_tests.rs`
  - **Rol:** suites de tests por dominio.
  - **Importante:**
    - agregar casos nuevos en el módulo de dominio correcto.

---

## File Guide (EN)

This section summarizes **what each file does** in `lol_sim_v2` and the **most important data/functions** for future development.

### Facade and API

- `src-tauri/src/application/lol_sim_v2.rs`
  - **Role:** Main simulator facade.
  - **Key points:**
    - Declares `mod ...` for all submodules.
    - Reexports public types/functions consumed by Tauri commands.
    - Should not host large domain logic anymore.

- `src-tauri/src/application/lol_sim_v2/runtime.rs`
  - **Role:** Public runtime orchestration.
  - **Key points:**
    - `init`, `tick`, `reset`, `dispose`, `run_to_completion`, `skip_to_end`.
    - Central simulation loop wiring.

- `src-tauri/src/application/lol_sim_v2/api.rs`
  - **Role:** Simulator input/output contracts and config.
  - **Key points:**
    - Request/response DTOs used by commands.
    - Changes here affect frontend + command layer.

- `src-tauri/src/application/lol_sim_v2/session.rs`
  - **Role:** Runtime session/store state.
  - **Key points:**
    - Active session model and lifecycle helpers.

### Initialization / Bootstrap

- `src-tauri/src/application/lol_sim_v2/state_init.rs`
  - **Role:** Initial state creation/bootstrap.
  - **Key points:**
    - `default_runtime_state`
    - `ensure_runtime_state_defaults`
    - `build_team_tactics_state`
    - `build_neutral_timers_state`
    - `create_initial_state`

- `src-tauri/src/application/lol_sim_v2/layout.rs`
  - **Role:** Static map/structure/base layout data.
  - **Key points:**
    - Base positions, role seeds, lane/structure layout constants.

### Simulation domains

- `src-tauri/src/application/lol_sim_v2/waves.rs`
  - **Role:** Wave spawning and minion construction.
  - **Key points:**
    - `spawn_waves_if_due`, `spawn_wave`, `build_minion`.

- `src-tauri/src/application/lol_sim_v2/minions.rs`
  - **Role:** Minion movement/combat and structure pressure basics.
  - **Key points:**
    - `move_minions`, `resolve_minion_combat`.

- `src-tauri/src/application/lol_sim_v2/vision.rs`
  - **Role:** Vision system (wards/sweeper/checks).
  - **Key points:**
    - `team_has_vision_at`, `place_wards`, `process_sweepers`.

- `src-tauri/src/application/lol_sim_v2/pathing.rs`
  - **Role:** Movement/pathing and positioning utilities.
  - **Key points:**
    - `move_champions`.
    - lane anchor/wave front/pressure helpers used by macro/trading.

- `src-tauri/src/application/lol_sim_v2/macro_ai.rs`
  - **Role:** Champion macro decision system.
  - **Key points:**
    - `decide_champion_state`.
    - objective selection, rotation/disengage, jungle macro priorities.

- `src-tauri/src/application/lol_sim_v2/trading.rs`
  - **Role:** Lane trading evaluation.
  - **Key points:**
    - `evaluate_open_trade_window`, `evaluate_disengage_champion_trade`.
    - trade confidence/window calculations.

- `src-tauri/src/application/lol_sim_v2/combat.rs`
  - **Role:** Champion combat pipeline.
  - **Key points:**
    - `resolve_champion_combat`.
    - `pick_combat_target`.
    - target priority/selection and combat execution rules.

- `src-tauri/src/application/lol_sim_v2/objectives.rs`
  - **Role:** Neutral objectives and dragon/elder/baron/herald cycle.
  - **Key points:**
    - `tick_neutral_timers`, `process_dragon_capture`.
    - objective state sync and unlock/spawn rules.

- `src-tauri/src/application/lol_sim_v2/structures.rs`
  - **Role:** Towers/inhibitors/nexus and structure damage.
  - **Key points:**
    - `resolve_structure_combat`.
    - `apply_tower_shot_to_champion`.
    - `apply_damage_to_structure`.

- `src-tauri/src/application/lol_sim_v2/economy.rs`
  - **Role:** Rewards/economy rules.
  - **Key points:**
    - kill reward/economy helpers used by combat/objectives.

- `src-tauri/src/application/lol_sim_v2/util.rs`
  - **Role:** Shared pure helpers.
  - **Key points:**
    - math + generic serde/state utilities.

- `src-tauri/src/application/lol_sim_v2/types.rs`
  - **Role:** Cross-module runtime types.
  - **Key points:**
    - core runtime/entity structs shared across modules.

- `src-tauri/src/application/lol_sim_v2/events.rs`
  - **Role:** Runtime event logging/publishing.
  - **Key points:**
    - event push/log helpers consumed by UI/reporting.

### Tests

- `src-tauri/src/application/lol_sim_v2/test_helpers.rs`
  - **Role:** Shared test fixtures/builders.
  - **Key points:**
    - `test_champion`, `test_minion`, `test_structure`, `test_runtime`, `test_neutral_timer`, `empty_neutral`.

- `src-tauri/src/application/lol_sim_v2/runtime_tests.rs`
- `src-tauri/src/application/lol_sim_v2/combat_tests.rs`
- `src-tauri/src/application/lol_sim_v2/objectives_tests.rs`
- `src-tauri/src/application/lol_sim_v2/structures_tests.rs`
- `src-tauri/src/application/lol_sim_v2/vision_tests.rs`
- `src-tauri/src/application/lol_sim_v2/macro_ai_tests.rs`
  - **Role:** Domain-oriented test suites.
  - **Key points:**
    - Add new tests in the relevant domain file instead of root.

---

## Nota final de hygiene pass

**Estado:** ✅ COMPLETADO

Aplicado cleanup final sin cambiar API externa de Tauri ni comportamiento runtime:
- `src-tauri/src/application/lol_sim_v2.rs`
  - removido alias interno de transición para `build_neutral_timers_state`.
  - eliminado wiring de `tests_transition` en raíz para dejar façade/test wiring más limpio.
- `src-tauri/src/application/lol_sim_v2/combat_tests.rs`
  - absorbidos los tests útiles que estaban en `tests_transition.rs`.
- `src-tauri/src/application/lol_sim_v2/tests_transition.rs`
  - eliminado (archivo de transición ya innecesario).
- `src-tauri/src/commands/lol_sim_v2.rs`
  - removidos aliases `*_service` y llamadas indirectas redundantes; comandos ahora llaman directo a los reexports de la façade.

Validación del corte:
- `cargo check -p openleaguemanager` en `src-tauri`: **OK**.
