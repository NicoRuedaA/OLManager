# OLManager Roadmap

> Open League Manager — Manager de Esports para League of Legends

[![Discord](https://img.sh.shields.io/discord/placeholder?label=Discord&style=social)](https://discord.gg/placeholder)
[![GitHub Stars](https://img.shields.io/github/stars/placeholder?label=Stars&style=social)](https://github.com/placeholder)

## Visión General

OLManager es un manager de esports para League of Legends diseñado para simular la gestión de equipos en competencias profesionales tipo LEC (League of Legends European Championship). El proyecto transita desde su origen en fútbol (OpenFootManager) hacia un sistema completo de gestión de equipos de esports.

**Objetivo estratégico:** Construir una plataforma modular y extensible que permita a los usuarios gestionar equipos, jugadores, presupuestos, estrategias de juego y estadísticas en un entorno de simulación realista.

---

## Estado Actual

| Métrica | Valor |
|--------|-------|
| **Versión** | 0.1.2 (pre-alpha) |
| **Análisis técnico** | `docs/proposals/analisis.md` — 44 hallazgos documentados |
| **Stack** | React 19 + TypeScript 6.0 + Vite 8 + TailwindCSS 4 + Tauri v2 (Rust) |
| **LOC Frontend** | ~71.500 TS/TSX, 228 componentes |
| **LOC Backend** | ~77.000 Rust, 173 archivos, 4 crates |
| **DB** | SQLite per-save (37 migraciones versionadas) |
| **Tests** | 107 frontend (Vitest) + 125 Rust tests (5 legacy rotos) |
| **i18n** | 7 idiomas configurados |
| **Commits** | Conventional commits |

### ✅ Fase 1 Completada (2026-05-02)

La Fase 1 de hardening y foundation está completa. Ver `docs/proposals/analisis.md` para el análisis técnico original.

| Issue resuelto | PR(split) | Estado |
|---------------|-----------|--------|
| Security hardening (path traversal, CSP, capabilities) | #121 (#125) | ✅ |
| StateManager unification (4 Mutex → 1 Session) | #121 (#125) | ✅ |
| Break god files (avatar.rs extraído a game_setup/) | #121 (#125) | ✅ |
| CI/CD audit gates (cargo audit, npm audit, tests blocking) | #121 (#125) | ✅ |
| Legacy tests (123 db tests pass, legacy marcados) | #121 (#125) | ✅ |
| Input validation (validator + Zod) | #121 (#125) | ✅ |
| AppError enum (thiserror + códigos) | #121 (#125) | ✅ |
| Architecture docs (ADRs + Mermaid C4) | #121 (#125) | ✅ |
| Cross-stack types (ts-rs derives en 100+ tipos) | #121 (#125) | ✅ |
| Champions catalog (#64) | #121 (#125) | ✅ |
| Database defutbolization + domain cleanup (#85) | #122 (#126) | ✅ |
| Schema cleanup migrations V37-V42 (#106) | #122 (#126) | ✅ |
| Remove football fields from PlayerSeasonStats (#114) | #122 (#126) | ✅ |
| Engine cleanup: remove football terminology (#109) | #123 (#127) | ✅ |
| Remove home_goals/away_goals from MatchReport (#111) | #123 (#127) | ✅ |
| Replace legacy football engine with simulate_lol (#113) | #123 (#127) | ✅ |
| SetPieceTakers → TeamRoles (#112) | #124 (#128) | ✅ |
| Frontend position→role migration | #124 (#128) | ✅ |
| Unwrap audit (production unwraps → expect) | #124 (#128) | ✅ |

### Deuda Técnica Remanente (post-Fase 1)

- ⚠️ **Componentes monolíticos frontend**: `ChampionDraft.tsx` (3.149 LOC), `MatchSimulation.tsx` (1.922 LOC)
- ⚠️ **`lol_sim_v2.rs` test compilation**: funciones faltantes (6.281 LOC, pre-existing)
- ⚠️ **JSON-en-TEXT**: modelo de datos en SQLite (6 campos en players)
- ⚠️ **100+ warnings de clippy**: pre-existing en workspace, no blocking en CI
- ⚠️ **19 RustSec advisories**: pre-existing, cargo audit non-blocking
- ⚠️ **Football remnants cleanup**: `Position` enum (18 variants) en `domain/src/stats.rs`, `TraitContext::Foul`/`Goalkeeping` en `engine/shared.rs`, `fouls_committed` en legacy mirror de `stats_repo.rs`, y `"Draw"` handling legacy en `match_messages.rs` — todo backward compat que se puede eliminar en v0.3

---

## Fases del Roadmap

### ✅ Fase 1: Hardening y Foundation — COMPLETADA (2026-05-02)

**Objetivo:** Endurecer la seguridad, pagar deuda técnica crítica y establecer CI/CD sólido antes de agregar features.

**Prioridad:** 🔴 Alta — **✅ 100% completado**

#### 🎯 Hitos (todos ✅)

- ✅ **Seguridad**: CSP habilitado, path traversal eliminado en avatar endpoints, capabilities restringidas
- ✅ **CI/CD endurecido**: `cargo audit`, `npm audit`, tests bloqueantes en core crates
- ✅ **Tipos cross-stack**: `ts-rs` integrado con derives en 100+ tipos, feature-gated
- ✅ **Tests legacy**: rotos marcados como `#[ignore]` con tracking issues, `continue-on-error` eliminado
- ✅ **StateManager**: unificado en single `Mutex<Session>` con `with_session()`/`with_session_mut()`

#### PRs de Fase 1 (splits)

| PR | Issue | Descripción |
|----|-------|-------------|
| [#121](https://github.com/OpenLeagueManager/OLManager/pull/121) | [#125](https://github.com/OpenLeagueManager/OLManager/issues/125) | Champions, ts-rs, CI/CD, security, docs, StateManager, validation, AppError |
| [#122](https://github.com/OpenLeagueManager/OLManager/pull/122) | [#126](https://github.com/OpenLeagueManager/OLManager/issues/126) | Domain cleanup, DB migrations V33-V42, football_nation removal, ofm_core adaptation |
| [#123](https://github.com/OpenLeagueManager/OLManager/pull/123) | [#127](https://github.com/OpenLeagueManager/OLManager/issues/127) | Engine migration: football→LoL events, MatchConfig, simulate_lol |
| [#124](https://github.com/OpenLeagueManager/OLManager/pull/124) | [#128](https://github.com/OpenLeagueManager/OLManager/issues/128) | Frontend position→role, SetPieceTakers→TeamRoles, fixes, unwrap audit |

---

### Fase 2: Estabilización, Features Core y Release Beta — Mediano Plazo (v0.3 Beta)

**Objetivo:** Pagar deuda técnica restante de Fase 1, estabilizar simulación, implementar features core de gestión y release beta.

**Prioridad:** 🟡 Media

#### 🎯 Hitos

- [ ] 🔲 **Fase 1 cleanup**: completar items que quedaron pendientes
- [ ] 🔲 **Football remnants purge**: eliminar `Position` enum legacy, `TraitContext::Foul`/`Goalkeeping`, `fouls_committed` de stats_repo legacy mirror, y `"Draw"` handling en match_messages — dejar solo backward compat estrictamente necesario
- [ ] 🔲 **Motor de simulación**: lol_sim_v2 compilando + live_match funcional
- [ ] 🔲 **AppError + i18n**: migración completa de todos los comandos
- [ ] 🔲 **Sistema de temporada completa**: Winter/Spring/Summer/Season Finals
- [ ] 🔲 **Sistema de finanzas**: presupuesto, salarios, transferencias
- [ ] 🔲 **Dashboard de estadísticas del equipo**
- [ ] 🔲 **Release beta**: v0.3.0-beta taggeada y publicada

#### 📋 Tareas

##### ✅ Phase 1: LoL Migration — COMPLETE

- [x] **Engine crate cleanup (#109)**: terminología de fútbol eliminada del engine (EventType, TeamStats, MatchConfig, Snapshot, PlayerMatchStats, fouls.rs → eliminado, resolution.rs → eliminado)
- [x] **Legacy engine reemplazado (#113)**: `engine::simulate()` → `simulate_lol()` basado en `LiveMatchState`
- [x] **home_goals/away_goals eliminados (#111)**: campos redundantes quitados de `MatchReport`
- [x] **SetPieceTakers → TeamRoles (#112)**: reemplazado en engine + domain + DB + frontend
- [x] **Domain football fields eliminados (#114)**: `goals`/`yellow_cards`/`red_cards`/`fouls_committed` de `PlayerSeasonStats`
- [x] **MatchRoles → TeamRoles**: V41 migration + domain rename + frontend types
- [x] **V42 migration**: columnas muertas eliminadas de `teams` (`football_nation`, `match_roles`, `nationality_code`)
- [x] **Seed data convertido**: `lec_world.json` posiciones de fútbol → roles LoL
- [x] **Bug fixes post-migración**: role vs position (7 componentes frontend), PreMatchSetup, ChampionDraft, etc.
- [x] **ts-rs typegen**: binary + derives para generación de tipos TypeScript

##### 🧹 Fase 2 Cleanup (prioridad: 🔴 alta)

- [ ] **Cross-stack type generation (#93)**: annotar ~58 tipos restantes con `#[derive(TS)]`, generar `bindings.ts`
- [ ] **AppError full migration**: migrar todos los comandos (>50) de `Result<T, String>` a `Result<T, AppError>`
- [ ] **Bug fixes pendientes**: #88 (split review), #84 (OVR formulas), #38 (player persistence), #39 (season progression), #37 (BO3 repeat), #35 (6-man roster), #33 (gold/items), #2 (MacOS)
- [ ] **Pre-existing clippy cleanup**: resolver ~100 warnings heredados en workspace

##### 🏗️ Arquitectura y DX (prioridad: 🟡 media)

- [ ] **`tracing` migration**: reemplazar `log` por `tracing` + `tracing-subscriber` con spans por comando Tauri
- [ ] **Logging config**: `Info` en release, `Debug` opt-in, rotación `KeepN(10)` (50 MB tope)
- [ ] **Componentes monolíticos frontend**: romper `ChampionDraft.tsx` (3.149 LOC), `MatchSimulation.tsx` (1.922 LOC) en Container/Presentational
- [ ] **`useEffect` audit**: activar `eslint-plugin-react-hooks/exhaustive-deps: error`, migrar fetch a TanStack Query
- [ ] **Fix `ChampionRuntime` visibility**: warning `private_interfaces` en `lol_sim_v2.rs`
- [ ] **Rust profile tuning**: añadir `[profile.release]` con LTO, strip, panic=abort

##### 🎮 Gameplay Engine — LoL Simulation (prioridad: 🔴 alta)

- [ ] **Sistema de ítems**: items afectan stats reales (AD, AP, armor, etc.)
  - [ ] Struct `Item` con stats, costo, build path
  - [ ] Auto-buy inteligente por rol
  - [ ] Items de soporte con gold generation
  - [ ] Componentes y items completos (recetas)
- [ ] **Champion abilities diferenciadas**
  - [ ] Pasiva + Q/W/E/R con scalings (AD/AP)
  - [ ] Tipos de daño: físico, mágico, verdadero
  - [ ] Ultimates con cooldown largo y momento decisivo
  - [ ] Unique passives por champion
- [ ] **Wave management + farmeo**
  - [ ] Oleadas de minions cada 30s
  - [ ] Last hit da gold (no solo gold pasivo)
  - [ ] Congelar / pushear líneas como decisión táctica
  - [ ] CS como métrica de rendimiento
- [ ] **Jungla + objetivos neutros**
  - [ ] Campamentos con respawn (Gromp, Wolves, Raptors, Krugs, Blue/Red)
  - [ ] Pathing y ganks tempranos
  - [ ] Dragones elementales (Infernal, Mountain, Cloud, Ocean, Hextech, Chemtech)
  - [ ] Herald y Baron con buffs reales
- [ ] **Sistema de visión**
  - [ ] Wards trinket (amarilla) y control ward (rosa)
  - [ ] Vision score como métrica
  - [ ] Stealth y detección
- [ ] **Power spikes por fase del juego**
  - [ ] Early game (0-15 min): fase de líneas
  - [ ] Mid game (15-30 min): rotaciones, objectives
  - [ ] Late game (30+ min): team fights decisivos
  - [ ] Escalado por nivel de champion

##### 🎮 Features Core (prioridad: 🟡 media)

- [ ] **Calendario de temporada**: implementar splits LEC (Winter/Spring/Summer) + Season Finals
  - [ ] Generación de fixtures para Spring y Summer split
  - [ ] Playoffs por split (top 6/8)
  - [ ] Season Finals con Championship Points
  - [ ] UI de calendario en Dashboard
- [ ] **Sistema de finanzas**:
  - [ ] Presupuesto por temporada (salary cap)
  - [ ] Contratos multi-año con incrementos
  - [ ] Renovaciones y cláusulas de rescisión
  - [ ] Patrocinadores con objetivos
- [ ] **Mercado de transferencias**:
  - [ ] Ventana de transferencias (Offseason / Mid-season)
  - [ ] Free agency con negociación
  - [ ] Trades entre equipos
  - [ ] UI de mercado en TransfersTab
- [ ] **Modo espectador**: ver partidos sin interactuar (skip mode existente, pulir visualización)
- [ ] **Dashboard de estadísticas**: visualizaciones de rendimiento del equipo (KDA, gold dif, visión, etc.)
- [ ] **Staff management**: contratar/despedir coaches, scouts, analysts con efectos en gameplay
- [ ] **Documentar API de comandos Tauri**: listado de comandos, params, returns

##### 🧪 Testing (prioridad: 🟢 baja)

- [ ] Añadir **Playwright** smoke tests (5 flujos críticos: crear → avanzar → simular → guardar → recargar)
- [ ] Añadir **`proptest`** para propiedades del motor de simulación

#### Métricas de Éxito

- ✅ Todos los comandos usan `AppError` con códigos i18n
- ✅ `lol_sim_v2` compila y pasa tests
- ✅ Usuario puede completar temporada completa (Winter→Spring→Summer→Season Finals)
- ✅ Sistema de finanzas funcional (presupuesto > 0 después de gastos)
- ✅ Ventana de transferencias operativa
- ✅ `engine` crate sin terminología de fútbol (EventType, TeamStats, fouls.rs)
- ✅ Release beta (v0.3.0-beta) taggeada y publicada
- ✅ Logging estructurado con spans por comando

---

### Fase 3: Ecosistema y Distribución — Largo Plazo (v1.0 Stable)

**Objetivo:** Construir ecosistema completo, abrir a comunidad, distribuir con actualizaciones automáticas y alcanzar estabilidad de producción.

**Prioridad:** 🟢 Baja

#### 🎯 Hitos

- [ ] 🔲 Sistema de scouting (buscar jugadores en el mercado)
- [ ] 🔲 Competiciones y rankings multi-temporada
- [ ] 🔲 **`tauri-plugin-updater`** con auto-update y firmas
- [ ] 🔲 **Firma de binarios**: Windows EV + macOS Developer ID + GPG signatures
- [ ] 🔲 **Perfil release optimizado**: LTO, codegen-units=1, strip, panic=abort
- [ ] 🔲 Modo multijugador básico (compartir partidas)
- [ ] 🔲 Primera release estable (v1.0.0)
- [ ] 🔲 Publicación OSS (anuncio oficial)

#### 📋 Tareas

- [ ] Implementar mercado de transferencias
- [ ] Crear sistema de ligas/torneos con estadísticas
- [ ] Añadir otras regiones (LCK, LCS, LPL, PCS, VCS)
- [ ] Configurar `tauri-plugin-updater` con endpoint en GitHub Releases
- [ ] Firmar manifests con minisign/ed25519
- [ ] Firmar Windows con certificado EV (DigiCert/SSL.com)
- [ ] Notarizar macOS con Apple Developer ID
- [ ] Publicar SHA256 de cada artefacto + GPG signature en el tag
- [ ] Configurar `[profile.release]` con LTO, strip, panic=abort
- [ ] Desarrollar API REST pública (opcional)
- [ ] Configurar containerización (Docker para simulación headless)
- [ ] Escribir documentación completa para contribuyentes

#### Métricas de Éxito

- ✅ v1.0.0 publicada con changelog y firmas
- ✅ `tauri-plugin-updater` funcional (auto-update de alpha a stable)
- ✅ Comunidad puede contribuir siguiendo flow issue-first
- ✅ docs/ actualizada para usuarios y desarrolladores

---

## Proceso de Trabajo

### Flujo Issue-First

Siguiendo [`GOVERNANCE.md`](../GOVERNANCE.md), el desarrollo sigue este flujo:

```
1. Abrir issue con template → 2. Review de maintainer → 3. Apply label status:approved
4. Crear branch desde development → 5. Abrir PR con type:* label → 6. Merge a development
```

### Labels Utilizados

| Categoría | Labels |
|-----------|--------|
| **Status** | `status:needs-review`, `status:approved` |
| **Type** | `type:feature`, `type:bug`, `type:docs`, `type:chore`, `type:refactor`, `type:test`, `type:release`, `type:security` |

### Ramas

- `main` — Estable, solo releases
- `development` — Integración (default para PRs)
- `type/slug` — Ramas de feature/fix/docs/chore

---

## Métricas de Progreso

### KPIs por Fase

| Fase | KPI Principal | KPI Secundario |
|------|---------------|----------------|
| **Fase 1** | ✅ **Completada**. 9/9 issues, 4 PRs mergeados | CI tests: core crates pasan |
| **Fase 2** | Features core: 6 (season, finances, transfers, sim, dashboard, staff) | Release beta publicada |
| **Fase 3** | v1.0.0 released | Auto-updater funcional |

### Badges de Progreso

```markdown
[![Version](https://img.shields.io/badge/version-0.1.2-blue)](ROADMAP.md)
[![Phase](https://img.shields.io/badge/phase-1-green)](ROADMAP.md)
[![CI Status](https://img.shields.io/github/checks-status/placeholder/development)](actions)
```

---

## Cómo Seguir el Progreso

- **Roadmap (este archivo)** — Estado general y fases
- **`docs/proposals/analisis.md`** — Análisis técnico completo con 44 hallazgos detallados
- **GitHub Issues** — Tareas individuales con labels
- **GitHub Project Board** — Vista kanban del desarrollo
- **GitHub Releases** — Changelogs y downloads
- **Discussions** — Q&A y feedback comunitario

---

## Cómo Contribuir

¡Todas las contribuciones son bienvenidas! Para contribuir:

1. **Revisa issues abiertos** — Busca `status:approved` para trabajo confirmado
2. **Abre un issue** — Usa el template para bugs o features
3. **Espera approval** — Un maintainer revisará y aplicará `status:approved`
4. **Crea tu branch** — Desde `development` con formato `type/slug`
5. **Abre PR** — Linkea el issue, añade un `type:*` label
6. **Pasa CI** — Ensure `frontend-install` y `rust-check` pasan

### Requisitos de PR

- [ ] Branch desde `development`
- [ ] Issue linkeado con label `status:approved`
- [ ] Exactly uno `type:*` label
- [ ] Commits conventional
- [ ] Checks: `frontend-install` + `rust-check`

### Configuración Local

```bash
# Frontend
npm install
npm run dev

# Backend (Rust)
cargo build --workspace
cargo test --workspace

# full CI
npm run test
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

---

## Historial de Versiones

| Versión | Fecha | Notas |
|---------|-------|-------|
| 0.1.2 | 2026-05-02 | Pre-alpha actual. **Fase 1 completada** (9/9 issues) |
| 0.2.0-alpha | ⏳ Pendiente | Alpha con Phase 1 cleanup y Fase 2 features |
| 0.3.0-beta | ⏳ Pendiente | Beta con features core + release |
| 1.0.0 | ⏳ Pendiente | Primera stable con auto-updater |

---

*Última actualización: 2026-05-02 — Roadmap actualizado tras análisis técnico arquitectónico (`docs/proposals/analisis.md`)*
