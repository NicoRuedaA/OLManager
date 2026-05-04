# Roadmap: Leaguepedia Scraper → OLManager

> Extraer automáticamente jugadores, equipos e imágenes de todas las ligas profesionales de LoL desde Leaguepedia para alimentar el juego con datos reales, actualizables y con imágenes WebP optimizadas.

## Visión General

Reemplazar los archivos JSON hand-crafted (`lec_world.json`, `data/lec/draft/players.json`) por un pipeline de scraping automático que:

1. Extrae datos de Leaguepedia via MediaWiki Cargo API
2. Descarga y convierte imágenes a WebP
3. Genera un JSON unificado `world.json` + carpeta `player-photos/`
4. Se integra transparentemente con `game.rs::start_new_game()`

---

## Fase 0: Investigación y Prototipo — 2-3 días

**Objetivo:** Validar que podemos obtener todos los datos necesarios sin parsear HTML.

### Tareas

- [ ] **Estudio de la API de CargoTables de Leaguepedia**
  - Documentar las tablas disponibles: `Players`, `Teams`, `Tournaments`, `Leagues`, `MatchSchedule`
  - Mapear campos de `Players`: `ID`, `Name`, `NameFull`, `Birthdate`, `Country`, `Role`, `Team`, `Image`, `IsRetired`, `Residency`, `ContractEnd`
  - Verificar que `|Image|` devuelve URLs accesibles de `static.lol.fandom.com`
  - Probar queries con `action=cargoquery&tables=Players&fields=...&limit=500`

- [ ] **Prototipo Node.js/TS**
  - Script que ejecuta una query Cargo contra LEC y LEC → guarda JSON
  - Verificar que los campos `Role` vienen normalizados (Top, Jungle, Mid, Adc, Support)
  - Verificar que `Country` viene como ISO code o full name

- [ ] **Prueba de descarga de imágenes**
  - Tomar 5 URLs de imagen de la query
  - Descargar con `fetch` + `sharp` para convertir a WebP
  - Medir tamaños: original vs WebP
  - Validar que la calidad 80% es aceptable visualmente

- [ ] **Decisión de arquitectura**
  - ¿Monorepo dentro de OLManager (`scraper/`) o repo separado?
  - ¿TypeScript puro o Rust (`reqwest` + `serde_json` + `image`)?
  - ¿Rate limiting: cuánto tarda scrapear 1500 jugadores?

### Entregable

- Informe con campos mapeados, URLs de imágenes probadas, estimaciones de tiempo
- `scraper/test-output/lec-preview.json` con 5 jugadores de muestra

---

## Fase 1: Scraper Core — 5-7 días

**Objetivo:** Implementar el scraper completo con extracción de datos de todas las ligas.

### Tareas

- [ ] **Configuración del proyecto**
  - Inicializar `scraper/` con `package.json`, `tsconfig.json`
  - Dependencias: `typescript`, `tsx`, `sharp`, `p-limit` (concurrency)
  - `.env` con `LEAGUEPEDIA_API_URL=https://lol.fandom.com/api.php`

- [ ] **Cliente de API (`src/api.ts`)**
  - Función genérica `cargoQuery(tables, fields, where, limit, offset)`
  - Paginación automática: itera `offset` de 500 en 500 hasta que `result.length < 500`
  - Rate limiting: 200ms delay entre requests
  - Retry con exponential backoff (3 intentos)
  - Cache local en `scraper/.cache/` para no repetir queries idénticas

- [ ] **Scraper de ligas (`src/leagues.ts`)**
  - Config con lista de ligas target: `lec`, `lck`, `lpl`, `lcs`, `pcs`, `vcs`, `lla`, `cblol`, `ljl`, `lco`
  - Para cada liga: query `Teams` table → devuelve `{team_id, team_name, short_name, league, region}`
  - Output: `output/leagues.json`

- [ ] **Scraper de equipos (`src/teams.ts`)**
  - Para cada liga, extraer equipos con su roster
  - Query `Teams` + filtro por liga
  - Normalizar nombres cortos (fnatic → FNC, g2-esports → G2)
  - Detectar logos via Cargo si están disponibles
  - Output: `output/teams.json`

- [ ] **Scraper de jugadores (`src/players.ts`)**
  - Query paginada de `Players` para CADA liga (where: `Teams.League = "LEC"`)
  - Para cada jugador, extraer:
    ```
    ID, Name (IGN), NameFull, Birthdate, Country, Role,
    Team, IsRetired, Residency, ContractEnd, Image
    ```
  - Post-procesamiento:
    - `birthdate` → validar formato ISO 8601
    - `country` → convertir a ISO 3166-1 alpha-2 si viene como nombre
    - `role` → normalizar (Mid → Mid, Midlaner → Mid, Support → Support)
    - `is_retired` → mapear a `status: "Active" | "Retired"`
    - `image` → extraer URL limpia, guardar para Fase 2
  - Generar `photo_id` determinístico: `sha256(league + team + ign)[:8]`
  - Output: `output/players.json`

- [ ] **Free agents (`src/free-agents.ts`)**
  - Jugadores con `Team = null` o `IsRetired = true`
  - También scrapear la tabla `FreeAgents` si existe en Cargo
  - Output: incluido en `players.json` con `status: "Free Agent"` y `team_id: null`

- [ ] **Progress bar y logging**
  - `[lec        ] teams: 10/10   players: 58/60   page: 1/1`
  - Tiempo total de ejecución al final

### Entregable

- `scraper/output/leagues.json` — ~15 ligas
- `scraper/output/teams.json` — ~80 equipos
- `scraper/output/players.json` — ~1500 jugadores
- Log de ejecución con timing por liga

---

## Fase 2: Pipeline de Imágenes — 3-4 días

**Objetivo:** Descargar todas las imágenes de jugadores, convertirlas a WebP y organizarlas.

### Tareas

- [ ] **Sistema de descarga (`src/images/download.ts`)**
  - Leer `players.json` → extraer todas las `photo_url` únicas
  - Descargar en paralelo con `p-limit(5)` (5 concurrentes max)
  - Rate limit: 200ms entre cada descarga (para no banear IP)
  - Timeout: 10s por imagen
  - Retry: 2 intentos
  - Cache incremental: si la imagen ya existe en `player-photos/`, saltear

- [ ] **Conversión a WebP (`src/images/convert.ts`)**
  - Usar `sharp` para:
    - Redimensionar a 256x256 (cover, centrado)
    - Convertir a WebP calidad 80
    - Strip metadata (EXIF, ICC, XMP)
  - Generar `@2x` (512x512) opcional
  - Guardar como `{photo_id}.webp` y `{photo_id}@2x.webp`
  - Organizar por liga: `player-photos/{league_id}/{photo_id}.webp`

- [ ] **Fallback images**
  - Si la descarga falla, usar un placeholder según rol:
    - `player-photos/_fallback/top.webp`
    - `player-photos/_fallback/jungle.webp`
    - etc.
  - O un placeholder genérico con las iniciales del IGN

- [ ] **Estadísticas de imágenes**
  - Total descargadas / total intentadas
  - Tamaño promedio original vs WebP
  - Errores y fallbacks

### Entregable

- `scraper/output/player-photos/` con todas las imágenes WebP
- Archivo de log con estadísticas de descarga
- Imágenes de fallback por rol

---

## Fase 3: Normalización y Deduplicación — 2-3 días

**Objetivo:** Asegurar que los datos son consistentes, sin duplicados, y listos para consumir.

### Tareas

- [ ] **Normalización de datos (`src/normalize.ts`)**
  - **Nacionalidades:** tabla `country_name → ISO-3166-1-alpha-2` + emoji flag
    ```
    "South Korea" → "KR" 🇰🇷
    "Denmark"     → "DK" 🇩🇰
    "United States" → "US" 🇺🇸
    ```
  - **Roles:** canonicalización estricta
    ```
    Top, Toplaner, Top Laner → "Top"
    Jungle, Jungler, Jungla → "Jungle"
    Mid, Midlaner, Mid Laner → "Mid"
    Adc, Bot, Ad Carry, ADC → "Adc"
    Support, Sup → "Support"
    ```
  - **Fechas:** asegurar que birthdate es `YYYY-MM-DD`, contract_end igual
  - **Nombres:** trim, remover espacios múltiples, tildes → ASCII para search key

- [ ] **Deduplicación (`src/deduplicate.ts`)**
  - Un mismo jugador puede aparecer en múltiples ligas (ej. Caps en LEC + Worlds)
  - Criterio de duplicado: mismo `Name` (IGN) + misma `Birthdate` o mismo `NameFull`
  - Estrategia:
    1. Agrupar por `ign` normalizado
    2. Dentro de cada grupo, mergear campos
    3. `league_id` → array de ligas donde jugó (historial)
    4. `team_id` → el más reciente (o priorizar tier 1)
    5. `photo_id` → mantener el de la liga principal
  - Output: jugadores únicos con `previous_leagues: []` y `previous_teams: []`

- [ ] **Validación (`src/validate.ts`)**
  - Verificar que todos los players tienen `id`, `ign`, `nationality`, `role`
  - Verificar que todas las `photo_id` referencian imágenes existentes
  - Verificar que `team_id` apunta a un equipo en `teams.json`
  - Reporte de warnings: campos faltantes, roles desconocidos, etc.

### Entregable

- `scraper/output/players-deduped.json` — jugadores únicos
- `scraper/output/teams-deduped.json` — equipos únicos
- Reporte de validación con warnings/errores

---

## Fase 4: Integración con OLManager — 4-5 días

**Objetivo:** Conectar el output del scraper con el sistema de juego actual.

### Tareas

- [ ] **Generador de `world.json` unificado (`src/output.ts`)**
  - Formato final compatible con `WorldData` (estructura de `load_world_from_json`)
  - Campos obligatorios: `name`, `description`, `teams[]`, `players[]`, `staff[]`
  - Cada player debe tener:
    - `id`, `match_name` (← ign), `full_name`
    - `date_of_birth`, `nationality` (ISO)
    - `position` (← role, mapeado a `LolRole` enum)
    - `team_id` (o null para free agents)
    - `attributes` → generados desde role + rating (si no hay stats reales, usar sistema actual de `build_attributes_from_seed`)
    - `contract_end`, `wage`, `market_value` → defaults si no existen en scrape
    - `profile_image_url` → ruta relativa a imágenes webp
    - `potential_base` → estimado desde role + edad

- [ ] **Adaptar `game.rs::start_new_game()`**
  - `resolve_default_world_path()` → apunta al nuevo `world.json`
  - Si el JSON tiene `profile_image_url`, usar esa en vez del seed system
  - `inject_seed_free_agents()` → ya no necesario (vienen en el JSON)
  - Agregar flag `scraped_at` para saber antigüedad de los datos

- [ ] **Servir imágenes via Vite**
  - Mover `player-photos/` a `public/player-photos/` (o `src-tauri/resources/`)
  - `resolvePlayerPhoto()` en frontend → construye path desde `photo_url` o `photo_id`
  - Lazy loading con `<img loading="lazy">` para no cargar todas de golpe
  - Placeholder shimmer mientras carga

- [ ] **Free agents en transfers/scouting**
  - Los jugadores con `team_id = null` aparecen en scouting/transfers
  - Market value y wage estimados desde OVR si no vienen en el scrape
  - Filtro por liga/región en el scouting tab

- [ ] **Testing de integración**
  - Crear nuevo juego con el `world.json` scrapeado
  - Verificar que todos los equipos tienen 5 jugadores mínimo
  - Verificar que las imágenes cargan correctamente
  - Verificar que los free agents aparecen en transfers

### Entregable

- `scraper/output/world.json` — reemplazo completo de `lec_world.json`
- `scraper/output/world.teams.json` — solo equipos (para team selection)
- `scraper/output/world.players.json` — todos los jugadores
- `player-photos/` copiado a `src-tauri/resources/` o `public/`
- Tests de integración pasando

---

## Fase 5: Automatización y Mantenimiento — 2-3 días

**Objetivo:** Hacer que el scraper sea ejecutable periódicamente con soporte para actualizaciones incrementales.

### Tareas

- [ ] **Modo incremental (`--incremental`)**
  - Comparar `scraped_at` del run anterior
  - Solo re-scrapear jugadores donde `Modified` > último scrape
  - Actualizar fotos solo si cambió la URL
  - Fallback a full scrape si el último fue hace >30 días

- [ ] **CLI (`scraper/cli.ts`)**
  ```
  npm run scrape -- --leagues lec,lck,lcs          # Solo ciertas ligas
  npm run scrape -- --full                          # Full scrape
  npm run scrape -- --incremental                   # Solo cambios
  npm run scrape -- --images-only                   # Solo re-descargar imágenes
  npm run scrape -- --validate                      # Solo validar output
  ```

- [ ] **GitHub Actions (`.github/workflows/scrape.yml`)**
  - Schedule: cada domingo a las 00:00 UTC
  - O manual con `workflow_dispatch`
  - Steps:
    1. Checkout repo
    2. `npm install` en `scraper/`
    3. `npm run scrape -- --incremental`
    4. Commit + PR automático con los cambios
  - Guardar `world.json` como asset del workflow

- [ ] **Notificaciones**
  - Si el scrape falla → log en el PR
  - Si hay < 1000 jugadores → alerta (probablemente la API cambió)
  - Si hay >50 imágenes fallidas → warning

### Entregable

- CLI funcional con todos los flags
- Workflow de GitHub Actions programado
- PR automático con cambios cada semana

---

## Resumen de Fases

| Fase | Duración | Prioridad | Output principal |
|------|----------|-----------|-----------------|
| **F0: Investigación** | 2-3 días | 🔴 Alta | Mapeo de campos, prototipo LEC |
| **F1: Scraper Core** | 5-7 días | 🔴 Alta | `players.json` + `teams.json` + `leagues.json` |
| **F2: Imágenes** | 3-4 días | 🟡 Media | `player-photos/` WebP |
| **F3: Normalización** | 2-3 días | 🔴 Alta | Datos deduplicados y validados |
| **F4: Integración** | 4-5 días | 🔴 Alta | `world.json` integrado con game.rs |
| **F5: Automatización** | 2-3 días | 🟢 Baja | CI/CD, incremental |

**Total estimado: 18-25 días** (3-5 semanas a media jornada)

---

## Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| CargoTables no tiene `ContractEnd` o `MarketValue` | Media | Bajo | Estimar con defaults basados en tier/rol |
| Leaguepedia cambia estructura de API | Baja | Alto | Phase 0 valida esto antes de invertir |
| Imágenes bloqueadas por CORS/rate limit | Media | Medio | User-Agent + delays + retry |
| Jugadores sin foto | Alta | Bajo | Fallback por rol o iniciales |
| 1500 imágenes pesan mucho en el repo | Media | Medio | Git LFS o carpeta separada con .gitignore |
| Cargo query lenta para 1500+ resultados | Baja | Medio | Cache local, queries por liga (más chicas) |

---

## Métricas de Éxito

- [ ] Scraper corre en <15 minutos para todas las ligas
- [ ] ≥95% de jugadores tienen imagen WebP válida
- [ ] 0 duplicados en `players-deduped.json`
- [ ] `world.json` carga sin errores en `start_new_game()`
- [ ] Imágenes WebP son ≥50% más chicas que las PNG originales
- [ ] GitHub Action corre semanalmente sin intervención manual

---

*Propuesta creada: 2026-05-04 — Aprobación pendiente para iniciar Fase 0*
