# Academy JSON Reference

## 📁 Estructura de archivos

```
data/erls/competitions/{id}/
  manifest.json
data/erls/teams/{id}_teams.json
data/erls/players/{id}_players.json
```

Donde `{id}` es el identificador único de la competición (ej: `lck-cl`, `tcl`, `lrn`, etc.)

---

## 📄 `manifest.json`

```json
{
  "id": "lck-cl",
  "name": "LCK CL",
  "full_name": "LCK Challenger League Series",
  "region": "LCK CL",
  "country": "KR",
  "tier": 2,
  "logo": "/competitions-icons/lck-cl.webp",
  "teams_file": "erls/teams/lck-cl_teams.json",
  "players_file": "erls/players/lck-cl_players.json",
  "reputation": 3,
  "nearby_country_codes": [],
  "schedule": {
    "format": "single_round_robin",
    "team_count": 10,
    "preseason_friendlies": 3,
    "splits": [
      {
        "name": "Spring",
        "best_of": 1,
        "playoffs": null,
        "season_start": { "month": 1, "day": 1 },
        "superweek_offsets": []
      }
    ]
  }
}
```

### Campos

| Campo | Tipo | Obligatorio | Default | Descripción |
|-------|------|-------------|---------|-------------|
| `id` | string | ✅ | — | ID único. Debe coincidir con el nombre de la carpeta. |
| `name` | string | ✅ | — | Nombre visible de la competición. |
| `full_name` | string | ❌ | — | Nombre completo extendido. |
| `region` | string | ✅ | — | Región (p.ej. "LCK CL", "EMEA"). |
| `country` | string | ✅ | — | Código ISO 3166-1 alpha-2 (p.ej. "KR", "TR"). |
| `tier` | number | ✅ | — | Usar `2` para academias. |
| `logo` | string | ❌ | — | Ruta al logo, ej: `/competitions-icons/lck-cl.webp`. |
| `teams_file` | string | ✅ | `"teams.json"` | Ruta relativa a `data/`. **Siempre usar `erls/teams/{id}_teams.json`**. |
| `players_file` | string | ✅ | `"players.json"` | Ruta relativa a `data/`. **Siempre usar `erls/players/{id}_players.json`**. |
| `reputation` | number | ❌ | `3` | Reputación de la ERL (1-5). Si no está, default 3. |
| `nearby_country_codes` | string[] | ❌ | `[]` | Países vecinos para adquisición fallback. **Vacío = global (cualquier país puede adquirir esta academia)**. |
| `schedule` | object | ✅ | — | Configuración del calendario de la competición. |

### Reglas importantes

- `teams_file` y `players_file` SIEMPRE con prefijo `erls/teams/` y `erls/players/`
- `nearby_country_codes` vacío = cualquier país puede adquirir esta academia como fallback
- `reputation` si no está = 3 (valor estándar tier 2)

---

## 📄 `{id}_teams.json`

```json
{
  "name": "LCK CL Teams",
  "description": "LCK CL - 2026 Season",
  "teams": [
    {
      "id": "team-xxx",
      "name": "BNK FEARX Youth",
      "short_name": "BNK.Y",
      "country": "KR",
      "city": "",
      "logo_url": "/teams-icons/bnk-fearx-youth.webp",
      "colors": {
        "primary": "#db2777",
        "secondary": "#f472b6"
      },
      "team_kind": "Main",
      "reputation": 300,
      "finance": 2000000,
      "wage_budget": 1000000,
      "transfer_budget": 400000,
      "arena_name": "Youth Arena",
      "arena_capacity": 1500,
      "facilities": {
        "medical": 1,
        "scouting": 1,
        "training": 1,
        "main_hub_level": 1,
        "scrims_room_level": 0,
        "scouting_lab_level": 0,
        "analysis_room_level": 0,
        "bootcamp_area_level": 0,
        "content_studio_level": 0,
        "recovery_suite_level": 0
      },
      "lol_tactics": {
        "fight_plan": "FrontToBack",
        "strong_side": "Top",
        "jungle_style": "Enabler",
        "draft_strategy": "Balanced",
        "support_roaming": "Lane"
      },
      "scrim_reputation": 40,
      "training_focus": "Scrims",
      "training_intensity": "Medium",
      "training_schedule": "Balanced",
      "scrim_weekly_slots": 5,
      "form": [],
      "history": [],
      "scrim_results": [],
      "training_groups": [],
      "financial_ledger": [],
      "season_income": 0,
      "season_expenses": 0,
      "manager_id": null,
      "parent_team_id": null,
      "academy_team_id": null,
      "academy": null,
      "academy_lifecycle": null,
      "sponsorship": null
    }
  ]
}
```

### Campos obligatorios mínimos

```json
{
  "id": "team-xxx",
  "name": "Nombre del equipo",
  "short_name": "SHRT",
  "country": "KR"
}
```

### Campos que se pueden omitir

`form`, `history`, `scrim_results`, `training_groups`, `financial_ledger` → arrays vacíos
`season_income`, `season_expenses` → 0
`manager_id`, `parent_team_id`, `academy_team_id`, `academy`, `academy_lifecycle`, `sponsorship` → null

### ⚠️ Vinculación con LEC parent para crear Academia

El `name` del equipo debe coincidir (normalizado) con el alias del equipo LEC parent. La normalización: lowercase + solo caracteres alfanuméricos ASCII.

| ERL team name | LEC parent | Alias esperado |
|--------------|-----------|---------------|
| `"Movistar KOI Fénix"` | Movistar KOI | `movistarkoifnix` |
| `"G2 Nord"` | G2 Esports | `g2nord` |
| `"GiantX Itero"` | GIANTX | `giantxitero` |
| `"Karmine Corp Blue"` | Karmine Corp | `karminecorpblue` |
| `"Team Vitality Bee"` | Team Vitality | `teamvitalitybee` |
| `"Team Heretics Academy"` | Team Heretics | `teamheretics` |

Si **no** hay LEC parent que matchee, el equipo igual se carga como equipo de la competición, pero **no se crea un equipo academy** para él. Solo los que matchean se convierten en academias linkeadas con `team_kind: Academy`.

---

## 📄 `{id}_players.json`

```json
{
  "name": "LCK CL Players",
  "description": "LCK CL - 2026 Season",
  "players": [
    {
      "id": "player-xxx",
      "team_id": "team-yyy",
      "match_name": "Peter",
      "full_name": "Jeong Yoon-su",
      "nationality": "KR",
      "position": "Support",
      "natural_position": "Support",
      "date_of_birth": "2003-04-28",
      "overall": 78,
      "potential_base": 85,
      "attributes": {
        "laning": 66,
        "mechanics": 76,
        "discipline": 82,
        "macro_play": 70,
        "consistency": 68,
        "shotcalling": 62,
        "teamfighting": 74,
        "champion_pool": 72,
        "mental_resilience": 70
      },
      "wage": 50000,
      "market_value": 750000,
      "contract_end": "2026-11-16",
      "profile_image_url": "/player-photos/player-xxx.webp",
      "alternate_positions": [],
      "champion_mastery": [],
      "morale": 100,
      "condition": 100,
      "fitness": 100,
      "injury": null,
      "stats": { "appearances": 0 },
      "career": [],
      "loan_listed": false,
      "transfer_listed": false,
      "transfer_offers": [],
      "morale_core": {},
      "training_focus": null,
      "champion_training_target": null,
      "champion_training_targets": [],
      "potential_revealed": null,
      "potential_research_eta_days": null,
      "potential_research_started_on": null,
      "birth_country": null
    }
  ]
}
```

### Campos obligatorios mínimos

```json
{
  "id": "player-xxx",
  "team_id": "team-yyy",
  "match_name": "Peter",
  "full_name": "Jeong Yoon-su",
  "nationality": "KR",
  "position": "Support",
  "natural_position": "Support",
  "date_of_birth": "2003-04-28",
  "overall": 78,
  "potential_base": 85,
  "attributes": {
    "laning": 66, "mechanics": 76, "discipline": 82,
    "macro_play": 70, "consistency": 68, "shotcalling": 62,
    "teamfighting": 74, "champion_pool": 72, "mental_resilience": 70
  }
}
```

### Notas sobre campos

- `team_id` debe coincidir con el `id` de algún equipo en el `teams.json`
- `position` acepta: `Top`, `Jungle`, `Mid`, `ADC`, `Support` (case-insensitive)
- `attributes` todos los valores 0-99
- `morale` default 68, `condition` default 100 si no se especifican
- `profile_image_url` puede ser ruta local o null

---

## 🧠 Flujo completo

```
data/erls/competitions/{id}/manifest.json
  ↓ scan_competitions() lo detecta automáticamente
  ↓ load_competition_teams() carga los equipos
  ↓ load_competition_players() carga los jugadores

bootstrap_academy_pool_from_erl_json()
  → para cada ERL, para cada equipo:
    → si matchea con un parent LEC → crea equipo Academy con datos reales del JSON
    → si NO matchea → queda como equipo "Main" de la competición

academy_erl_catalog() + example_academy_seed_catalog()
  → escanean data/erls/competitions/ dinámicamente en runtime
  → alimentan el sistema de adquisición de academias en plena partida
```

### Agregar una ERL nueva = crear 3 archivos

```
data/erls/competitions/mi-competition/manifest.json
data/erls/teams/mi-competition_teams.json
data/erls/players/mi-competition_players.json
```

Sin tocar código. El sistema lo detecta automáticamente.
