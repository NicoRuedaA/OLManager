# ADR-002: Internal Rust crates for bounded contexts

**Status:** Accepted  
**Date:** 2026-05-02  
**Deciders:** OLManager maintainers  
**Tags:** architecture, rust, modularity  

## Context

The Rust backend needs to separate concerns: game state types, simulation engine, gameplay orchestration, and database persistence. Mixing all in one crate leads to coupling and slow compile times.

## Decision

Organize into four internal crates under `src-tauri/crates/`:

| Crate | Responsibility | Depends on |
|-------|---------------|------------|
| `domain` | Pure model types (Player, Team, League, etc.) | Nothing |
| `engine` | Deterministic match simulation (no I/O) | `domain` |
| `ofm_core` | Gameplay orchestration, turn logic, season advancement | `domain`, `engine` |
| `db` | SQLite persistence, migrations, save management | `domain`, `ofm_core` |

The Tauri command layer (`src-tauri/src/commands/`) depends on `ofm_core` + `db` and never depends on `engine` directly.

## Rationale

- **Dependency direction:** `commands → ofm_core → engine → domain` and `commands → db`. No circular dependencies.
- **Testability:** Each crate can be tested in isolation. `engine` has no I/O — ideal for property-based testing.
- **Compile time:** Changes in `domain` don't recompile `engine`. Changes in `engine` don't recompile `db`.
- **Replaceability:** If SQLite is ever replaced, only `db` changes. If the simulation engine is rewritten, only `engine` and potentially `ofm_core` change.

## Consequences

- Crate boundaries must be respected — `commands/` cannot import `engine` directly.
- Some types are duplicated across crate boundaries (e.g., `LolRole` in `domain::stats` and `engine::LolRole`). These must stay in sync.
- `ofm_core` is the largest crate and the most likely to need further splitting.

## Alternatives considered

- **Single crate:** Rejected — 77K LOC across 173 files would be unmanageable.
- **Workspace of micro-crates:** Too granular for a desktop game — four crates hits the right balance.
