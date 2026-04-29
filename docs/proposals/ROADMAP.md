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
| **Versión** | 0.1.1 (pre-alpha) |
| **Stack** | React 19 + TypeScript 6.0 + Vite 8 + TailwindCSS 4 + Tauri v2 (Rust) |
| **DB** | SQLite (27 migraciones) |
| **Test Files** | 106 frontend + 21 backend Rust |
| **i18n** | 7 idiomas configurados |
| **Commits** | Conventional commits |
| **PR Activo** | `QoL-UI` - 23 commits, ready for merge |

### Features Recientes (QoL-UI Branch)

✅ **Implementadas:**
- Role icons system (TOP, JUNGLE, MID, ADC, SUPPORT)
- Player photos en PlayersList y TransfersTab
- LEC logo en torneos
- OVR en perfil de jugador
- Manager avatar removido (simplificación)

### Deuda Técnica Identificada

- ⚠️ Herencia de nombres/estructuras del proyecto original de fútbol
- ⚠️ Documentación legacy en `docs/legacy/inherited-docs/`
- ⚠️ 2 TODOs pendientes en `lol_sim_v2.rs` (sistema de movimiento)
- ⚠️ Tests de Rust marcados como "experimental" en CI

---

## Fases del Roadmap

### Fase 1: Limpieza y Foundation — Corto Plazo (v0.2 Alpha)

**Objetivo:** Eliminar la deuda técnica de la transición fútbol→LoL y establecer las bases para desarrollo estable.

**Prioridad:** 🔴 Alta

#### 🎯 Hitos

- [ ] ✅ ~~Completar auditoría de documentación heredada~~ (existe: `INHERITED_DOCS_AUDIT.md`)
- [ ] 🔲 Finalizar limpieza de nombres y estructuras de fútbol
- [ ] 🔲 Documentar Provenance de datos heredados (`DATA_PROVENANCE.md` completo)
- [ ] 🔲 Eliminar TODOs pendientes en `lol_sim_v2.rs`
- [ ] 🔲 Establecer CI estable (resolver tests "experimentales")

#### 📋 Tareas

- [ ] Renombrar tipos domain de "Player/Team/Football" a terminología LoL
- [ ] Actualizar migraciones SQLite con prefijos o limpieza
- [ ] Revisar `docs/legacy/inherited-docs/` y marcar lo obsoleto
- [ ] Completar puerto de sistema de movimiento en lol_sim_v2.rs
- [ ] Habilitar `cargo clippy` y `cargo test` en CI principal
- [ ] Crear documento de migración de datos (fútbol → LoL)
- [ ] **Migración de identidad**: `football_nation` → `nationality_code` + `competitive_region`
  - [ ] Crear migración SQL v028 (`RENAME COLUMN football_nation → nationality_code` + `ADD COLUMN competitive_region TEXT`)
  - [ ] Actualizar tipos Rust (`Player`, `Team`, `Manager`, `Staff`) con ambos campos
  - [ ] Actualizar frontend (tipos TypeScript, componentes UI, filtros por región)
  - [ ] Actualizar scripts de generación (`generate-lec-world.mjs`)
  - [ ] **Nota importante**: En LoL, "región" y "nacionalidad" son conceptos DISTINTOS:
    - `nationality_code` → país de origen del jugador (ej: "KR", "ES", "FR")
    - `competitive_region` → liga donde compite (ej: "LCK", "LEC", "LCS")
    - Un jugador coreano (`nationality_code: "KR"`) puede competir en `LEC`

#### Métricas de Éxito

- ✅ 0 TODOs activos en código de producción
- ✅ 100% coverage en CI (no más "experimental")
- ✅ Documentación heredada auditada y categorizada

---

### Fase 2: Estabilización y Features Core — Mediano Plazo (v0.3 Beta)

**Objetivo:** Implementar funcionalidades core del manager y estabilizar el producto para uso interno.

**Prioridad:** 🟡 Media

#### 🎯 Hitos

- [ ] 🔲 Sistema de roster/plantel completo (contratar/despedir jugadores)
- [ ] 🔲 Simulación de partidos funcional (más allá de LoL-sim v2)
- [ ] 🔲 Sistema de finanzas (presupuesto, salarios, patrocinadores)
- [ ] 🔲 Dashboard de estadísticas del equipo
- [ ] 🔲 Primera release beta (v0.3.0-beta)

#### 📋 Tareas

- [ ] Implementar modelo de jugador con stats LoL (KDA, rol, división)
- [ ] Crear sistema de contratos y salarios
- [ ] Desarrollar motor de simulación de partidos
- [ ] Implementar sistema de calendario de temporadas
- [ ] Añadir visualización de estadísticas en tiempo real
- [ ] Configurar logging estructurado para debugging
- [ ] Documentar API de comandos Tauri

#### Métricas de Éxito

- ✅ Usuario puede crear equipo, gestionar roster y simular partido
- ✅ Sistema de finances funcional (presupuesto > 0 después de gastos)
- ✅ Release beta publicada y taggeada

---

### Fase 3: Ecosistema y Comunidad — Largo Plazo (v1.0 Stable)

**Objetivo:** Construir ecosistema completo, abrir a comunidad y alcanzar estabilidad de producción.

**Prioridad:** 🟢 Baja

#### 🎯 Hitos

- [ ] 🔲 Sistema de scouting (buscar jugadores en el mercado)
- [ ] 🔲 Competiciones y rankings (simular temporadas LEC-style)
- [ ] 🔲 Modo multijugador básico (comparte equipos)
- [ ] 🔲 Documentación completa para contribuyentes
- [ ] 🔲 Primera release estable (v1.0.0)
- [ ] 🔲 Publicación OSS (anuncio oficial)

#### 📋 Tareas

- [ ] Implementar mercado de transferencias
- [ ] Crear sistema de ligas/torneos con estadísticas
- [ ] Añadir mode expansions (otras regiones: LCK, LCS, LPL)
- [ ] Desarrollar API REST pública (opcional)
- [ ] Configurar containerización (Docker)
- [ ] Setup CI/CD completo con releases automáticas
- [ ] Escribir CONTRIBUTING.md
- [ ] Audit de seguridad y hardening

#### Métricas de Éxito

- ✅ Comunidad puede contribuir siguiendo flow issue-first
- ✅ v1.0.0 publicada con changelog completo
- ✅ docs/ actualizada para usuarios y desarrolladores

---

## Proceso de Trabajo

### Flujo Issue-First

Siguiendo [`GOVERNANCE.md`](docs/GOVERNANCE.md), el desarrollo sigue este flujo:

```
1. Abrir issue con template → 2. Review de maintainer → 3. Apply label status:approved
4. Crear branch desde development → 5. Abrir PR con type:* label → 6. Merge a development
```

### Labels Utilizados

| Categoría | Labels |
|-----------|--------|
| **Status** | `status:needs-review`, `status:approved` |
| **Type** | `type:feature`, `type:bug`, `type:docs`, `type:chore`, `type:refactor`, `type:test`, `type:release` |

### Ramas

- `main` — Estable, solo releases
- `development` — Integración (default para PRs)
- `type/slug` — Ramas de feature/fix/docs/chore

---

## Métricas de Progreso

### KPIs por Fase

| Fase | KPI Principal | KPI Secundario |
|------|---------------|----------------|
| **Fase 1** | TODOs remaining: 0 | CI tests: 100% pass |
| **Fase 2** | Features core: 5 | Beta users: N/A |
| **Fase 3** | v1.0.0 released | OSS launch: done |

### Badges de Progreso

```markdown
[![Version](https://img.shields.io/badge/version-0.1.1-blue)](ROADMAP.md)
[![Phase](https://img.shields.io/badge/phase-1-green)](ROADMAP.md)
[![CI Status](https://img.shields.io/github/checks-status/placeholder/development)](actions)
```

---

## Cómo Seguir el Progreso

- **Roadmap (este archivo)** — Estado general y fases
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

# full CI (experimental)
npm run test
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

---

## Historial de Versiones

| Versión | Fecha | Notas |
|---------|-------|-------|
| 0.1.1 | 2026-04-28 | Pre-alpha actual |
| 0.2.0-alpha | ⏳ Pendiente | Alpha con deuda técnica resuelta |
| 0.3.0-beta | ⏳ Pendiente | Beta con features core |
| 1.0.0 | ⏳ Pendiente | Primera stable |

---

*Última actualización: 2026-04-29 — Actualizado con corrección de identidad (nationality_code + competitive_region)*
