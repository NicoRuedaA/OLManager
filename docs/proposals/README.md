# OLManager - Proposal: QoL-UI (Quality of Life UI Improvements)

> **Branch**: `QoL-UI`  
> **Fork**: `NicoRuedaA/OLManager` → **Upstream**: `OpenLeagueManager/OLManager`  
> **Estado**: 🔄 In Progress (Champion System + Migration Fixes)  
> **Fecha**: 2026-04-29  
> **Última actualización**: 2026-05-01 (Champion system, migration fixes, UI redesign)  
> **PR**: Creado en GitHub  
> **Checks**: ✅ frontend-install passed, ✅ rust-check passed  

---

## 📋 Resumen Ejecutivo

Este branch contiene mejoras de UI/UX (Quality of Life) para OLManager, enfocadas en:

**✨ Features implementadas:**
- Iconos de roles (TOP, JUNGLE, MID, ADC, SUPPORT) en todas las listas y filtros
- Columna de fotos en lista de jugadores (PlayersList)
- Columna de fotos en lista de transfers (TransfersTab)
- Logo LEC en sección de torneos
- Overall (OVR) en banner de estadísticas del perfil de jugador
- **🆕 Sistema completo de campeones** (DB, catálogo, perfil, counterpicks, sinergias)
- **🆕 ChampionPage rediseñada** con mismo estilo visual que PlayerProfile
- **🆕 ChampionProfile modal** con banner hero matching PlayerProfileHeroCard
- **🆕 Fix de migraciones V31/V32** para saves viejos sin tabla champions

**🗑️ Features removidas:**
- Avatar del manager (creación de partida + settings en-game)

**Cambios técnicos:**
- Componente `RoleBadge` reutilizable
- Iconos locales (sin dependencias externas)
- **🆕 32 migraciones de base de datos** (champions, champion_progression, avatar)
- **🆕 Fix de bug crítico**: nombres de campeones bugueados ('Taliyah' → '. aliyah')
- **🆕 Fix de carga de partidas**: tabla champion_progression_state inexistente en saves viejos
- Build: ✅ Exitoso
- TypeScript: ✅ Sin errores
- Tests DB: ✅ 123 passing

Todas las mejoras son **no-rompientes** (backwards compatible) y siguen las convenciones del proyecto.

---

## 🎯 Changes Implemented

### 1. **Champion System** (🆕 2026-05-01)

#### 📝 Archivos creados:
| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `src-tauri/crates/db/src/sql/v030_champions_table.sql` | **NUEVO** | Schema de tabla champions |
| `src-tauri/crates/db/src/sql/v031_fix_champion_seed.sql` | **NUEVO** | Fix counterpicks/synergies seed |
| `src-tauri/crates/db/src/sql/v032_fix_champion_names.sql` | **NUEVO** | Re-seed con nombres correctos |
| `src-tauri/crates/db/src/repositories/champion_repo.rs` | **NUEVO** | CRUD + seed desde JSON |
| `src-tauri/crates/db/src/repositories/champion_progression_repo.rs` | **NUEVO** | Persistencia de mastery + patch |
| `src/components/champions/ChampionsTab.tsx` | **NUEVO** | Tab de catálogo de campeones |
| `src/components/champions/ChampionCard.tsx` | **NUEVO** | Card de campeón con lazy loading |
| `src/components/champions/ChampionProfile.tsx` | **NUEVO** | Modal de perfil (rediseñado) |
| `src/pages/ChampionPage.tsx` | **NUEVO** | Página individual de campeón |
| `src-tauri/src/commands/champion.rs` | **NUEVO** | Comandos Tauri para campeones |

#### 📝 Archivos modificados:
| Archivo | Cambio |
|---------|--------|
| `src-tauri/crates/db/src/migrations.rs` | 32 migraciones (V30-V32 champions) |
| `src-tauri/crates/db/src/game_database.rs` | ensure_champions() idempotente |
| `src-tauri/crates/db/src/game_persistence.rs` | Seed champions en write/read |
| `src-tauri/crates/db/src/save_manager.rs` | Debug logging para load_game |
| `src-tauri/src/lib.rs` | Registro de comandos champion |
| `src/store/gameStore.ts` | Champions en GameStateData |
| `src/pages/Dashboard.tsx` | ChampionsTab integrado |
| `src/components/playerProfile/PlayerProfile.tsx` | onViewChampion handler |
| `src/components/playerProfile/PlayerProfileChampionsCard.tsx` | Cards clickeables |
| `src/components/ui/index.ts` | Exporta ChampionsTab |
| `src/lib/roleIcons.ts` | Iconos para champion roles |

#### 🎨 Características:
- ✅ **Catálogo completo**: 170 campeones desde Data Dragon
- ✅ **Counterpicks y sinergias**: Datos seedeados desde JSON
- ✅ **Lazy loading**: IntersectionObserver para tiles
- ✅ **Perfil visual**: Banner hero matching PlayerProfileHeroCard
- ✅ **QuickStats**: Win Rate, Pick Rate, Ban Rate, KDA, Tier, Dificultad (placeholders)
- ✅ **Responsive**: Grid adaptativo desktop/mobile
- ✅ **Migraciones condicionales**: V31/V32 verifican tabla existe antes de DELETE

#### 🐛 Bugs Fixados:
| Bug | Causa | Fix |
|-----|-------|-----|
| `Taliyah` → `. aliyah` | camelCase logic reemplazaba primera mayúscula | V32 migration + fix en champion_repo.rs |
| `no such table: champions` | Saves viejos sin tabla champions | V31/V32 con up_with_hook condicional |
| `no such table: champion_progression_state` | load_state no verificaba tabla | Check sqlite_master antes de query |
| Partida no cargaba | champion_progression_repo crash | Table existence check |

---

### 2. **Role Icons System**

#### 📝 Archivos creados:
| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `src/lib/roleIcons.ts` | **NUEVO** | Helper centralizado con paths, variantes y abreviaturas |
| `src/components/ui/RoleBadge.tsx` | **NUEVO** | Componente reutilizable Badge + Icono |
| `public/role-icons/*.png` | **NUEVO** | 6 iconos: top.png, jungler.png, mid.png, adc.png, support.png, allroles.png |

#### 📝 Archivos modificados:
| Archivo | Cambio |
|---------|--------|
| `src/components/ui/index.ts` | Exporta `RoleBadge` |
| `src/components/players/PlayersListTab.tsx` | Reemplaza Badge con RoleBadge + filtros con iconos |
| `src/components/transfers/TransfersTab.tsx` | Reemplaza Badge con RoleBadge + filtros con iconos |
| `src/components/finances/FinancesTab.tsx` | Reemplaza Badge con RoleBadge |
| `src/components/teamProfile/TeamProfileRosterCard.tsx` | Reemplaza Badge con RoleBadge |
| `src/components/champions/ChampionsTab.tsx` | Cambia de URLs externas (CommunityDragon) a iconos locales |
| `src/components/playerProfile/PlayerProfileHeroCard.tsx` | Reemplaza Badge con RoleBadge |

#### 🎯 Roles y colores:
| Role | Color | Abreviatura |
|------|-------|-------------|
| TOP | danger (rojo) | TOP |
| JUNGLE | success (verde) | JG |
| MID | accent (amarillo) | MID |
| ADC | primary (azul) | ADC |
| SUPPORT | neutral (gris) | SUP |

---

### 3. **Player Photos in Lists**

| Archivo | Cambio |
|---------|--------|
| `src/components/players/PlayersListTab.tsx` | Columna de foto con `resolvePlayerPhoto()` |
| `src/components/transfers/TransfersTab.tsx` | Columna de foto con `resolvePlayerPhoto()` |

---

### 4. **LEC Logo in Tournaments**

| Archivo | Cambio |
|---------|--------|
| `public/lec-logo.png` | Logo oficial de LEC (7.1 KB) |
| `src/components/tournaments/TournamentsTab.tsx` | Reemplaza ícono Trophy por logo LEC |

---

### 5. **OVR in Player Profile**

| Archivo | Cambio |
|---------|--------|
| `src/components/playerProfile/PlayerProfileHeroCard.tsx` | Agregado OVR al banner de estadísticas |

---

### 6. **Manager Avatar Removal**

| Archivo | Cambio |
|---------|--------|
| `src/pages/MainMenu.tsx` | Eliminada sección de avatar upload (~143 líneas) |
| `src/components/manager/ManagerTab.tsx` | Eliminada sección de avatar upload (~120 líneas) |

---

## 🛠️ Technical Details

### Database Migrations (V1-V32)

| Migración | Descripción |
|-----------|-------------|
| V28 | avatar_path en managers |
| V28 (champion_progression) | Champion mastery + patch persistence |
| V30 | Champions table (catalog) |
| V31 | Fix counterpicks/synergies seed (DELETE condicional) |
| V32 | Fix champion names camelCase bug (DELETE condicional) |

### Backend Commands Added

#### `get_champions`
```rust
#[tauri::command]
pub async fn get_champions(state: State<'_, SaveManagerState>) -> Result<Vec<Champion>, String>
```
- Retorna todos los campeones del save activo

#### `get_champion_by_id`
```rust
#[tauri::command]
pub async fn get_champion_by_id(state: State<'_, SaveManagerState>, id: i64) -> Result<Champion, String>
```
- Retorna un campeón por ID

### Champion Seed Flow

```
data/lec/draft/champions.json (16,353 líneas, 165 campeones)
    ↓
champion_repo::seed_from_json(conn, json_content)
    ↓
DB: champions table (id, name, champion_key, roles_json, counterpicks_json, synergies_json, image_tile_url, image_splash_url)
```

**When It Runs:**
1. **New Game**: `GamePersistenceWriter::write_game()` → seed_from_json()
2. **Load Game**: `GamePersistenceReader::read_game()` → db.ensure_champions() → seed si tabla vacía
3. **Legacy Saves**: ensure_champions() crea tabla + seed si no existe

---

## 🧪 Testing

### ✅ Verificado:

#### Build & Compilation:
- ✅ `npm run build` passes
- ✅ TypeScript: 0 errors
- ✅ `npm run tauri dev` runs without errors
- ✅ `cargo test -p db`: 123 passing

#### Champion System:
- ✅ ChampionsTab carga 170 campeones
- ✅ ChampionCard con lazy loading
- ✅ ChampionProfile modal con hero banner
- ✅ ChampionPage con layout matching PlayerProfile
- ✅ Counterpicks y sinergias visibles
- ✅ Migraciones V30-V32 aplican correctamente
- ✅ Saves viejos cargan sin error (tablas condicionales)
- ✅ Nombres de campeones correctos (Taliyah = Taliyah)

#### Load Game Flow:
- ✅ Debug logging confirma pipeline completo
- ✅ ensure_champions → meta → manager → teams(38) → players(323) → staff → messages → news → league → objectives → scouting → champion_progression
- ✅ DONE - game loaded successfully

### ⚠️ Warnings (no críticos, código legacy):
- `unused_mut` en `live_match_manager.rs:136`
- `unused_variable` en `match_report.rs:105`
- `unused_import` en `game.rs:10`
- `dead_code` en `lol_sim_v2.rs`

---

## 📊 Stats finales:
- **Total commits:** 40+
- **Migraciones:** 32
- **Archivos creados:** 15+
- **Archivos modificados:** 25+
- **Build time:** ~800ms
- **TypeScript errors:** 0
- **DB tests:** 123 passing

---

## 🔗 Links

- **Fork**: [NicoRuedaA/OLManager](https://github.com/NicoRuedaA/OLManager)
- **Branch**: [`QoL-UI`](https://github.com/NicoRuedaA/OLManager/tree/QoL-UI)

---

*Última actualización: 2026-05-01*
