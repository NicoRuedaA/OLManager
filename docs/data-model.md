# OLManager — Data Model Reference

This document describes every field for the four core entities: **Player**, **Staff**, **Team**, and **Competition**. It is intended for developers working on the data pipeline, database, or seed files.

---

## Player (`domain::player::Player`)

Represents a League of Legends pro player.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `String` | ✅ | Unique identifier (e.g. `lec-player-98767975961872793`). |
| `match_name` | `String` | ✅ | In-game name / summoner name (e.g. `"Caps"`). |
| `full_name` | `String` | ✅ | Real full name (e.g. `"Rasmus Winther"`). |
| `date_of_birth` | `String` | ✅ | ISO 8601 date (`YYYY-MM-DD`). |
| `nationality` | `String` | ✅ | ISO 3166-1 alpha-2 country code (e.g. `"DK"`). |
| `birth_country` | `Option<String>` | ❌ | Birth country if different from nationality. |
| `profile_image_url` | `Option<String>` | ❌ | URL to player photo. Stored in `/player-photos/{id}.png`. |
| `position` | `LolRole` | ✅ | Primary role. Accepts legacy football positions via custom deserializer (see LolRole table). |
| `natural_position` | `LolRole` | ❌ | Natural role (never changed by formation logic). Defaults to `Unknown`. |
| `alternate_positions` | `Vec<LolRole>` | ❌ | Other roles the player can play. |
| `attributes` | `PlayerAttributes` | ✅ | 9 core skill ratings (0-100 each). |
| `condition` | `u8` | ❌ | 0-100. Short-term energy; depletes during matches, recovers daily. |
| `morale` | `u8` | ❌ | 0-100. Affected by team results, contract, playing time. |
| `fitness` | `u8` | ❌ | 0-100. Long-term physical state. |
| `injury` | `Option<Injury>` | ❌ | Current injury if any. |
| `team_id` | `Option<String>` | ❌ | ID of the team this player belongs to. `null` = free agent. |
| `traits` | `Vec<PlayerTrait>` | ❌ | Special traits (e.g. `Clutch`, `Inconsistent`). |
| `contract_end` | `Option<String>` | ❌ | ISO date when contract expires. |
| `wage` | `u32` | ❌ | Weekly salary in €. |
| `market_value` | `u64` | ❌ | Estimated transfer market value in €. |
| `stats` | `PlayerSeasonStats` | ❌ | Current season statistics (appearances, KDA, etc.). |
| `career` | `Vec<CareerEntry>` | ❌ | Historical season-by-season performance. |
| `training_focus` | `Option<TrainingFocus>` | ❌ | Current training focus (e.g. `Scrims`, `Mechanics`). |
| `transfer_listed` | `bool` | ❌ | Whether the player is on the transfer list. |
| `loan_listed` | `bool` | ❌ | Whether the player is available for loan. |
| `transfer_offers` | `Vec<TransferOffer>` | ❌ | Incoming transfer bids. |
| `morale_core` | `PlayerMoraleCore` | ❌ | Deep morale state (manager trust, unresolved issues, promises). |
| `potential_base` | `u8` | ❌ | 0-99. Maximum potential rating the player can reach. |
| `potential_revealed` | `Option<u8>` | ❌ | Scouted potential value (may differ from base). |
| `potential_research_started_on` | `Option<String>` | ❌ | Date when potential research was initiated. |
| `potential_research_eta_days` | `Option<u8>` | ❌ | Days remaining for potential research. |
| `champion_training_targets` | `Vec<String>` | ❌ | Champion IDs the player is training (up to 3). |

### PlayerAttributes (9 skills)

All fields are `u8` (0-100).

| Field | Description |
|-------|-------------|
| `mechanics` | Mechanical skill / micro |
| `laning` | Laning phase ability |
| `teamfighting` | Teamfight performance |
| `macro_play` | Map awareness / macro |
| `consistency` | Performance consistency |
| `shotcalling` | In-game leadership |
| `champion_pool` | Breadth of champion mastery |
| `discipline` | Decision-making / tilt resistance |
| `mental_resilience` | Ability to bounce back |

### LolRole Enum

| Variant | Accepted JSON values |
|---------|---------------------|
| `Top` | `"Top"`, `"TOP"`, `"top"`, `"Defender"`, `"RightBack"`, `"CenterBack"`, `"LeftBack"`, `"RightWingBack"`, `"LeftWingBack"` |
| `Jungle` | `"Jungle"`, `"JUNGLE"`, `"jungle"`, `"Midfielder"`, `"CentralMidfielder"` |
| `Mid` | `"Mid"`, `"MID"`, `"mid"`, `"AttackingMidfielder"`, `"RightMidfielder"`, `"LeftMidfielder"` |
| `Adc` | `"Adc"`, `"ADC"`, `"adc"`, `"Forward"`, `"RightWinger"`, `"LeftWinger"`, `"Striker"` |
| `Support` | `"Support"`, `"SUPPORT"`, `"support"`, `"Goalkeeper"`, `"DefensiveMidfielder"` |
| `Unknown` | Anything else (default) |

### PlayerSeasonStats

| Field | Type | Description |
|-------|------|-------------|
| `appearances` | `u32` | Matches played |
| `kills` | `u32` | Total kills |
| `assists` | `u32` | Total assists |
| `avg_rating` | `f32` | Average match rating |
| `minutes_played` | `u32` | Total minutes |
| `shots` | `u32` | Legacy (football) |
| `shots_on_target` | `u32` | Legacy |
| `passes_completed` | `u32` | Legacy |
| `passes_attempted` | `u32` | Legacy |
| `tackles_won` | `u32` | Legacy |
| `interceptions` | `u32` | Legacy |

### CareerEntry

| Field | Type | Description |
|-------|------|-------------|
| `season` | `u32` | Year (e.g. 2025) |
| `team_id` | `String` | Team identifier |
| `team_name` | `String` | Team display name |
| `appearances` | `u32` | Matches that season |
| `kills` | `u32` | Kills that season |
| `deaths` | `u32` | Deaths that season |
| `assists` | `u32` | Assists that season |
| `avg_rating` | `f32` | Average rating that season |

---

## Staff (`domain::staff::Staff`)

Represents a non-player team member (coach, scout, analyst, etc.).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `String` | ✅ | Unique identifier (e.g. `staff-b45e1420`). |
| `first_name` | `String` | ✅ | First name. |
| `last_name` | `String` | ✅ | Last name. |
| `date_of_birth` | `String` | ✅ | ISO 8601 date. |
| `nationality` | `String` | ✅ | Country name (not code, e.g. `"South Korea"`). |
| `birth_country` | `Option<String>` | ❌ | Birth country if different. |
| `profile_image_url` | `Option<String>` | ❌ | Photo URL. |
| `role` | `StaffRole` | ✅ | `Coach`, `Scout`, `Analyst`, `Physio`, `Manager`. |
| `attributes` | `StaffAttributes` | ✅ | 4 skill ratings (0-100 each). |
| `team_id` | `Option<String>` | ❌ | Team this staff works for. `null` = free agent. |
| `wage` | `u32` | ❌ | Weekly salary in €. |
| `contract_end` | `Option<String>` | ❌ | ISO date when contract expires. |

### StaffAttributes

| Field | Description |
|-------|-------------|
| `coaching` | Training effectiveness |
| `judging_ability` | Ability to assess current skill |
| `judging_potential` | Ability to assess future potential |
| `physiotherapy` | Injury recovery speed |

---

## Team (`domain::team::Team`)

Represents an esports organisation / team.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `String` | ✅ | Unique identifier (e.g. `lec-fnatic`). Should include competition prefix. |
| `name` | `String` | ✅ | Display name (e.g. `"Fnatic"`). |
| `short_name` | `String` | ✅ | 3-letter abbreviation (e.g. `"FNC"`). |
| `country` | `String` | ✅ | ISO 3166-1 alpha-2 country code. |
| `city` | `String` | ✅ | Home city. |
| `stadium_name` | `String` | ❌ | Arena name. Also accepts `arena_name` as alias. |
| `stadium_capacity` | `u32` | ❌ | Arena capacity. Also accepts `arena_capacity` as alias. |
| `finance` | `i64` | ❌ | Current budget / funds in €. |
| `manager_id` | `Option<String>` | ❌ | User manager assigned to this team. |
| `reputation` | `u32` | ❌ | 0-1000. Club prestige level. |
| `team_kind` | `TeamKind` | ❌ | `Main` or `Academy`. |
| `parent_team_id` | `Option<String>` | ❌ | For academy teams: the main team's ID. |
| `academy_team_id` | `Option<String>` | ❌ | For main teams: linked academy ID. |
| `academy` | `Option<AcademyMetadata>` | ❌ | Full academy affiliation metadata. |
| `logo_url` | `Option<String>` | ❌ | Team logo URL. Stored in `/teams-icons/{slug}.webp`. |
| `competition_id` | `Option<String>` | ❌ | Competition this team belongs to (e.g. `"lec"`). |
| `wage_budget` | `i64` | ❌ | Total wage budget in €. |
| `transfer_budget` | `i64` | ❌ | Transfer budget remaining in €. |
| `season_income` | `i64` | ❌ | Income this season. |
| `season_expenses` | `i64` | ❌ | Expenses this season. |
| `financial_ledger` | `Vec<FinancialTransaction>` | ❌ | Transaction history. |
| `sponsorship` | `Option<Sponsorship>` | ❌ | Current sponsorship deal. |
| `facilities` | `Facilities` | ❌ | Training facility levels. |
| `draft_strategy` | `DraftStrategy` | ❌ | `Balanced`, `Aggressive`, `Passive`, `Scaling`, `CounterPick`. Also accepts legacy `"play_style"`. |
| `lol_tactics` | `LolTactics` | ❌ | In-game tactical preferences. |
| `training_focus` | `TrainingFocus` | ❌ | `Scrims`, `Mechanics`, `Tactical`, `Physical`, `Mental`. |
| `training_intensity` | `TrainingIntensity` | ❌ | `Low`, `Medium`, `High`. |
| `training_schedule` | `TrainingSchedule` | ❌ | `Balanced`, `Heavy`, `Light`, `Intense`. |
| `founded_year` | `u32` | ❌ | Year the organisation was founded. |
| `colors` | `TeamColors` | ❌ | Brand colours: `{ primary: String, secondary: String }`. |
| `training_groups` | `Vec<TrainingGroup>` | ❌ | Player training groups with per-group focus. |
| `active_lineup_ids` | `Vec<String>` | ❌ | Current starting lineup player IDs. Also accepts `starting_xi_ids`. |
| `team_roles` | `TeamRoles` | ❌ | Captain and shotcaller assignments: `{ captain, shotcaller }`. |
| `form` | `Vec<String>` | ❌ | Recent match results (`"W"` / `"L"`). |
| `history` | `Vec<TeamSeasonRecord>` | ❌ | Historical season records. |
| `weekly_scrim_*` | (various) | ❌ | Scrim scheduling state (opponent IDs, plans, results, reports). |
| `scrim_reputation` | `u8` | ❌ | Scrim reputation / reliability score. |
| `scrim_weekly_cancellations` | `u8` | ❌ | Cancelled scrims this week. |
| `scrim_loss_streak` | `u8` | ❌ | Consecutive scrim losses. |
| `scrim_weekly_played/wins/losses` | `u8` | ❌ | Scrim results tracking. |

### LolTactics

| Field | Type | Description |
|-------|------|-------------|
| `draft_strategy` | `DraftStrategy` | `Balanced` / `Aggressive` / `Passive` / `Scaling` / `CounterPick` |
| `strong_side` | `StrongSide` | `Top` / `Mid` / `Bot` |
| `jungle_style` | `JungleStyle` | `Ganker` / `Invader` / `Farmer` / `Carry` / `Enabler` |
| `jungle_pathing` | `JunglePathing` | Pathing preference |
| `fight_plan` | `FightPlan` | `FrontToBack` / `Pick` / `Dive` / `Siege` / `Flank` |
| `support_roaming` | `SupportRoaming` | `Lane` / `RoamMid` (also accepts `"Roam"`) / `RoamTop` |
| `game_timing` | `GameTiming` | `Early` / `Mid` / `Late` |

### Facilities

| Field | Type | Description |
|-------|------|-------------|
| `main_hub_level` | `u8` | Main facility hub level |
| `training` | `u8` | Training room level |
| `medical` | `u8` | Medical centre level |
| `scouting` | `u8` | Scouting department level |
| `scrims_room_level` | `Option<u8>` | Scrim room level |
| `analysis_room_level` | `Option<u8>` | VOD review room level |
| `bootcamp_area_level` | `Option<u8>` | Bootcamp area level |
| `recovery_suite_level` | `Option<u8>` | Recovery suite level |
| `content_studio_level` | `Option<u8>` | Content creation studio level |
| `scouting_lab_level` | `Option<u8>` | Advanced scouting lab level |

---

## Competition (`CompetitionManifest`)

Defines a league/tournament in the modular data system. Each competition has its own `manifest.json` file at `data/competitions/{id}/manifest.json`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `String` | ✅ | Short identifier (e.g. `"lec"`, `"lck"`, `"lpl"`). Used as prefix for team IDs. |
| `name` | `String` | ✅ | Display name (e.g. `"LEC"`). |
| `full_name` | `Option<String>` | ❌ | Full name (e.g. `"League of Legends EMEA Championship"`). |
| `region` | `String` | ✅ | Region name (e.g. `"EMEA"`, `"KOREA"`, `"CHINA"`). |
| `country` | `Option<String>` | ❌ | Home country ISO code. |
| `tier` | `Option<u8>` | ❌ | Competition tier (1 = top, 2 = regional, etc.). |
| `logo` | `Option<String>` | ❌ | Logo URL. Stored in `/competitions-icons/{id}.webp`. |
| `schedule` | `ScheduleConfig` | ✅ | Competition format and split definitions. |
| `teams_file` | `String` | ✅ | Path to teams JSON, relative to `data/` (e.g. `"teams/lec_teams.json"`). |
| `players_file` | `String` | ✅ | Path to players JSON, relative to `data/` (e.g. `"players/lec_players.json"`). Loaded into the global `game.players` vector at runtime. |
| `staff_file` | `Option<String>` | ❌ | Path to competition-specific staff file (optional — global `staffs/free_agents.json` used otherwise). Loaded into the global `game.staff` vector at runtime. |

> **Note on runtime model:** `players_file` and `staff_file` are used only during data loading (`select_team`). At runtime, all players and staff live in the global `Game` struct (`game.players`, `game.staff`) and are linked to competitions indirectly via `team_id → Team.competition_id`. Competitions do **not** own player or staff vectors. See `architecture-graph.md` for the full runtime architecture.
| `championships_file` | `Option<String>` | ❌ | Path to champion draft data (optional). |
| `erls` | `Vec<String>` | ❌ | ERL academy seed file names (e.g. `["les.txt", "lfl.txt"]`). |

### ScheduleConfig

| Field | Type | Description |
|-------|------|-------------|
| `format` | `String` | `"single_round_robin"` or `"double_round_robin"`. |
| `team_count` | `u32` | Number of teams in the competition. **Must match the actual team file count.** |
| `preseason_friendlies` | `u32` | Number of preseason friendly matches per team. |
| `splits` | `Vec<SplitConfig>` | Competition splits (e.g. Spring, Summer). |

### SplitConfig

| Field | Type | Description |
|-------|------|-------------|
| `name` | `String` | Split name (e.g. `"Spring"`, `"Winter"`, `"Split 1"`). |
| `season_start` | `SeasonStart` | Start date: `{ month: u32, day: u32 }`. |
| `superweek_offsets` | `Vec<i64>` | Day offsets for superweek scheduling. Empty = normal weekly schedule. |
| `best_of` | `u32` | Best-of format (1 = Bo1, 3 = Bo3, 5 = Bo5). |
| `playoffs` | `Option<PlayoffConfig>` | Playoff format (if applicable). |

### PlayoffConfig

| Field | Type | Description |
|-------|------|-------------|
| `format` | `String` | `"SingleElimination"` or `"DoubleElimination"`. |
| `teams` | `u32` | Number of playoff teams. |

---

## File Structure

```
data/
├── competitions/{id}/
│   └── manifest.json          ← Competition definition (see above)
├── teams/{id}_teams.json       ← Array of Team objects
├── players/{id}_players.json   ← Array of Player objects
├── staffs/
│   └── free_agents.json        ← Array of Staff objects (free agents)
├── draft/
│   └── champions.json          ← Champion catalog (roles map)
└── erls/                       ← Academy seed text files (LEC only)
```

## Team / Player ID Convention

Team IDs should include the competition prefix followed by a slug:

- `lec-fnatic`
- `lck-t1`
- `lpl-jd-gaming`
- `cblol-pain`

Player IDs should be unique (UUID or convention-based):

- `lec-player-98767975961872793`
- `player-a1b2c3d4`
