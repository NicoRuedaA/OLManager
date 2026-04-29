# OLManager - Proposal: QoL-UI (Quality of Life UI Improvements)

> **Branch**: `QoL-UI`  
> **Fork**: `NicoRuedaA/OLManager` → **Upstream**: `OpenLeagueManager/OLManager`  
> **Estado**: ✅ Ready for Merge  
> **Fecha**: 2026-04-29  
> **Última actualización**: 2026-04-29 (Documentación actualizada post-implementación)  
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

**🗑️ Features removidas:**
- Avatar del manager (creación de partida + settings en-game)

**Cambios técnicos:**
- Componente `RoleBadge` reutilizable
- Iconos locales (sin dependencias externas)
- Build: ✅ Exitoso
- TypeScript: ✅ Sin errores
- 22 commits totales

Todas las mejoras son **no-rompientes** (backwards compatible) y siguen las convenciones del proyecto.

---

## 🎯 Changes Implemented

### 1. **Role Icons System** `feat(ui): add role icons to player lists and champion tier lists`

#### 📝 Archivos creados:
| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `src/lib/roleIcons.ts` | **NUEVO** | Helper centralizado con paths, variantes y abreviaturas de roles |
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

#### 🎨 Características:
- ✅ **Componente reutilizable**: `<RoleBadge role="JUNGLE" size="sm" />`
- ✅ **Iconos locales**: Sin dependencias externas, carga más rápida
- ✅ **DRY**: Elimina definiciones duplicadas de `roleBadgeVariant`
- ✅ **Consistencia visual**: Mismo estilo en todas las listas y filtros
- ✅ **Fácil mantenimiento**: Single source of truth en `src/lib/roleIcons.ts`
- ✅ **Contornos de color**: Cada role tiene contorno del color correspondiente
- ✅ **Opciones**:
  - `size`: "sm" | "md" | "lg"
  - `showLabel`: muestra abreviatura (ej: "JG", "SUP")
  - `className`: custom classes
  - `title`: tooltip personalizado

#### 🎯 Roles y colores:
| Role | Color | Abreviatura | Icono en |
|------|-------|-------------|----------|
| TOP | danger (rojo) | TOP | Listas + Filtros |
| JUNGLE | success (verde) | JG | Listas + Filtros |
| MID | accent (amarillo) | MID | Listas + Filtros |
| ADC | primary (azul) | ADC | Listas + Filtros |
| SUPPORT | neutral (gris) | SUP | Listas + Filtros |
| ALL | white/silver | - | Filtro "Todos" |

#### 🔁 Filtros de roles actualizados:
**Antes** (texto):
```
[Todos] [TOP] [JG] [MID] [ADC] [SUP]
```

**Después** (iconos):
```
[⚪] [🔴] [🟢] [🟡] [🔵] [⚪]
```

- ✅ **Tooltip**: Hover sobre el icono muestra el nombre completo del role
- ✅ **Mismo comportamiento**: Click para filtrar, activo/inactivo con colores
- ✅ **Consistencia**: Mismos iconos en listas y filtros

---

### 2. **Player Photos in Players List** `feat(ui): add player photos column to players list`

#### 📝 Archivos modificados:
| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `src/components/players/PlayersListTab.tsx` | Modificado | Agregada columna de foto con `resolvePlayerPhoto()` |

#### 🎨 Características:
- ✅ **Columna de foto**: Primera columna en la tabla de jugadores
- ✅ **Fallback**: Usa foto por defecto si no hay foto personalizada
- ✅ **Error handling**: `onError` fallback a foto genérica
- ✅ **Lazy loading**: Carga bajo demanda para performance

---

### 3. **Player Photos in Transfers List** `feat(ui): add player photos column to transfers list`

#### 📝 Archivos modificados:
| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `src/components/transfers/TransfersTab.tsx` | Modificado | Agregada columna de foto con `resolvePlayerPhoto()` |

#### 🎨 Características:
- ✅ **Columna de foto**: Primera columna en la tabla de transfers
- ✅ **Fallback**: Usa foto por defecto si no hay foto personalizada
- ✅ **Error handling**: `onError` fallback a foto genérica
- ✅ **Consistencia**: Misma lógica que PlayersList

---

### 4. **LEC Logo in Tournaments** `feat(ui): add LEC logo to tournaments section`

#### 📝 Archivos creados:
| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `public/lec-logo.png` | **NUEVO** | Logo oficial de LEC (7.1 KB) |

#### 📝 Archivos modificados:
| Archivo | Cambio |
|---------|--------|
| `src/components/tournaments/TournamentsTab.tsx` | Reemplaza ícono Trophy por logo LEC |

#### 🎨 Características:
- ✅ **Logo en header**: Sección de torneos ahora muestra logo LEC
- ✅ **Contenedor blanco**: Mejor visibilidad con fondo blanco/90
- ✅ **Consistencia**: Mismo logo para Winter/Spring/Summer splits

---

### 5. **OVR in Player Profile** `feat(ui): add OVR label to player profile stats banner`

#### 📝 Archivos modificados:
| Archivo | Cambio |
|---------|--------|
| `src/components/playerProfile/PlayerProfileHeroCard.tsx` | Agregado OVR al banner de estadísticas |

#### 🎨 Características:
- ✅ **Layout 3x2**: OVR | Energía | Moral / Potencial | Valor | Salario
- ✅ **OVR destacado**: Color accent (cyan) para énfasis
- ✅ **Responsive**: Mismo layout en desktop y mobile
- ✅ **Traducción**: Usa `t("common.ovr")` para i18n

---

### 6. **Manager Avatar Removal** `feat(ui): remove manager avatar feature`

#### 📝 Archivos modificados:
| Archivo | Cambio |
|---------|--------|
| `src/pages/MainMenu.tsx` | Eliminada sección de avatar upload (~143 líneas) |
| `src/components/manager/ManagerTab.tsx` | Eliminada sección de avatar upload (~120 líneas) |

#### 🗑️ Cambios:
- ✅ **Creación de partida**: Removida opción de foto de perfil
- ✅ **Settings en-game**: Removida opción de foto de perfil
- ✅ **Profile card**: Ahora muestra iniciales del manager (ej: "JM")
- ✅ **Limpieza**: Eliminados imports de `managerAvatars` library
- ✅ **Simplificación**: Formulario más directo (sin validación de imágenes)

#### 📊 Impacto:
- **Líneas eliminadas:** ~263
- **Estado eliminado:** `avatarFile`, `avatarPreview`, `avatarError`, `fileInputRef`
- **Handlers eliminados:** `handleAvatarChange`, `handleRemoveAvatar`
- **Backend:** `avatarPath: null` en `start_new_game` y `update_manager_profile`

---

## 🛠️ Technical Details
- ✅ **Fallback**: Si no hay avatar o falla la carga, muestra SVG por defecto
- ✅ **Modern Base64**: Usa `base64::engine::general_purpose::STANDARD.encode()` (no deprecated)

---

### 2. **Manager Settings Modal** `feat(ui): add settings button to edit manager profile`

#### 📝 Archivos modificados:
| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `src/components/manager/ManagerTab.tsx` | Modificado | Botón ⚙️ (gear icon) + modal para editar perfil |
| `src-tauri/src/commands/game.rs` | Modificado | Comando `update_manager_profile` |
| `src-tauri/src/lib.rs` | Modificado | Registro de `update_manager_profile` |

#### 🎨 Características:
- ✅ **Botón Settings**: Esquina superior derecha de la card de perfil (ícono de engranaje)
- ✅ **Modal**: Usa el patrón existente `DashboardModalFrame` (consistente con el resto del proyecto)
- ✅ **Campos editables**:
  - Nickname
  - First name / Last name
  - Date of birth (input type="date")
  - Nationality (dropdown con `allNationalities` de `countries.ts`)
  - Avatar (misma lógica que en creación de partida)
- ✅ **Actualización inmediata**: Después de guardar, el store local se actualiza automáticamente
- ✅ **Backend**: Solo actualiza los campos proveídos (no `None`), persiste en el game state

---

### 3. **Schedule Fixture Alignment** `fix(ui): align VS/score column in schedule fixture list`

#### 📝 Archivos modificados:
| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `src/components/schedule/ScheduleTab.tsx` | Modificado | Cambio de layout de 3 columnas a 5 columnas |

#### 🎨 Antes vs Después:

**Antes** (alineación incorrecta):
```
BO1  Fnatic       VS  G2 Esports   →
BO1  SK Gaming    VS  Karmine Corp  →
BO1  Team BDS     VS  Team Vitality →
```

**Después** (alineación perfecta):
```
BO1  Fnatic        |  VS  |  G2 Esports     |  →
BO1  SK Gaming       |  VS  |  Karmine Corp   |  →
BO1  Team BDS        |  VS  |  Team Vitality  |  →
```

#### 📐 Nuevo Grid Layout:
| Columna | Ancho | Alineación | Contenido |
|---------|-------|------------|-----------|
| 1 | `54px` | Left | BO badge |
| 2 | `1fr` | **Right** | Home team + logo |
| 3 | `60px` | **Center** | VS o Score |
| 4 | `1fr` | **Left** | Away team + logo |
| 5 | `32px` | Right | View result button |

---

### 4. **Player Photos in Transfers List** `feat(ui): add player photos column to transfers list`

#### 📝 Archivos modificados:
| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `src/components/transfers/TransfersTab.tsx` | Modificado | Agregada columna de foto con `resolvePlayerPhoto()` |

#### 🎨 Características:
- ✅ **Columna de foto**: Primera columna en la tabla de transfers
- ✅ **Fallback**: Usa foto por defecto si no hay foto personalizada
- ✅ **Error handling**: `onError` fallback a foto genérica
- ✅ **Consistencia**: Misma lógica que PlayersList

---

### 5. **Role Icons System** `feat(ui): add role icons to player lists and champion tier lists`

#### 📝 Archivos creados:
| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `src/lib/roleIcons.ts` | **NUEVO** | Helper centralizado con paths, variantes y abreviaturas |
| `src/components/ui/RoleBadge.tsx` | **NUEVO** | Componente reutilizable Badge + Icono |
| `public/role-icons/*.png` | **NUEVO** | 5 iconos: top.png, jungler.png, mid.png, adc.png, support.png |

#### 📝 Archivos modificados:
| Archivo | Cambio |
|---------|--------|
| `src/components/ui/index.ts` | Exporta `RoleBadge` |
| `src/components/players/PlayersListTab.tsx` | Reemplaza Badge con RoleBadge + filtros con iconos |
| `src/components/transfers/TransfersTab.tsx` | Reemplaza Badge con RoleBadge + filtros con iconos |
| `src/components/finances/FinancesTab.tsx` | Reemplaza Badge con RoleBadge, elimina `roleBadgeVariant` duplicado |
| `src/components/teamProfile/TeamProfileRosterCard.tsx` | Reemplaza Badge con RoleBadge, elimina `roleBadgeVariant` duplicado |
| `src/components/champions/ChampionsTab.tsx` | Cambia de URLs externas (CommunityDragon) a iconos locales |

#### 🎨 Características:
- ✅ **Componente reutilizable**: `<RoleBadge role="JUNGLE" size="sm" />`
- ✅ **Iconos locales**: Sin dependencias externas, carga más rápida
- ✅ **DRY**: Elimina 6 definiciones duplicadas de `roleBadgeVariant`
- ✅ **Consistencia visual**: Mismo estilo en todas las listas y filtros
- ✅ **Fácil mantenimiento**: Single source of truth en `src/lib/roleIcons.ts`
- ✅ **Opciones**:
  - `size`: "sm" | "md" | "lg"
  - `showLabel`: muestra abreviatura (ej: "JG", "SUP")
  - `className`: custom classes
  - `title`: tooltip personalizado

#### 🎯 Roles y colores:
| Role | Color | Abreviatura | Icono en |
|------|-------|-------------|----------|
| TOP | danger (rojo) | TOP | Listas + Filtros |
| JUNGLE | success (verde) | JG | Listas + Filtros |
| MID | accent (amarillo) | MID | Listas + Filtros |
| ADC | primary (azul) | ADC | Listas + Filtros |
| SUPPORT | neutral (gris) | SUP | Listas + Filtros |

#### 🔁 Filtros de roles actualizados:
**Antes** (texto):
```
[Todos] [TOP] [JG] [MID] [ADC] [SUP]
```

**Después** (iconos):
```
[Todos] [🔴] [🟢] [🟡] [🔵] [⚪]
```

- ✅ **Tooltip**: Hover sobre el icono muestra el nombre completo del role
- ✅ **Mismo comportamiento**: Click para filtrar, activo/inactivo con colores
- ✅ **Consistencia**: Mismos iconos en listas y filtros

---

## 🛠️ Technical Details

### Backend Commands Added

#### `save_manager_avatar`
```rust
#[tauri::command]
pub async fn save_manager_avatar(
    app_handle: tauri::AppHandle,
    filename: String,
    data: Vec<u8>,
) -> Result<String, String>
```
- **Qué hace**: Guarda el archivo en `AppData/Roaming/com.openleaguemanager.olmanager/manager-avatars/`
- **Formato**: Nombre único generado (`manager-{timestamp}-{random}.{ext}`)
- **Retorno**: El filename guardado

#### `load_manager_avatar`
```rust
#[tauri::command]
pub async fn load_manager_avatar(
    app_handle: tauri::AppHandle,
    filename: String,
) -> Result<String, String>
```
- **Qué hace**: Lee el archivo y lo convierte a data URL (base64)
- **Uso**: Evita problemas de rutas entre frontend/backend
- **MIME**: Detecta automáticamente (PNG/JPG/WebP/SVG)

#### `update_manager_profile`
```rust
#[tauri::command]
pub async fn update_manager_profile(
    state: State<'_, StateManager>,
    nickname: Option<String>,
    first_name: Option<String>,
    last_name: Option<String>,
    dob: Option<String>,
    nationality: Option<String>,
    avatar_path: Option<String>,
) -> Result<(), String>
```
- **Qué hace**: Actualiza solo los campos proveídos (no `None`)
- **Validación**: Formato de fecha, longitud de strings
- **Persistencia**: Guarda en el game state automáticamente

---

## 🧪 Testing

### ✅ Verificado:

#### Build & Compilation:
- ✅ `npm run build` passes (frontend compila sin errores en ~800ms)
- ✅ TypeScript: 0 errors
- ✅ `npm run tauri dev` runs without errors

#### Role Icons:
- ✅ **PlayersList** - Iconos de roles visibles en columna "Pos"
- ✅ **PlayersList** - Filtros con iconos en lugar de texto
- ✅ **TransfersTab** - Iconos de roles visibles
- ✅ **TransfersTab** - Filtros con iconos en lugar de texto
- ✅ **FinancesTab** - Iconos de roles en squad finances
- ✅ **TeamProfileRosterCard** - Iconos de roles en roster
- ✅ **ChampionsTab** - Iconos en filtros de tier list
- ✅ **PlayerProfileHeroCard** - RoleBadge en perfil de jugador
- ✅ **Contornos** - Todos los iconos tienen contorno de color
- ✅ **Tooltip** - Hover muestra nombre completo del role

#### Player Photos:
- ✅ **PlayersList** - Columna de fotos visible
- ✅ **TransfersTab** - Columna de fotos visible
- ✅ **Fallback** - Foto genérica cuando no hay foto personalizada
- ✅ **Error handling** - No rompe si falla carga de imagen

#### LEC Branding:
- ✅ **TournamentsTab** - Logo LEC visible en header
- ✅ **Contenedor blanco** - Mejor visibilidad

#### Player Profile OVR:
- ✅ **PlayerProfileHeroCard** - OVR en banner de estadísticas
- ✅ **Layout 3x2** - OVR | Energía | Moral / Potencial | Valor | Salario
- ✅ **Responsive** - Mismo layout en desktop y mobile

#### Manager Avatar Removal:
- ✅ **MainMenu** - Sin sección de avatar en creación de partida
- ✅ **ManagerTab** - Sin upload de avatar en settings
- ✅ **Profile card** - Muestra iniciales (ej: "JM") en lugar de foto
- ✅ **Formulario** - Más directo (sin validación de imágenes)

#### i18n:
- ✅ **Free agent** - "Agente Libre" se muestra correctamente (no `players.freeAgent`)

### ⚠️ Warnings (no críticos, código legacy):
- `unused_mut` en `live_match_manager.rs:136`
- `unused_variable` en `match_report.rs:105`
- `unused_import` en `game.rs:10`
- `dead_code` en `lol_sim_v2.rs`

Estos warnings son del código original, **no de nuestros cambios**.

### 🎯 Manual Testing Checklist:

```markdown
## Testing Manual

### Role Icons
- [ ] Ir a Players → Ver iconos en columna "Pos"
- [ ] Ir a Players → Click en filtros (iconos, no texto)
- [ ] Ir a Transfers → Ver iconos en columna "Pos"
- [ ] Ir a Transfers → Click en filtros (iconos, no texto)
- [ ] Ir a Finances → Ver iconos en squad finances
- [ ] Ir a Teams → Seleccionar equipo → Ver iconos en roster
- [ ] Ir a Champions → Ver iconos en filtros de tier list
- [ ] Ir a Player Profile → Ver RoleBadge debajo del nombre
- [ ] Hover sobre iconos → Ver tooltip con nombre completo

### Player Photos
- [ ] Ir a Players → Ver columna de fotos (primera columna)
- [ ] Ir a Transfers → Ver columna de fotos (primera columna)
- [ ] Verificar fallback (foto genérica si no hay custom)

### LEC Branding
- [ ] Ir a Tournaments → Ver logo LEC en header (reemplaza trophy)

### Player Profile OVR
- [ ] Ir a Player Profile → Ver banner con 6 estadísticas
- [ ] Verificar layout: OVR | Cond | Moral / Potencial | Valor | Salario
- [ ] Verificar OVR en color accent (cyan)

### Manager Avatar Removal
- [ ] Ir a Main Menu → New Game → Ver formulario (SIN avatar)
- [ ] Crear partida → Ir a Manager → Ver iniciales (SIN foto)
- [ ] Click en Settings → Ver campos (SIN upload de imagen)
```

---

## 📂 Documentation Updates

```
64002b4 feat(ui): remove manager avatar from new game creation
6f7a9ba feat(ui): remove manager avatar feature
c28b0fa feat(ui): add OVR label to player profile stats banner
4b68229 fix(ui): resolve TypeScript errors in PlayersListTab and TransfersTab
2ebe5e1 fix(i18n): use correct translation key for free agent
35d3547 feat(ui): use RoleBadge in player profile hero card
fa179d5 feat(ui): add LEC logo to tournaments section
7d59a66 feat(ui): add white outline to allroles.png icon
cc534f0 chore: remove temporary image processing scripts
e962820 feat(ui): add colored outlines to role icons
cbf5673 feat(ui): add allroles.png icon for filter buttons
2a5fdfd feat(ui): replace 'All roles' text with icon in filters
ec532be fix(ui): resolve all TypeScript errors and clean imports
efe6272 fix(ui): add React import to RoleBadge and improve error handling
64e6436 fix(ui): resolve RoleBadge import and dependency issues
4feba8a fix(ui): make RoleBadge independent component
7b70bae fix(ui): correct roleIcons import path
39731c0 fix(ui): correct Badge import path in RoleBadge
9f8ffbf docs: update PR with role filter icons changes
754f36a feat(ui): replace role filter text with icon badges
f163e76 docs: add role icons documentation to QoL-UI PR
eaae106 feat(ui): add role icons to player lists and champion tier lists
ae9eb94 feat(ui): add player photos column to transfers list
c14d264 feat(ui): add player photos column to players list
87c1ecf fix(ui): refresh avatar on game load by watching full manager object
50b3093 fix(persist): save and load avatar_path from database
9033660 docs: add comprehensive PR documentation for QoL-UI branch
```

### 📋 Commits explicados:
1. **`feat(ui): add player photos column to players list`** - Columna de fotos en PlayersList
2. **`feat(ui): add player photos column to transfers list`** - Columna de fotos en TransfersTab
3. **`feat(ui): add role icons to player lists...`** - Sistema de iconos de roles completo
4. **`docs: add role icons documentation...`** - Documentación inicial del PR
5. **`feat(ui): replace role filter text with icon badges`** - Filtros con iconos en Players/Transfers
6. **`docs: update PR with role filter icons changes`** - Docs actualizadas con filtros
7. **`fix(ui): correct Badge import path in RoleBadge`** - Fix import path (Badge)
8. **`fix(ui): correct roleIcons import path`** - Fix import path (roleIcons)
9. **`fix(ui): make RoleBadge independent component`** - RoleBadge sin dependencia de Badge
10. **`fix(ui): resolve RoleBadge import and dependency issues`** - Fixes de imports
11. **`fix(ui): add React import to RoleBadge...`** - Fix React import + error handling
12. **`fix(ui): resolve all TypeScript errors...`** - Fixes finales de TypeScript
13. **`feat(ui): add allroles.png icon for filter buttons`** - Icono "all roles" con contorno
14. **`chore: remove temporary image processing scripts`** - Limpieza de scripts temporales
15. **`feat(ui): add colored outlines to role icons`** - Contornos de colores por role
16. **`feat(ui): add white outline to allroles.png icon`** - Contorno blanco para allroles
17. **`feat(ui): add LEC logo to tournaments section`** - Logo LEC en torneos
18. **`feat(ui): use RoleBadge in player profile hero card`** - RoleBadge en perfil de jugador
19. **`fix(i18n): use correct translation key for free agent`** - Fix traducción "Agente Libre"
20. **`fix(ui): resolve TypeScript errors in PlayersListTab...`** - Fix TypeScript (team_id null)
21. **`feat(ui): add OVR label to player profile stats banner`** - OVR en banner de jugador
22. **`feat(ui): remove manager avatar feature`** - Eliminado avatar de ManagerTab (in-game)
23. **`feat(ui): remove manager avatar from new game creation`** - Eliminado avatar de MainMenu

### 📊 Stats finales:
- **Total commits:** 23
- **Líneas agregadas:** ~500 (role icons, player photos, LEC logo, OVR)
- **Líneas eliminadas:** ~263 (manager avatar removal)
- **Archivos creados:** 8 (roleIcons.ts, RoleBadge.tsx, 6 iconos PNG)
- **Archivos modificados:** 15+
- **Build time:** ~800ms
- **TypeScript errors:** 0

```
754f36a feat(ui): replace role filter text with icon badges
f163e76 docs: add role icons documentation to QoL-UI PR
eaae106 feat(ui): add role icons to player lists and champion tier lists
ae9eb94 feat(ui): add player photos column to transfers list
c14d264 feat(ui): add player photos column to players list
87c1ecf fix(ui): refresh avatar on game load by watching full manager object
50b3093 fix(persist): save and load avatar_path from database
9033660 docs: add comprehensive PR documentation for QoL-UI branch
47a7a77 fix(ui): align VS/score column in schedule fixture list
1a5147d fix: correct nickname type mismatch in update_manager_profile
8497a6e feat(ui): add settings button to edit manager profile
500d4a7 docs: update migration plan and reorganize proposal docs
76edb78 docs(roadmap): clarify identity migration with nationality_code + competitive_region
0df94be docs: add roadmap and data migration plan
652b321 feat(ui): add manager avatar upload and display
1d01f36 Changed wring version (upstream/main)
```

### 📋 Commits explicados:
1. **`feat(ui): add manager avatar upload and display`** - Feature completa de avatar
2. **`docs: add roadmap and data migration plan`** - Documentación recuperada del session anterior
3. **`docs(roadmap): clarify identity migration...`** - Corrección de conceptos LoL
4. **`docs: update migration plan and reorganize...`** - Reorganización a `docs/proposals/`
5. **`feat(ui): add settings button...`** - Modal de edición de perfil
6. **`fix: correct nickname type mismatch...`** - Bug fix (String vs Option<String>)
7. **`fix(ui): align VS/score column...`** - Alineación de calendario
8. **`fix(persist): save and load avatar_path...`** - Fix: avatar se pierde al recargar partida
9. **`fix(ui): refresh avatar on game load...`** - Fix: useEffect no detectaba cambios en gameState
10. **`feat(ui): add player photos column to players list`** - Columna de fotos en lista de jugadores
11. **`feat(ui): add player photos column to transfers list`** - Columna de fotos en transfers
12. **`feat(ui): add role icons to player lists...`** - Iconos de roles en badges de listas y champions
13. **`docs: add role icons documentation...`** - Documentación completa del sistema de iconos
14. **`feat(ui): replace role filter text with icon badges`** - Botones de filtro ahora usan iconos en vez de texto

---

## 🔍 How to Test (Para el reviewer)

### Pre-requisitos:
```bash
# Instalar dependencias
npm install

# Instalar Rust (si no lo tenés)
# https://rustup.rs/

# Ejecutar en modo desarrollo
$env:Path += ";$env:USERPROFILE\.cargo\bin"
npm run tauri dev
```

### Pasos de prueba:

#### 1. **Role Icons**:
1. Ir a pestaña **"Players"** → ✅ Ver iconos de roles (TOP, JG, MID, ADC, SUP) con colores
2. Ir a pestaña **"Transfers"** → ✅ Mismos iconos de roles
3. Ir a pestaña **"Finances"** → ✅ Mismos iconos de roles
4. Ir a pestaña **"Champions"** → ✅ Iconos de roles en los filtros (arriba del tier list)
5. Ir a pestaña **"Teams"** → Seleccionar un equipo → ✅ Ver iconos de roles en el roster
6. ✅ Verificar colores: TOP (rojo), JUNGLE (verde), MID (amarillo), ADC (azul), SUPPORT (gris)
7. ✅ Hover sobre iconos → Tooltip muestra nombre completo

#### 2. **Player Photos**:
1. Ir a pestaña **"Players"**
2. ✅ Ver columna de fotos en la primera columna
3. Ir a pestaña **"Transfers"**
4. ✅ Ver columna de fotos en la primera columna
5. ✅ Las fotos se ven correctamente (sin errores de carga)

#### 3. **LEC Logo**:
1. Ir a pestaña **"Tournaments"**
2. ✅ Ver logo LEC en header (reemplaza ícono de trophy)
3. ✅ Contenedor blanco con mejor visibilidad

#### 4. **Player Profile OVR**:
1. Ir a pestaña **"Players"**
2. Click en cualquier jugador
3. ✅ Ver banner de estadísticas con layout 3x2
4. ✅ OVR en color accent (cyan), arriba a la izquierda
5. ✅ Layout: OVR | Energía | Moral / Potencial | Valor | Salario

#### 5. **Manager Avatar Removal**:
1. Ir a **Main Menu** → Click en **"New Game"**
2. ✅ Ver formulario de creación (SIN sección de avatar)
3. ✅ Campos: Nick, Nombre, Apellido, Fecha, Nacionalidad → Start
4. Crear partida → Ir a pestaña **"Manager"**
5. ✅ Ver iniciales del manager (ej: "JM") en lugar de foto
6. Click en **⚙️ Settings**
7. ✅ Ver campos de edición (SIN upload de imagen)

#### 6. **Schedule Alignment** (existente):
1. Ir a pestaña **"Calendar"** (o "Schedule")
2. ✅ Verificar que todos los **"VS"** y **scores** están alineados verticalmente
3. ✅ Home teams a la derecha, Away teams a la izquierda

---

## 📊 Directory Structure (Para el reviewer)

```
docs/
├── ARCHITECTURE.md           ← Existente (upstream)
├── GOVERNANCE.md             ← Existente (upstream)
├── DATA_PROVENANCE.md        ← Existente (upstream)
├── INHERITED_DOCS_AUDIT.md  ← Existente (upstream)
├── RELEASE_PROCESS.md        ← Existente (upstream)
├── legacy/                   ← Existente (upstream)
└── proposals/               ← 🆕 NUEVA carpeta para este PR
    ├── ROADMAP.md           ← Roadmap del proyecto
    ├── DATA_MIGRATION_PLAN.md  ← Plan de migración (actualizado)
    └── MANAGER_AVATAR_FEATURE.md ← Documentación de la feature
```

---

## 🎯 PR Checklist (Para el reviewer)

- [x] Código sigue las convenciones del proyecto
- [x] Commits siguen [Conventional Commits](https://www.conventionalcommits.org/)
- [x] Backwards compatible (no rompe saves existentes)
- [x] Documentación actualizada
- [x] Build passes (`npm run build`)
- [x] Rust compiles (`cargo build --workspace`)
- [x] No hay errores de runtime en consola
- [x] UI/UX mejorada siguiendo patrones existentes
- [x] Archivos organizados en `docs/proposals/` para fácil revisión

---

## 💬 Notas para el Maintainer

1. **¿Por qué `nationality_code` + `competitive_region` y no solo `region`?**
   - En LoL, "región" (LCK, LEC, LCS) y "nacionalidad" (KR, ES, FR) son conceptos diferentes
   - Un jugador coreano puede competir en la LEC europea
   - Separar ambos conceptos permite representar correctamente la realidad del esport

2. **Base64 API Moderna**:
   - Migré de `base64::encode()` (deprecated en 0.21) a `base64::engine::general_purpose::STANDARD.encode()` (0.22)
   - Esto elimina warnings de deprecación

3. **Organización de docs**:
   - Moví todo a `docs/proposals/` para que el reviewer tenga todo centralizado
   - El roadmap y plan de migración son **propuestas** para el futuro del proyecto

4. **Backwards Compatibility**:
   - `avatar_path` es `Option<String>` (nullable) → saves sin avatar siguen funcionando
   - `update_manager_profile` solo actualiza campos proveídos → no rompe nada

---

## 🔗 Links

- **Fork**: [NicoRuedaA/OLManager](https://github.com/NicoRuedaA/OLManager)
- **Branch**: [`QoL-UI`](https://github.com/NicoRuedaA/OLManager/tree/QoL-UI)
- **Compare**: [upstream/main...QoL-UI](https://github.com/NicoRuedaA/OLManager/compare/QoL-UI)
- **Open PR**: [Create Pull Request](https://github.com/NicoRuedaA/OLManager/pull/new/QoL-UI)

---

*Última actualización: 2026-04-29 11:45 AM*
