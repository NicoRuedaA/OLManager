# Despliegue web de OLManager

OLManager es nativo (Tauri), pero tiene un **modo web** que separa:

- **Frontend** (SPA Vite) → **Vercel**
- **Backend** (servidor Rust axum `olmanager-server`) → **Fly.io**
- **Base de datos / Auth** → **Supabase** (Postgres + JWT)

```
Navegador ──> Vercel (frontend estático)
                 │  fetch(VITE_API_BASE + /api/...)
                 ▼
            Fly.io (olmanager-server)
                 │  Postgres + verifica JWT
                 ▼
              Supabase
```

> ⚠️ Vercel **no** puede alojar el servidor Rust (es un proceso persistente, no
> serverless). Por eso el backend va en Fly.io.

---

## 0. Requisitos

- Cuenta en [Vercel](https://vercel.com) y [Fly.io](https://fly.io).
- Proyecto Supabase ya creado con las migraciones de `supabase/migrations/` aplicadas
  (tablas `profiles` y `saves`).
- CLIs:
  - `flyctl` → `curl -L https://fly.io/install.sh | sh`
  - `vercel` → ya instalado (`vercel --version`).

Variables de Supabase que necesitarás (Dashboard → Settings):
- `SUPABASE_URL` — p.ej. `https://<ref>.supabase.co`
- `SUPABASE_JWT_SECRET` — Settings → API → JWT Settings → JWT Secret
- `DATABASE_URL` — Settings → Database → Connection string → URI → pooler **Session**
  (usuario `postgres.<ref>`, password con caracteres reservados percent-encoded,
  añade `?sslmode=require`).
- `VITE_SUPABASE_URL` — igual que `SUPABASE_URL`.
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Settings → API → Project API keys → `publishable`.

---

## 1. Backend en Fly.io

Desde la raíz del repo:

```bash
flyctl auth login

# Crea la app SIN desplegar todavía (usa el fly.toml y Dockerfile del repo).
flyctl launch --no-deploy --copy-config --name olmanager-server --region mad
```

Si el nombre `olmanager-server` está ocupado, elige otro (será tu URL
`https://<nombre>.fly.dev`). Acepta usar el `fly.toml` existente.

Configura los secretos (NO se commitean):

```bash
flyctl secrets set \
  SUPABASE_URL="https://<ref>.supabase.co" \
  SUPABASE_JWT_SECRET="<jwt-secret>" \
  DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require"
```

Despliega:

```bash
flyctl deploy
```

Comprueba que vive:

```bash
curl https://<nombre>.fly.dev/health
flyctl logs
```

Apunta tu URL del backend: `https://<nombre>.fly.dev`

---

## 2. Frontend en Vercel

El repo ya trae `vercel.json` (build = `npm run build:web`, output = `dist`,
fallback SPA).

```bash
vercel login
vercel link        # crea/enlaza el proyecto
```

Añade las variables de entorno del **build** (las `VITE_*` se inyectan al compilar):

```bash
vercel env add VITE_API_BASE production
# valor: https://<nombre>.fly.dev

vercel env add VITE_SUPABASE_URL production
# valor: https://<ref>.supabase.co

vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
# valor: sb_publishable_xxx
```

(Repite con `preview`/`development` si quieres previews funcionales.)

Despliega a producción:

```bash
vercel --prod
```

El CORS del backend es permisivo, así que el frontend en `*.vercel.app` puede
llamar directamente a `https://<nombre>.fly.dev/api/...`.

### Alternativa sin CORS (rewrite)

Si prefieres mantener todo en el mismo origen, deja `VITE_API_BASE` vacío y añade
en `vercel.json` un rewrite de `/api/*` hacia Fly (sustituye la URL real):

```json
{ "source": "/api/(.*)", "destination": "https://<nombre>.fly.dev/api/$1" }
```

(colócalo **antes** del fallback SPA).

---

## 3. Notas

- **Tamaño de `dist/` (~380 MB):** son ~1800 fotos de jugadores en `public/`.
  Sube pero es lento. Si Vercel se queja por tamaño/nº de archivos, considera
  servir las fotos desde Supabase Storage o un CDN y quitarlas de `public/`.
- **Cold start:** `min_machines_running = 0` en `fly.toml` apaga la máquina sin
  tráfico (gratis). La primera petición tras inactividad tarda unos segundos.
  Ponlo a `1` para evitarlo.
- **Import de datos:** los endpoints `/api/admin/*` están desactivados salvo que
  pongas `OLM_ALLOW_IMPORT=1` / `OLM_AUTO_IMPORT=1` como secretos en Fly. No hace
  falta para jugar: la imagen ya incluye `data/`.
- **Actualizar:** `flyctl deploy` (backend) y `vercel --prod` (frontend) tras cada cambio.
