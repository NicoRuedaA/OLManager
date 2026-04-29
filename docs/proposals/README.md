# OLManager - Proposal: QoL-UI (Quality of Life UI Improvements)

> **Branch**: `QoL-UI`  
> **Fork**: `NicoRuedaA/OLManager` → **Upstream**: `OpenLeagueManager/OLManager`  
> **Estado**: Ready for Review  
> **Fecha**: 2026-04-29  

---

## 📋 Resumen Ejecutivo

Este branch contiene mejoras de UI/UX (Quality of Life) para OLManager, enfocadas en la experiencia del usuario al gestionar su perfil de manager. Incluye:
- Subida de avatar personalizado
- Edición en vivo de datos del manager
- Alineación visual de fixtures en el calendario

Todas las mejoras son **no-rompientes** (backwards compatible) y siguen las convenciones del proyecto.

---

## 🎯 Changes Implemented

### 1. **Manager Avatar Upload** `feat(ui): add manager avatar upload and display`

#### 📝 Archivos modificados:
| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `src/lib/managerAvatars.ts` | **NUEVO** | Utilidades TypeScript para manejo de avatars |
| `public/manager-avatars/default-manager.svg` | **NUEVO** | Avatar por defecto (silueta SVG) |
| `src/pages/MainMenu.tsx` | Modificado | Agregado file picker con preview y validación |
| `src/components/manager/ManagerTab.tsx` | Modificado | Carga async de avatar vía Tauri |
| `src/store/types.ts` | Modificado | Agregado `avatar_path?: string \| null` al tipo `manager` |
| `src-tauri/crates/domain/src/manager.rs` | Modificado | Agregado `avatar_path: Option<String>` al struct `Manager` |
| `src-tauri/src/commands/game.rs` | Modificado | Comandos `save_manager_avatar` + `load_manager_avatar` |
| `src-tauri/src/lib.rs` | Modificado | Registrados nuevos comandos Tauri |
| `src-tauri/crates/db/src/repositories/manager_repo.rs` | Modificado | Agregado `avatar_path: None` en construcción de `Manager` |
| `src-tauri/Cargo.toml` | Modificado | Dependencia `base64 = "0.22"` (API moderna) |

#### 🎨 Características:
- ✅ **Frontend**: File picker con preview inmediato, validación de tipo/tamaño (PNG/JPG/WebP/SVG, máx 5MB)
- ✅ **Backend**: Avatar se guarda en `AppData/Roaming/manager-avatars/` con nombre único
- ✅ **Carga async**: `load_manager_avatar` retorna data URL (base64) para evitar problemas de rutas
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
- ✅ `npm run build` passes (frontend compila sin errores)
- ✅ `cargo build --workspace` passes (backend compila en 7.32s)
- ✅ App runs in `npm run tauri dev`
- ✅ Avatar upload funciona (preview, validation, save)
- ✅ Settings modal opens/closes correctly
- ✅ Form fields pre-populated with current values
- ✅ Save updates UI immediately
- ✅ Schedule VS/score alignment verified visually

### ⚠️ Warnings (no críticos):
- `unused_mut` en `live_match_manager.rs:136` (legacy code)
- `unused_variable` en `match_report.rs:105` (legacy code)
- `unused_import` en `game.rs:10` (`PathBuf` usado vía `std::path::PathBuf`)
- `dead_code` en `lol_sim_v2.rs` (legacy functions)

Estos warnings son del código original, no de nuestros cambios.

---

## 📂 Documentation Updates

### `docs/proposals/MANAGER_AVATAR_FEATURE.md` (NUEVO)
- Documentación completa de la feature de avatar
- Flujo de uso
- Especificaciones técnicas
- Ejemplos de código
- Casos de prueba

### `docs/proposals/DATA_MIGRATION_PLAN.md` (Actualizado)
- **Corrección crítica**: `football_nation` → `nationality_code` + `competitive_region` (no solo `region`)
- Explicación clara: en LoL, "nacionalidad" y "región competitiva" son conceptos **DISTINTOS**
- Ejemplos reales: Faker (`nationality_code: "KR"`, `competitive_region: "LCK"`)
- Encoding corregido (caracteres Unicode rotos en versión anterior)

### `docs/proposals/ROADMAP.md` (Actualizado)
- Tarea de migración de identidad actualizada con la corrección
- Nota explicativa sobre `nationality_code` vs `competitive_region`

---

## 🚀 Git History (Clean & Conventional)

```
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

#### 1. **Avatar Upload**:
1. Click en **"New Game"**
2. Llenar datos del manager
3. Sección **"Avatar (opcional)"** → Click en **"Subir imagen"**
4. Seleccionar una imagen (PNG/JPG/WebP/SVG, máx 5MB)
5. Ver **preview** en tiempo real
6. Click en **"Start Career"**
7. Ir a pestaña **"Manager"** → ✅ Ver avatar en el perfil

#### 2. **Settings Modal**:
1. En el dashboard, ir a pestaña **"Manager"**
2. Click en el botón **⚙️ (gear)** arriba a la derecha
3. Modificar campos (nickname, nombres, fecha, nacionalidad, avatar)
4. Click en **"Guardar"**
5. ✅ Los cambios se ven inmediatamente en el perfil

#### 3. **Schedule Alignment**:
1. Ir a pestaña **"Calendar"** (o "Schedule")
2. ✅ Verificar que todos los **"VS"** y **scores** están perfectamente alineados verticalmente
3. ✅ Home teams alineados a la derecha, Away teams a la izquierda

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
