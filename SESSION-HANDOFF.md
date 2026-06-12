# OLManager — Handoff de sesión (contexto pre-formateo)

> **Propósito:** preservar el contexto completo de la sesión de trabajo sobre OLManager
> antes de formatear el equipo. Guardá este archivo en la nube / USB ANTES de formatear.
>
> **Fecha de la sesión:** 2026-06-13
> **Repo:** https://github.com/NicoRuedaA/OLManager — rama `0.3.6`
> **Commit base:** `22f3da59` (`fix(draft): resolve team logos using logo_url instead of slugified name`)

---

## ⚠️ CRÍTICO — LEER PRIMERO

Los cambios de código de esta sesión **NO están committeados ni pusheados**. Si formateás,
el working tree se pierde. Tenés dos opciones antes de formatear:

1. **Recomendado:** commitear y pushear los cambios (ver sección "Changelog reproducible").
2. **Mínimo:** guardar este `.md` — incluye los diffs exactos para reaplicarlos sobre un clon
   fresco de `0.3.6`.

Después de formatear, el flujo de recuperación es:
1. Reinstalar herramientas (ver "Reconstrucción del entorno").
2. `git clone --branch 0.3.6 https://github.com/NicoRuedaA/OLManager.git`
3. Reaplicar los cambios del "Changelog reproducible" (si no los pusheaste).

---

## 1. Qué es OLManager (resumen del análisis)

**Open League Manager** — juego de simulación de gestión de esports de League of Legends
(estilo Football Manager), open source, en estado **pre-alpha**. Fork migrado a medias desde
**OpenFootManager** (de ahí buena parte de la deuda técnica).

### Stack
- **Frontend:** React 19 + TypeScript ~6.0 + Vite 8 + Tailwind 4 + Zustand + i18next (8 idiomas)
  + react-router 7 + Zod. Tipos TS generados desde Rust con `ts-rs`.
- **Backend:** Rust 1.80+ con **Tauri v2.10**, arquitectura hexagonal / DDD. Crate único `olm_core`
  (dominio, motor de simulación, repositorios). Persistencia **SQLite por partida** (`rusqlite`,
  59 migraciones).
- **Tests:** Vitest + RTL + jsdom (frontend, 128 archivos), Rust (19 suites integración + 50 inline).
  Playwright configurado pero **`e2e/` no existe**.

### Arquitectura (alto nivel)
```
React (WebView) → Zustand stores → services/ → ApiClient (adapter)
  → Tauri IPC invoke() → src-tauri/src/commands/ (handlers delgados)
    → src-tauri/src/application/ (orquestación) → olm_core (dominio/motor/DB) → SQLite
```

### Riesgos / deuda técnica clave (del análisis)
1. **`sim_live.rs` = 6.383 líneas** — el motor de simulación es un monolito. Otros grandes:
   `transfers.rs` (3.064), `ChampionDraft.tsx` (3.345), `squad.rs` (2.084).
2. **483 `.unwrap()` en `olm_core`** + 67 en comandos → pánicos en runtime potenciales.
3. **Migración football→LoL incompleta** (~53 remanentes: `home_goals`, `GoalsScored`, etc.).
4. **`src/ui-v2/_legacy/` NO es legacy** — contiene rutas ACTIVAS (`MainMenu`, `MatchSimulation`,
   `ChampionDraft`). Confunde sobre qué código es el bueno.
5. **CI con frenos desactivados** — `clippy`/`fmt` con `continue-on-error: true`.
6. **`csp: null`** en `tauri.conf.json` — CSP deshabilitada.
7. Menores: semilla fija `seed_from_u64(42)` en IA de contratos, dos versiones de `rand`,
   migraciones con números duplicados (v028 x2, V44/V55 repetidas).

---

## 2. Qué hicimos en esta sesión

### Tarea A — Eliminación de la implementación web ✅
Decisión del usuario: el web es un "intento fallido que se hará de 0 en el futuro".

**Decisión arquitectónica clave:** se borró la implementación web PERO se **conservó la costura
del Adapter** (`getApiClient()` + interfaz `ApiClient` + `tauri.adapter.ts`), porque esa
abstracción **sostiene los tests** (inyectan adapters mockeados vía `setApiClient`) y es el punto
limpio donde enchufar el web nuevo en el futuro. NO se colapsó a Tauri directo (habría roto tests
y destruido una abstracción útil).

**Archivos borrados:**
- `src/api/adapters/http.adapter.ts`
- `docs/nginx.conf`
- `.github/workflows/deploy.yml` (deploy web a Hetzner/Docker/Supabase; estaba roto — faltaban
  `Dockerfile.backend` y `Dockerfile.frontend`, que nunca existieron en el repo)
- Dependencia `@supabase/supabase-js` removida de `package.json` (declarada pero jamás importada)

**Hallazgos:** el crate `src-tauri/crates/server` que mencionaba `ARCHITECTURE.md` **no existía**
(workspace solo tiene `crates/olm_core`). Era un crate fantasma documentado.

⚠️ **Pendiente externo (fuera del repo):** había una **Supabase publishable key hardcodeada** en
el `deploy.yml` borrado (tipo `anon`, pública por diseño, pero apuntaba a un proyecto Supabase real:
`https://zqvppsruobmmpssrgzbj.supabase.co`). Si ese proyecto sigue vivo, conviene darlo de baja
desde el panel de Supabase.

### Tarea B — `tsc` en verde (4 errores de tipos) ✅
**Verificado con `git stash`:** los 4 errores eran **pre-existentes en 0.3.6**, NO los introdujo
la eliminación del web. La rama de release no pasaba el type-check de fábrica (porque el CI corre
con `continue-on-error`). Tras los fixes, `npm run build:types` → **exit 0**.

Dos familias de error:
- **`null` vs `undefined` (avatares):** `<img src>` acepta `string | undefined`, no `null`, y
  `assetUrl()` devuelve `string | null`. **NO se tocó el util compartido** (lo usan `teamLogos.ts`
  y `playerPhotos.ts` devolviendo `null` a propósito) — se coercionó en el borde con `?? ""`.
- **`TFunction`:** la prop `t` de `CoherenceSummary` tenía un tipo hecho a mano demasiado estrecho.
  Se cambió por `TFunction` de i18next → un fix en la definición resolvió los 2 call sites.

### Tarea C — Frenos del CI: investigado, NO tocado ⏸️
Hay **6** `continue-on-error: true` en `.github/workflows/pr.yml` (líneas 63, 70, 76, 96, 107, 165):
`cargo fmt --check`, `cargo clippy` (x2), `cargo check -p openleaguemanager --lib`, `npm audit`,
`cargo audit`.

**Decisión: NO flipearlos a ciegas.** Principio: *un freno solo se activa cuando el check está en
verde.* Evidencia de que varios están en ROJO:
- `cargo clippy --workspace --all-targets` no compila entero (el `--all-targets` arrastra targets
  de test que fallan).
- El comentario de la línea 74 ("tests blocked by `lol_sim_v2.rs`") **está viejo/miente**: ese
  archivo **ya no existe** en el repo (solo aparece en docs archivadas). El bloqueo real actual es otro.

**El baseline del frontend YA tiene dientes:** `npm test` y `npm run build:types` (pr.yml líneas
126-130) NO tienen `continue-on-error` y están en verde. Para simplificar archivos TS, la red ya está.

### Tarea D — Toolchain de Rust instalado ✅
El equipo no tenía Rust. Instalado vía **scoop** (estaba disponible; no había winget/choco/admin):
- **Rust** `rustc`/`cargo` **1.96.0**, `rustfmt` 1.9.0, `clippy` 0.1.96
- **Toolchain por defecto: `stable-x86_64-pc-windows-gnu`** (GNU, no MSVC)
- **MinGW GCC 16.1.0** como linker/compilador C (para `rusqlite` bundled, etc.)
- **WebView2** ya estaba instalado (v149)

**Por qué GNU y no MSVC:** MSVC Build Tools no era instalable acá (sin winget/admin, descarga de
varios GB). El toolchain GNU cubre al 100% verificar los gates (`fmt`/`clippy`/`check`/`test`).
**MSVC solo hace falta para `tauri build`/`tauri dev` de producción** (Tauri en Windows apunta a
MSVC oficialmente). Cuando llegues a empaquetar, instalá Visual Studio Build Tools (admin + GBs)
con los componentes "MSVC v143 x64/x86 build tools" + "Windows SDK".

---

## 3. Plan / estrategia acordada

**Objetivo del usuario:** invertir en simplificar el código — sintaxis más clara, "1 objetivo =
1 archivo", reducir tamaños.

**Secuencia correcta (NO empezar por partir archivos):**

1. **Baseline verde y confiable PRIMERO** (no se refactoriza un monolito de 6.000 líneas sin red):
   - ✅ Frontend: `tsc` en verde + gates ya enforced.
   - ⏸️ Rust: falta lograr que el workspace compile limpio bajo `--all-targets`, correr `cargo fmt`,
     decidir política de clippy (`-D warnings`), y RECIÉN AHÍ activar los frenos del CI uno por uno.
2. **Simplificar UN archivo grande como plantilla replicable:**
   - Blindar primero con tests de caracterización (sobre todo el simulador, que es lógica pura testeable).
   - Extraer por costuras (strangler-fig), nunca big-bang.
   - Métrica real: **"una sola razón para cambiar por archivo"**, NO bajar líneas por bajar.
     (`sim_live.rs` ya tiene submódulos — la ganancia está en clarificar límites.)

**Política sugerida para los frenos de Rust (cuando el workspace compile):**
1. Compilar limpio bajo `--all-targets` (y borrar el comentario viejo de `lol_sim_v2.rs` en pr.yml:74).
2. `cargo fmt` → commit → flipear pr.yml:63.
3. Agregar `-- -D warnings` a clippy, limpiar warnings → flipear pr.yml:70 y :165.
4. **Dejar `npm audit` y `cargo audit` (pr.yml:96, :107) NON-blocking a propósito** — un CVE nuevo
   upstream no debería bloquear un PR ajeno; son señal advisory, no gate de calidad.

---

## 4. Próximo paso inmediato (donde quedamos)

Correr la **batería de verificación de gates de Rust** (primera compilación del workspace = varios
minutos, baja+compila cientos de crates incl. SQLite vía gcc):

```powershell
# 1. Asegurar el PATH del toolchain en la sesión (scoop no lo propaga a shells nuevas siempre)
$env:Path = "C:\Users\vboxuser\scoop\persist\rustup\.cargo\bin;C:\Users\vboxuser\scoop\apps\mingw\current\bin;$env:Path"

# 2. Correr los gates desde src-tauri/
cd C:\Users\vboxuser\Desktop\OLM\OLManager\src-tauri
cargo fmt --check                              # ¿formato OK?
cargo check -p olm_core                        # ¿compila el core?
cargo test -p olm_core                         # ¿pasan los tests del core?
cargo clippy --workspace --all-targets         # ¿clippy verde? (ojo: --all-targets puede no compilar)
```
Con eso se sabe el estado real de cada gate y cuáles se pueden activar.

---

## 5. Reconstrucción del entorno (después de formatear)

Windows. Asumiendo formato limpio:

```powershell
# --- scoop (gestor de paquetes a nivel usuario, sin admin) ---
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression

# --- Node.js (frontend) ---
scoop install nodejs-lts        # o la versión 20/22 que prefieras

# --- Rust toolchain GNU + MinGW (verificación de gates, sin MSVC) ---
scoop install rustup mingw
rustup toolchain install stable-x86_64-pc-windows-gnu
rustup default stable-x86_64-pc-windows-gnu
rustup component add rustfmt clippy

# --- (opcional, solo para tauri build/dev de producción) ---
# Visual Studio Build Tools con "Desktop development with C++" (MSVC v143 + Windows SDK).
# Descarga: https://visualstudio.microsoft.com/visual-cpp-build-tools/  (admin, varios GB)
# WebView2 Runtime: normalmente ya viene en Win 10/11; si no:
#   https://developer.microsoft.com/microsoft-edge/webview2/

# --- proyecto ---
git clone --branch 0.3.6 https://github.com/NicoRuedaA/OLManager.git
cd OLManager
npm install
npm run build:types     # debe dar verde SI reaplicaste los fixes de la Tarea B
```

---

## 6. Changelog reproducible (diffs exactos)

> Reaplicar sobre un clon fresco de `0.3.6` si los cambios no se pushearon.

### Borrados
```
rm src/api/adapters/http.adapter.ts
rm docs/nginx.conf
rm .github/workflows/deploy.yml
```

### `package.json`
Quitar el script `dev:web` y `build:web`:
```diff
     "dev": "vite",
-    "dev:web": "vite --mode web",
     "build": "vite build",
-    "build:web": "vite build --mode web",
     "build:types": "tsc -p tsconfig.release.json",
```
Quitar la dependencia supabase:
```diff
     "@fontsource/oswald": "^5.2.8",
-    "@supabase/supabase-js": "^2.106.2",
     "@tauri-apps/api": "^2.11.0",
```

### `src/api/client.ts`
Reemplazar el branch no-Tauri (que cargaba `httpAdapter`) por un error claro:
```diff
   if (isTauri()) {
     // In Tauri, imports are synchronous because Vite resolves @tauri-apps
     const { tauriAdapter } = await import("./adapters/tauri.adapter")
     _client = tauriAdapter
   } else {
-    const { httpAdapter } = await import("./adapters/http.adapter")
-    _client = httpAdapter
+    // Web mode was removed in 0.3.6 and will be rebuilt from scratch. The
+    // adapter seam is intentionally kept so a future web adapter can plug in
+    // here without touching call sites or the test harness.
+    throw new Error(
+      "[ApiClient] Web mode is not supported. OLManager currently runs only under Tauri (desktop).",
+    )
   }
```

### `vite.config.ts`
1. Quitar `isWeb` y el alias web:
```diff
-export default defineConfig(async ({ mode }) => {
-  const isWeb = mode === "web";
-
+export default defineConfig(async () => {
   return {
     define: { __APP_VERSION__: JSON.stringify(pkg.version) },
     plugins: [react(), tailwindcss()],
     resolve: {
       alias: {
         "@": path.resolve(__dirname, "./src"),
-        ...(isWeb ? {} : {}),
       },
     },
```
2. Puerto fijo Tauri:
```diff
     server: {
-      port: isWeb ? 5173 : 1420,
-      strictPort: !isWeb,
+      port: 1420,
+      strictPort: true,
       host: host || false,
```
3. Quitar el bloque `proxy` (el `watch.ignored` queda igual):
```diff
       },
-      proxy: isWeb
-        ? { "/api": { target: "http://localhost:3001", changeOrigin: true } }
-        : undefined,
     },
```

### `src/ui-v2/_legacy/pages/MainMenu.tsx`
Quitar la variable muerta `isWebSession` (ocultaba "Salir" en web; sin web siempre se muestra):
```diff
   const { t, i18n } = useTranslation();
-  const isWebSession = false;
   const [menuState, setMenuState] = useState<
```
```diff
-    if (!isWebSession) {
-      items.push({ icon: <Power />, tone: "danger" as const, label: t("menu.exitGame"), onClick: () => { void handleExitApp(); } });
-    }
+    items.push({ icon: <Power />, tone: "danger" as const, label: t("menu.exitGame"), onClick: () => { void handleExitApp(); } });
     return items;
-  }, [t, menuState, isWebSession, navigate, handleOpenLoadMenu, handleExitApp]);
+  }, [t, menuState, navigate, handleOpenLoadMenu, handleExitApp]);
```

### `docs/ARCHITECTURE.md`
- Quitar la línea `System_Ext(srv, "server", "Web HTTP API (optional)")`.
- Quitar la línea `Rel(frontend, srv, "HTTP /api/* (web mode)")`.
- "workspace ... with two crates: `olm_core` and `server`." → "with a single crate: `olm_core`."
- Quitar el bullet `**`commands.rs`** — Command dispatch for web/server mode.`
- Quitar la sección entera `### `server`` y su párrafo.

### Fixes de tipos (Tarea B)

**`src/ui-v2/_legacy/components/manager/ManagerTab.tsx`** (~línea 160):
```diff
-              src={mgr.avatar_path ? assetUrl(mgr.avatar_path) : ""}
+              src={assetUrl(mgr.avatar_path) ?? ""}
```

**`src/ui-v2/dashboard/tabs/ManagerTabV2.tsx`** (~línea 130):
```diff
-                src={assetUrl(mgr.avatar_path ?? DEFAULT_MANAGER_ICON_PATH)}
+                src={assetUrl(mgr.avatar_path ?? DEFAULT_MANAGER_ICON_PATH) ?? ""}
```

**`src/ui-v2/_legacy/components/tactics/TacticsTab.tsx`**:
```diff
 import type { JSX } from "react";
+import type { TFunction } from "i18next";
 import { useEffect, useMemo, useState } from "react";
```
```diff
   gameState: GameStateData;
-  t: (key: string, fallback?: string) => string;
+  t: TFunction;
 }) {
```

---

## 7. Estado de archivos al cierre de la sesión

```
Deleted:   .github/workflows/deploy.yml
Deleted:   docs/nginx.conf
Deleted:   src/api/adapters/http.adapter.ts
Modified:  docs/ARCHITECTURE.md
Modified:  package.json
Modified:  package-lock.json          (regenerado por npm install; sin supabase)
Modified:  src/api/client.ts
Modified:  src/ui-v2/_legacy/pages/MainMenu.tsx
Modified:  src/ui-v2/_legacy/components/manager/ManagerTab.tsx
Modified:  src/ui-v2/dashboard/tabs/ManagerTabV2.tsx
Modified:  src/ui-v2/_legacy/components/tactics/TacticsTab.tsx
Modified:  vite.config.ts
```
`npm run build:types` → **exit 0** (verde).
Gates de Rust → **sin verificar todavía** (siguiente paso).
