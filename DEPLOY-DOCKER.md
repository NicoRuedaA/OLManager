# Despliegue self-hosted con Docker

Levanta OLManager (modo web) en tu propio servidor con `docker compose`:
un contenedor **backend** (servidor Rust) + un contenedor **web** (nginx que
sirve el frontend y proxya `/api` al backend). La base de datos y la
autenticación siguen en **Supabase**.

```
Navegador ──> nginx (web, puerto WEB_PORT)
                ├── /            → SPA estática (dist)
                └── /api/*       → proxy ──> backend (Rust, :8080) ──> Supabase
```

Como todo va por el mismo origen (nginx), **las fotos se sirven bien** y no hay
CORS.

## Requisitos

- Docker Engine con **Compose v2** (`docker compose`, no el viejo `docker-compose`).
  Compose v2 usa BuildKit, necesario para el `.dockerignore` por-Dockerfile.
- Acceso de salida a Supabase (HTTPS + Postgres pooler).

## Pasos

```bash
# 1. Clona el repo en el servidor
git clone <tu-repo> && cd OLManager

# 2. Crea el .env con tus secretos
cp .env.docker.example .env
nano .env        # rellena VITE_SUPABASE_*, SUPABASE_URL, SUPABASE_JWKS_URL, DATABASE_URL

# 3. Construye y levanta
docker compose up -d --build

# 4. Comprueba
docker compose ps
curl http://localhost:${WEB_PORT:-8080}/health     # → {"status":"ok"}
```

Abre `http://<ip-del-servidor>:8080` (o el `WEB_PORT` que elijas).

## Variables (.env)

| Variable | Para qué |
|---|---|
| `VITE_SUPABASE_URL` | Cliente Supabase del frontend (build) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave pública del frontend (build) |
| `SUPABASE_URL` / `SUPABASE_JWKS_URL` | Verificación de JWT en el backend |
| `DATABASE_URL` | Postgres de Supabase (pooler Session, `?sslmode=require`) |
| `WEB_PORT` | Puerto público de nginx (por defecto 8080) |
| `OLM_ALLOW_IMPORT`, `OLM_IMPORT_SOURCE` | (Opcional) endpoints de import |

> `VITE_API_BASE` se deja **vacío** a propósito: el frontend llama a `/api` en el
> mismo origen y nginx lo enruta al backend.

## Datos del juego

Los datos (`data/`) y las fotos (`public/`) van **horneados en las imágenes**.
Para actualizarlos: re-exporta desde OLMDBManager a `data/` y `public/`, y
reconstruye con `docker compose up -d --build`. (El botón "Autoimportar" escribe
en el disco efímero del contenedor y no es la vía recomendada aquí.)

## Operación

```bash
docker compose logs -f backend     # logs del servidor
docker compose logs -f web         # logs de nginx
docker compose up -d --build       # actualizar tras cambios
docker compose down                # parar
```

## HTTPS / dominio

nginx escucha en HTTP en `WEB_PORT`. Para TLS, pon por delante tu reverse-proxy
habitual (Nginx/Caddy/Traefik) apuntando a `http://127.0.0.1:${WEB_PORT}`, o pide
que te añada un servicio Caddy con TLS automático al compose.
