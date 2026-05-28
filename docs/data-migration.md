# Data Migration: Adaptación de datos de competiciones al sistema OLManager

## Resumen

Se adaptaron 12 competiciones (LEC, LCK, LPL, LCS, LCP, CBLOL, LFL, LES, LCK CL, LRN, Prime League, TCL) con sus respectivos equipos y jugadores para que sean compatibles con el sistema de carga de OLManager.

---

## 1. Estructura de archivos

```
data/
├── competitions/           ← 12 carpetas, una por competición
│   ├── cblol/manifest.json
│   ├── lck/manifest.json
│   ├── lck_c/manifest.json        ← id: "lck cl" (espacio)
│   ├── lcp/manifest.json
│   ├── lcs/manifest.json
│   ├── lec/manifest.json
│   ├── les/manifest.json
│   ├── lfl/manifest.json
│   ├── lpl/manifest.json
│   ├── lrn/manifest.json
│   ├── pl/manifest.json           ← id: "prime league"
│   └── tcl/manifest.json
│
├── teams/
│   ├── cblol_teams.json     ← 10 archivos de equipos
│   ├── lck_teams.json
│   ├── lck_cl_teams.json
│   ├── lcp_teams.json
│   ├── lcs_teams.json
│   ├── lec_teams.json
│   ├── les_teams.json
│   ├── lfl_teams.json
│   ├── lpl_teams.json
│   ├── lrn_teams.json
│   ├── prime_league_teams.json
│   └── tcl_teams.json
│
└── players/
    ├── cblol_players.json   ← 13 archivos de jugadores
    ├── lck_players.json
    ├── lck_cl_players.json
    ├── lcp_players.json
    ├── lcs_players.json
    ├── lec_players.json
    ├── les_players.json
    ├── lfl_players.json
    ├── lpl_players.json
    ├── lrn_players.json
    ├── prime_league_players.json
    ├── tcl_players.json
    └── free_agents.json
```

---

## 2. Cambios en manifest.json de competiciones

### Problemas encontrados y soluciones

| Competición | Problema | Solución |
|-------------|----------|----------|
| **lck_c** | `format: null`, `preseason_friendlies: null`, `splits: []` | Se agregó `format: "double_round_robin"`, `preseason_friendlies: 3`, `splits` con split por defecto |
| **les** | `format: null`, `preseason_friendlies: null`, `splits: []` | Se agregó `format: "single_round_robin"`, `preseason_friendlies: 3`, split por defecto |
| **lfl** | `tier: null`, `preseason_friendlies: null`, `splits: []` | Se asignó `tier: 2`, `preseason_friendlies: 3`, split por defecto |
| **lrn** | `preseason_friendlies: null` | Se asignó `preseason_friendlies: 3` |
| **pl** | `format: null`, `preseason_friendlies: null`, `splits: []` | Se agregó `format: "double_round_robin"`, `preseason_friendlies: 3`, split por defecto |

### Tiers asignados

| Tier 1 (principales) | Tier 2 (regionales) |
|----------------------|---------------------|
| CBLOL, LCK, LCP, LCS, LEC, LPL | LCK CL, LES, **LFL**, LRN, Prime League, TCL |

### Formato esperado por el sistema

```json
{
  "id": "lec",
  "name": "LEC",
  "region": "LEC",
  "tier": 1,
  "teams_file": "teams/lec_teams.json",
  "players_file": "players/lec_players.json",
  "schedule": {
    "format": "double_round_robin",
    "team_count": 10,
    "preseason_friendlies": 3,
    "splits": [ { "name": "Spring", "best_of": 1, ... } ]
  }
}
```

**Reglas:**
- `format` debe ser string (`"single_round_robin"` o `"double_round_robin"`), nunca `null`
- `preseason_friendlies` debe ser número, nunca `null`
- `splits` debe tener al menos 1 split
- `tier` debe ser número: `1` o `2`

---

## 3. Cambios en archivos de equipos (teams/*.json)

### Problemas encontrados y soluciones

| Archivo | Problema | Solución |
|---------|----------|----------|
| **lck_cl_teams.json** | Usaba `data.country` en vez de `country`. Faltaban `city`, `history`, `form`, etc. | Se normalizó `data.country` → `country`. Se agregaron campos faltantes con defaults. |
| **les_teams.json** | Faltaba `country` en algunos equipos | Se agregó `country` a partir de `data.country` |
| **lrn_teams.json** | Usaba `data.country`, `data.team_kind`. Faltaba `city` | Se normalizaron prefijos `data.`. Se agregó `city: ""` |
| **tcl_teams.json** | `colors.secondary: null`. Faltaba `history` | Se fijó `colors.secondary` a `"#000000"`. Se agregó `history: []` |
| **tcl_teams.json** | Campos faltantes: `city`, `country`, `form`, `arena_name` | Se agregaron con defaults |
| **Todos** | Arrays `null` en campos que esperan `[]` | `form`, `history`, `scrim_results`, `training_groups`, `financial_ledger` → `[]` |

### Formato esperado por el sistema

```json
{
  "name": "Teams Export",
  "description": "...",
  "teams": [
    {
      "id": "lec-g2-esports",
      "name": "G2 Esports",
      "short_name": "G2",
      "country": "DE",
      "city": "Berlin",
      "logo_url": "/teams-icons/g2-esports.webp",
      "arena_name": "",
      "arena_capacity": 2500,
      "team_kind": "Main",
      "colors": { "primary": "#...", "secondary": "#..." },
      "finance": 4500000,
      "reputation": 650,
      "wage_budget": 2250000,
      "transfer_budget": 900000,
      "facilities": { ... },
      "lol_tactics": { ... },
      "training_focus": "Scrims",
      "training_intensity": "Medium",
      "training_schedule": "Balanced",
      "scrim_reputation": 50,
      "scrim_weekly_slots": 5,
      "form": [],
      "history": [],
      "scrim_results": [],
      "training_groups": [],
      "financial_ledger": []
    }
  ]
}
```

### Valores default para campos faltantes

| Campo | Tipo | Default |
|-------|------|---------|
| `city` | string | `""` |
| `country` | string | `""` |
| `arena_name` | string | `""` |
| `arena_capacity` | int | `0` |
| `form` | array | `[]` |
| `history` | array | `[]` |
| `scrim_results` | array | `[]` |
| `training_groups` | array | `[]` |
| `financial_ledger` | array | `[]` |
| `sponsorship` | null/object | `null` |
| `academy` | null/object | `null` |
| `manager_id` | null/string | `null` |
| `parent_team_id` | null/string | `null` |
| `academy_team_id` | null/string | `null` |
| `academy_lifecycle` | null/object | `null` |
| `season_income` | int | `0` |
| `season_expenses` | int | `0` |
| `colors.secondary` | string (NUNCA null) | `"#000000"` |
| `lol_tactics.*` | string (NUNCA null) | `"Balanced"` |
| `facilities.*` | int (NUNCA null) | `0` |

---

## 4. Cambios en archivos de jugadores (players/*.json)

### Problemas encontrados

Los archivos de jugadores exportados (`export-test-lec/data/player.json`) tenían **todos los campos requeridos**: `match_name`, `full_name`, `date_of_birth`, `nationality`, `position`, `attributes` (9 stats), `market_value`, `wage`, `career`, etc.

No se requirieron cambios en los players.

---

## 5. Iconos de equipos (public/teams-icons/)

### Problema

Los archivos `.webp` tenían nombres con mayúsculas (`DN-SOOPers.webp`) pero los `logo_url` en los JSON apuntaban a minúsculas (`dn-soopers.webp`). En sistemas case-sensitive (Linux/macOS) esto causaba 404.

### Solución

Se renombraron TODOS los `.webp` a **minúsculas**:

```
DN-SOOPers.webp       → dn-soopers.webp
Nongshim-RedForce.webp → nongshim-redforce.webp
```

**Regla:** Todos los iconos en `public/teams-icons/` deben estar en minúsculas.

### Equipos SIN icono local (usan URL externa)

| Competición | Equipos afectados |
|-------------|-------------------|
| TCL | Dark Passage, BoostGate Esports, Misa Esports, Ozarox Esports, SU Esports, PCIFIC Esports, Bushido Wildcats, Team Phoenix |
| LRN | Fuego, Polar Squad Esport, NCG Esports, SDM Tigres, Zeu5 Esport, LYON Academy, G3V E-sports, Icon Esports |
| LCK CL | BNK FEARX Youth, Gen.G Global Academy, KT Rolster Challengers, HANJIN BRION Challengers, DN SOOPers Challengers, Dplus KIA Challengers, NS Esports Academy, HLE Challengers, Kiwoon DRX Challengers, T1 Esports Academy |
| LFL | Vitality Academy |
| LES | GiantX Itero, UB Alma Mater, Team Heretics Academy |
| LPL | TT Gaming |
| LCK | NS RedForce |

---

## 6. Resumen de commits

| Commit | Cambio |
|--------|--------|
| `eb6213db` | Habilitada migración V52 (multi-competition schema) |
| `fbde798d` | Limpieza de marcadores de conflicto en ChampionsTab, live_match_tests |
| `b194c847` | Agregado campo `tier` a CompetitionSummary. Show Tier 2 en UI con separador |
| `08ef9221` | Normalización de team JSONs (data.country → country) |
| `ee07a6b5` | Fix de campos faltantes en team JSONs (Python) |
| `d1d54f30` | Fix de nulls en colors/lol_tactics/facilities de todos los teams (REVERTIDO) |
| `0cdab1ab` | LFL → tier 2. Fix TCL colors.secondary null |
| `c1c62d94` | Iconos normalizados a minúsculas |

---

## 7. Pipeline de carga

```
1. scan_competitions()
   → Lee data/competitions/*/manifest.json
   → Valida schema del manifest (format, team_count, splits, tier)

2. load_competition_teams()
   → Lee data/teams/<teams_file>
   → Deserializa Vec<Team> con serde
   → Inyecta competition_id en cada equipo
   → Mapea /team-logos/ → /teams-icons/

3. get_league_selection_data()
   → Filtra por tier (ya no filtra, muestra todos)
   → Agrupa en CompetitionSummary con tier

4. Frontend (TeamSelection.tsx)
   → Agrupa competiciones por tier
   → Muestra separador "Tier 1" / "Tier 2"
```
