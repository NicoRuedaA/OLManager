# `src/lib/` — Reference

## Estructura

```
lib/
├── champions/       Datos de campeones (IDs, imágenes, timing de draft)
├── common/          Utilidades generales (helpers, países, validación, etc.)
├── finances/        Lógica financiera (finance, lolFinanceContracts)
├── formatting/      Formateo de fechas y valores
├── i18n/            Internacionalización de mensajes del backend
├── match/           Layout del mapa (lolMapLayout)
├── players/         Lógica de jugadores (stats, roles, fotos, identidad)
├── scrims/          Lógica de scrims (contexto semanal, preparación)
├── season/          Contexto de temporada (fechas, ventanas de transferencia)
└── teams/           Lógica de equipos (datos, logos, tácticas, staff, entrenamiento)
```

## Principios

- **Cada subdirectorio agrupa archivos por dominio funcional**, no por tipo.
- Los tests están co-locados junto a su fuente (`helpers.test.ts` al lado de `helpers.ts`).
- Las importaciones entre subdirectorios usan rutas relativas (`../players/lolPlayerStats`).
- Las importaciones desde fuera de `lib/` usan rutas relativas al archivo importador (`../../lib/formatting/dateFormatting`).

## Mapa de archivos

| Subdirectorio | Archivos | Propósito |
|---|---|---|
| `champions/` | `championIds.ts`, `championImages.ts`, `championTiming.ts` | Normalización de keys de campeones, URLs de splash art, timing de draft |
| `common/` | `helpers.ts`, `appInfo.ts`, `countries.ts`, `contractUtils.ts`, `domainConstants.ts`, `fixtures.ts`, `validation.ts`, `managerAvatars.ts` | Re-exportaciones de utilidades, países, constantes de dominio, fixture helpers |
| `finances/` | `finance.ts`, `lolFinanceContracts.ts` | Lógica financiera y de contratos de sponsors |
| `formatting/` | `dateFormatting.ts`, `valueFormatting.ts` | `formatDateShort`, `formatMatchDate`, `calcAge`, `formatVal`, etc. |
| `i18n/` | `backendI18n.ts`, `backendI18n.legacy.ts`, `backendI18nPlayerEvents.ts` | Resolución de textos traducidos del backend, compatibilidad legacy, eventos de jugadores |
| `match/` | `lolMapLayout.ts` | Layout del mapa para el motor de partidos en vivo |
| `players/` | `lolIdentity.ts`, `lolPlayerStats.ts`, `playerPhotos.ts`, `playerRating.ts`, `roleIcons.ts` | Estadísticas de jugadores, roles, fotos, rating |
| `scrims/` | `scrimContext.ts`, `lolScrimPrep.ts` | Planificación semanal de scrims, preparación de informes post-scrim |
| `season/` | `seasonContext.ts` | Contexto de temporada, ventanas de transferencia, matchdays |
| `teams/` | `team.ts`, `teamLogos.ts`, `lolStaffEffects.ts`, `lolTactics.ts`, `trainingFocus.ts` | Datos de equipos, logos, efectos de staff, tácticas, entrenamiento |

## Archivos sin imports externos

Estos archivos existen en `lib/` pero **no son importados directamente desde ningún otro archivo** del proyecto. Pueden ser código muerto o importados indirectamente a través de re-exportaciones:

- `championIds.ts` — importado por `championImages.ts` (mismo subdirectorio)
- `playerRating.ts` — importado por `helpers.ts` (`common/`)
- `fixtures.ts` — importado por `helpers.ts` (re-export)
- `valueFormatting.ts` — importado por `helpers.ts` (re-export)
- `managerAvatars.ts` — importado desde `pages/MainMenu.tsx` y `pages/Settings.tsx`

El resto está en `common/` y es importado directamente o no tiene consumidores (`validation.ts`, `appInfo.ts`).

## Historial

Reorganizado el 2025-06-05 como parte de consolidación arquitectónica. Antes era un único directorio plano con 43 archivos.
