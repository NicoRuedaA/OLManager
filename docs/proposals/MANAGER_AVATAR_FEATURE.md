# Manager Avatar Feature — REMOVED

## ⚠️ Status: REMOVED (2026-04-29)

Esta feature fue **eliminada** del branch `QoL-UI` por decisión del usuario. La documentación se mantiene solo como referencia histórica.

---

## 🗑️ Removal Summary

### ¿Qué fue removido?
- Opción de foto de perfil al crear nueva partida (MainMenu.tsx)
- Opción de foto de perfil en settings (ManagerTab.tsx)
- Librería `managerAvatars.ts`
- Comandos Tauri `save_manager_avatar` y `load_manager_avatar`
- Campo `avatar_path` del Manager (ahora siempre `null`)

### ¿Por qué fue removido?
- Decisión de simplificar el formulario de creación de partida
- Reducir complejidad en el código base
- El usuario prefirió mostrar iniciales del manager en lugar de foto

### Impacto del cambio:
- **Líneas eliminadas:** ~263
- **Archivos modificados:** 2 (MainMenu.tsx, ManagerTab.tsx)
- **Estado:** `avatarPath: null` en `start_new_game` y `update_manager_profile`

---

## 📚 Historical Reference (Feature Original)

### Overview (ORIGINAL)

The manager avatar feature ~~allowed~~ **allowed** players to upload a custom profile picture when creating a new manager career. This feature ~~includes~~ **included**:

- ~~Image upload with validation (file type, size, extension)~~
- ~~Avatar storage in app data directory via Tauri commands~~
- ~~Avatar display in the manager profile tab~~
- ~~Fallback to default silhouette when no avatar is set~~

### File Structure (ORIGINAL)

#### Frontend

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/managerAvatars.ts` | Utility functions for avatar handling | ❌ REMOVED |
| `public/manager-avatars/default-manager.svg` | Default avatar fallback | ❌ REMOVED |

#### Backend (Rust/Tauri)

| File | Purpose | Status |
|------|---------|--------|
| `src-tauri/crates/domain/src/manager.rs` | Added `avatar_path` field to Manager struct | ⚠️ Field exists but always null |
| `src-tauri/src/commands/game.rs` | Added `save_manager_avatar` and `load_manager_avatar` commands | ⚠️ Commands exist but unused |
| `src-tauri/src/lib.rs` | Registered new Tauri commands | ⚠️ Registered but unused |
| `src-tauri/crates/db/src/repositories/manager_repo.rs` | Updated Manager struct construction | ⚠️ Field exists but always None |

### Implementation Details (ORIGINAL)

#### Avatar Upload Flow (REMOVED)

1. ~~User selects an image file in MainMenu.tsx~~
2. ~~File is validated (type, size, extension)~~
3. ~~On game start, file is converted to bytes and uploaded via Tauri~~
4. ~~Tauri saves the file to `app_data_dir/manager-avatars/`~~
5. ~~Avatar path is stored in the Manager struct~~

#### Avatar Display Flow (REMOVED)

1. ~~ManagerTab.tsx loads avatar asynchronously via `getAvatarUrl()`~~
2. ~~If avatar_path exists, loads from app data via `load_manager_avatar` command~~
3. ~~Returns base64 data URL for display~~
4. ~~Falls back to default SVG if loading fails~~

### Current Implementation (POST-REMOVAL)

#### Manager Profile Display

```tsx
// src/components/manager/ManagerTab.tsx
<div className="w-20 h-20 rounded-xl overflow-hidden bg-primary-500/20 flex items-center justify-center border-2 border-primary-500/30">
  <span className="text-2xl font-heading font-bold text-primary-300">{initials}</span>
</div>
```

**Ahora muestra:** Iniciales del manager (ej: "JM" para "John Mourinho")

#### Game Creation

```typescript
// src/pages/MainMenu.tsx
await invoke<string>("start_new_game", {
  nickname: formData.nickname,
  firstName: formData.firstName,
  lastName: formData.lastName,
  dob: formData.dob,
  nationality: formData.nationality,
  worldSource,
  avatarPath: null, // ← Siempre null
});
```

---

## 📝 Lessons Learned

### What Worked:
- ✅ File validation (type, size, extension)
- ✅ Tauri file storage in app data directory
- ✅ Base64 data URL loading for display
- ✅ Fallback mechanism

### What Didn't:
- ❌ Complejidad añadida al formulario de creación
- ❌ Dependencia de comandos Tauri adicionales
- ❌ Storage management (cleanup de avatars viejos)
- ❌ No era esencial para el core gameplay

### Future Considerations:

Si se quiere re-implementar esta feature en el futuro:
1. Considerar hacerla **opcional** (toggle en settings)
2. Implementar cleanup automático de avatars no usados
3. Considerar usar URLs en lugar de archivos locales
4. Evaluar si vale la pena la complejidad añadida

---

## 🔗 Related Files

- `src/components/manager/ManagerTab.tsx` — Ahora muestra iniciales
- `src/pages/MainMenu.tsx` — Formulario simplificado sin avatar
- `docs/proposals/README.md` — Documentación actualizada del PR QoL-UI

---

*Documentación actualizada: 2026-04-29 (Feature REMOVED)*
