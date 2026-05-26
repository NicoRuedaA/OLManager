# Champion Images — Migración a Local

## Resumen

Se eliminó la dependencia externa de **Data Dragon (Riot CDN)** y **CommunityDragon** para las imágenes de campeones de League of Legends. Ahora todas las imágenes se sirven desde archivos locales en `public/`.

## Cambios Realizados

### Assets descargados
- **172 tiles** en `public/champion-tiles/{nombre}.webp` — íconos cuadrados para listas y grids
- **172 splashes** en `public/champion-splash/{nombre}.webp` — imágenes de fondo para perfiles y páginas de campeón
- **Datos estáticos** en `data/draft/champion-list.json` — lista de campeones con key, id, name, tags para el ChampionDraft

### Script de descarga
- `scripts/download-champion-assets.mjs` — descarga tiles, splashes y datos desde DDragon y los convierte a webp
- `npm run download:champions` — comando para ejecutar la descarga

### Limpieza de librería
- `src/lib/championImages.ts` — se eliminaron `ddragonTileUrl()` y `ddragonSplashUrl()`, solo quedan `resolveChampionTile()` y `resolveChampionSplash()` con paths locales
- `src/lib/championImages.test.ts` — se eliminaron los tests de las funciones DDragon
- `src/lib/championIds.ts` — se agregó `yunara` al mapping (campeón custom ID 804)

### Componentes migrados (11)

| Componente | Cambio |
|---|---|
| `ChampionPage` | Eliminado fallback a DDragon, usa solo ruta local |
| `ChampionCard` | Eliminado fallback a DDragon |
| `ChampionsGrid` | Eliminado fallback a DDragon |
| `ChampionsTab` | Eliminado fallback a DDragon |
| `SquadRosterView` | Eliminado fallback a DDragon |
| `PlayerProfileChampionsCard` | Eliminado fallback a DDragon |
| `HomeRosterLineupCard` | Eliminado fallback a DDragon |
| `PlayerProfileHeroCard` | Eliminado fetch a DDragon para splash, usa skin 0 local |
| `ChampionDraft` | Carga datos desde `champion-list.json` local + imágenes locales |
| `LolLiveMap` | Usa imágenes locales en canvas |
| `LolMatchLive` | Usa imágenes locales |
| `render.ts` (prototype) | Usa imágenes locales en canvas |
| `panels.tsx` (prototype) | Usa imágenes locales |

## URLs externas que siguen activas (fuera de scope)

Estas URLs NO son imágenes de campeones — son recursos distintos que quedan para otro cambio:

### DDragon — Items, spells y datos de simulación

| Archivo | URL | Propósito |
|---------|-----|-----------|
| `LolMatchLive.tsx` | `ddragon.../data/en_US/champion.json` | Stats de simulación (HP, rango, ultimates) |
| `LolMatchLive.tsx` | `ddragon.../data/en_US/champion/{id}.json` | Detalle de champion para simulación |
| `LolMatchLive.tsx` | `ddragon.../img/spell/{image}.png` | Iconos de spells (summoners, ultimates) |
| `panels.tsx` | `ddragon.../img/item/3340.png` | Icono de wards (item) |
| `panels.tsx` | `ddragon.../img/spell/{icon}.png` | Iconos de summoner spells |
| `render.ts` | `ddragon.../img/spell/YorickR.png` | Icono de pet (maiden) |
| `render.ts` | `ddragon.../img/spell/IvernR.png` | Icono de pet (daisy) |
| `render.ts` | `ddragon.../img/spell/HallucinateFull.png` | Icono de pet (shaco clone) |
| `render.ts` | `ddragon.../img/spell/AnnieR.png` | Icono de pet (tibbers) |

### CommunityDragon — Position icons y ranked crests

| Archivo | URL | Propósito |
|---------|-----|-----------|
| `ChampionDraft.tsx` | `icon-position-*.webp` | Íconos de rol (top/jungle/mid/adc/support) |
| `ChampionsGrid.tsx` | `icon-position-*.png` | Íconos de rol |
| `ChampionsTab.tsx` | `ranked-mini-crests/*.png` | Crests de ranked (challenger/grandmaster/master) |
| `SquadRosterView.tsx` | `icon-position-*.png` | Íconos de rol |
| `YouthAcademyTab.tsx` | `icon-position-*.png` | Íconos de rol |
| `TeamProfileRosterCard.tsx` | `icon-position-*.png` | Íconos de rol |
| `TacticsTab.tsx` | `icon-position-*.png` | Íconos de rol |
| `ScoutingPlayerSearchCard.tsx` | `icon-position-*.png` | Íconos de rol |
| `PreMatchLineup.tsx` | `icon-position-*.png` | Íconos de rol |
| `TrainingTab.tsx` | `ranked-mini-crests/*.png` | Crests de ranked |
| `LolMatchLive.tsx` | `communitydragon.../currency.webp` | Icono de oro |

## Tareas pendientes
- Verificación visual manual de tiles/splashes en todos los componentes afectados

## Cómo regenerar los assets
```bash
npm run download:champions
```
