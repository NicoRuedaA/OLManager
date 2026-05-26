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

## Lo que queda fuera de scope
- Position icons, ranked crests, role icons — siguen usando URLs externas
- Fetch de `champion.json` en `LolMatchLive` — necesario para stats de simulación (HP, attack range, ultimates), no es de imágenes
- Verificación visual manual de tiles/splashes en todos los componentes afectados

## Cómo regenerar los assets
```bash
npm run download:champions
```
