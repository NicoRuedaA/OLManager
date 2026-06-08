# Arquitectura de Datos — OLManager

## Estructura de archivos

```
src-tauri/data/
├── leagues.json                 
├── competitions/                ← Reglas de calendario de cada competicion
│   ├── lec/manifest.json
│   ├── cblol/manifest.json
│   └── ... (12 competiciones)
├── teams/                       ← Equipos organizados por region
│   ├── emea_teams.json          
│   ├── kr_teams.json            
│   ├── na_teams.json            
│   └── ... (15 archivos)
├── players/                     ← Jugadores organizados por region
│   ├── emea_players.json
│   ├── kr_players.json
│   └── ... (15 archivos)
├── staffs/
│   └── free_agents.json         ← Staff libre (el staff por equipo se genera proceduralmente)
├── draft/
│   └── champions.json           ← Catalogo global de champions (unico archivo vivo del draft)
├── erls/                        ← Seeds de academias (texto)
│   ├── les.txt, lfl.txt, Prime League.txt
└── leagues.json                 ← Metadata de ligas para el frontend
```

## Flujo al iniciar partida

```
Frontend: league_selection -> load_league(league_id) -> team_selection -> start_new_game(team_id)
```

1. **league_selection**: Usuario elige liga (LEC, LCK, LCS, etc.)
2. **load_league(league_id)**: Backend devuelve datos LIVIANOS (equipos, nombres, logos, OVRs) — NO crea el mundo
3. **team_selection**: Usuario elige equipo con la data liviana
4. **start_new_game(team_id)**: Backend crea el mundo COMP逼ETO con todas las ligas/regiones y asigna el equipo del usuario
5. **select_team()**: Ya no es necesario — el equipo ya viene en start_new_game

**Ventaja**: Se puede volver de team_selection a league_selection sin costo, porque load_league no crea el mundo.
