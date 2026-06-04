# OLManager — Project Status

> **Last updated:** 22-MAY-2026
> **Version:** 0.2.1
> **Status:** Pre-alpha

This document is a single source of truth for the current health of the project. It is meant for contributors and maintainers to quickly understand what works, what's broken, and what's next.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + TypeScript + Vite | 19.2 / ~6.0 / 8 |
| Desktop | Tauri | 2.10 |
| Backend | Rust | 1.80+ (edition 2024) |
| CSS | Tailwind CSS | 4 |
| State | Zustand | latest |
| Persistence | SQLite (per-save) | rusqlite 0.32.1 |
| Testing (FE) | Vitest + Testing Library | 4.1.2 |
| Testing (E2E) | Playwright | 1.59 |
| Testing (BE) | Cargo test | — |

### Repository Structure

```
OLManager/
├── src/                    # Frontend (React + TS) ~71.5K LOC
│   ├── pages/              # Route pages (7)
│   ├── components/         # UI features by domain (~36)
│   ├── services/           # Typed Tauri invoke wrappers (10)
│   ├── store/              # Zustand stores
│   ├── lib/                # Pure utilities (37 files)
│   ├── hooks/              # React hooks
│   └── i18n/               # 8 locales
├── src-tauri/              # Backend (Rust) ~77K LOC
│   ├── src/
│   │   ├── commands/       # Tauri IPC handlers (22 modules)
│   │   └── application/    # Application services (8 modules)
│   └── crates/
│       ├── domain/         # Pure domain types
│       ├── engine/         # Match simulation (pure, no I/O)
│       ├── ofm_core/       # Gameplay orchestration (43 files)
│       └── db/             # Persistence layer (10 files, 52 migrations)
├── docs/                   # Documentation
└── data/                   # Seed data (players, worlds)
```

---

## What's Working

- ✅ **Core gameplay loop**: Team management, transfers, match simulation (LoL)
- ✅ **Match simulation**: `lol_sim_v2` refactored into 25 well-structured submodules
- ✅ **Persistence**: Per-save SQLite with save index + SHA2 checksums. 52 migrations.
- ✅ **Testing**: 55+ frontend test files, 22 Rust integration tests. Vitest + Playwright.
- ✅ **CI/CD**: GitHub Actions with PR and release pipelines
- ✅ **Documentation**: ARCHITECTURE.md, ADRs, GOVERNANCE.md, CONTRIBUTING.md
- ✅ **i18n**: 8 locales (en, es, pt, fr, de, it, pt-BR, tr) with football→LoL migration guards
- ✅ **Architecture**: Hexagonal Rust with clear dependency direction (`domain ← engine ← ofm_core ← db ← commands ← frontend`)

---

## What's Broken

| Issue | Severity | Details |
|-------|----------|---------|
| CSP disabled (`"csp": null`) | 🔴 Critical | No Content Security Policy — XSS in a Tauri app can lead to RCE |
| Security audits non-blocking | 🟡 High | `cargo audit`, `npm audit`, `clippy` all set to `continue-on-error: true` |
| `lol_sim_v2` crate tests blocked | 🟡 High | Tests in the main simulation crate don't compile due to missing dependencies |
| GameState IPC overload | 🟡 Medium | Entire game state sent over IPC on every tab switch — bottleneck at scale |

---

## Technical Debt

### Football→LoL Remnants

**53 issues cataloged** in [`DEUDA_TECNICA_FUTBOL.md`](DEUDA_TECNICA_FUTBOL.md):

| Priority | Count | Examples |
|----------|-------|---------|
| Critical | 14 | Position enum, formation, goals/clean_sheets, stadium_name, CORE_POSITIONS |
| Medium | 22 | Seed data, i18n keys, tests, squad helpers, logos |
| Low | 17 | Comments, changelog, proposals, test data naming |

Current state: **0/53 resolved**. This is the largest single cleanup effort ahead.

### Documentation Debt

- `docs/propose/` and `docs/proposals/` were inconsistent directories — **fixed** (22-MAY-2026)
- `README.md` had stale badges and merge residual — **fixed** (22-MAY-2026)
- `transfer.md` was at project root — **fixed** (22-MAY-2026)
- `ROADMAP.md` had a broken link — **fixed** (22-MAY-2026)
- No centralized `STATUS.md` before this file

---

## Risks

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | CSP disabled allows XSS → RCE | 🔴 Critical | Medium | Enable CSP (1-line change) |
| 2 | `lol_sim_v2` tests blocked → regressions undetected | 🟡 High | High | Fix test dependencies |
| 3 | TypeScript 6.0 bleeding edge | 🟡 Medium | Low | Pin stable version if issues arise |
| 4 | Rust edition 2024 very recent | 🟢 Low | Low | Monitor compatibility |
| 5 | GameState IPC grows unbounded | 🟡 Medium | Medium | Implement partial updates |
| 6 | CI non-blocking hides failures | 🟡 Medium | Medium | Make security checks blocking |

---

## What's Next

Recommended roadmap: [`docs/proposals/ROADMAP.md`](proposals/ROADMAP.md)

| Phase | Focus | Effort | Priority |
|-------|-------|--------|----------|
| 1 — Critical | CSP, security audits, test fixes, god component refactors | Days | 🔴 |
| 2 — Structural | Split `team.rs` (1.2K LOC), `transfers.rs` (2.1K LOC), partial IPC | 1-2 weeks | 🟡 |
| 3 — Cleanup | Football remnants (53 items), SQL orphans, clippy | 2-4 weeks | 🟡 |
| 4 — Hardening | Dependabot, CodeQL, capabilities review | Long-term | 🟢 |

---

## For New Contributors

1. Read [`CONTRIBUTING.md`](../CONTRIBUTING.md) first
2. Architecture overview: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
3. Governance model: [`docs/GOVERNANCE.md`](GOVERNANCE.md)
4. Check open issues with `status:approved` label — those are ready for PRs
5. Branch from `development`, PRs target `development`
6. All PRs require an issue with `status:approved` — issue-first workflow

### Quick Start

```bash
# Clone and enter
git clone https://github.com/OpenLeagueManager/OLManager.git
cd OLManager

# Frontend
npm install
npm run dev          # Vite dev server

# Backend (requires Rust 1.80+)
cargo install tauri-cli --version "^2"
cargo tauri dev      # Full app with hot reload

# Tests
npm test             # Frontend
cargo test           # Backend
```

---

*This file is a living document. Update it when project status changes.*
