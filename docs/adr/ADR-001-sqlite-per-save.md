# ADR-001: SQLite per-save database

**Status:** Accepted  
**Date:** 2026-05-02  
**Deciders:** OLManager maintainers  
**Tags:** persistence, architecture  

## Context

The game needs to persist manager career state — teams, players, staff, fixtures, messages, news, stats — and load it on demand. Two natural approaches exist:

1. A central database with a save slot table  
2. One database file per save  

## Decision

Use **one SQLite database file per save** (`saves/<uuid>.db`). Migrations are applied on each open via `rusqlite-migration`.

## Rationale

- **Isolation:** A corrupt save doesn't affect others. Experimentation (backup, fork, share save files) is trivial.
- **Simplicity:** No need for a save slot CRUD layer — the filesystem *is* the save index.
- **Portability:** Save files can be copied, shared, or debugged with any SQLite tool.
- **Migrations:** Each file independently tracks its schema version via `PRAGMA user_version`. Forward/backward compatibility is per-save, not global.

## Consequences

- Opening a save runs N migrations each time (N = unapplied migrations). Mitigated by caching the database handle via `open_game_db()`.
- Cross-save queries (e.g., "compare two careers") require opening multiple databases. Not a current requirement.
- Save index (`save_index.json`) is a separate file — must stay in sync with `.db` files.

## Alternatives considered

- **Central DB with save slots:** Rejected — higher complexity, lower isolation, harder to debug.
- **JSON files:** Rejected — no query capability, no schema enforcement, harder to migrate.
