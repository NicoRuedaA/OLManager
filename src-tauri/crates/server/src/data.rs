//! Server-side data loading + world assembly.
//!
//! Mirrors the essential parts of the Tauri `select_team` command but reads
//! from a configurable data directory (env `OLM_DATA_DIR`, default `data/`)
//! instead of resolving paths through a `tauri::AppHandle`. The parsing and
//! world-building logic itself comes straight from the pure crates.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use chrono::{Datelike, TimeZone, Utc};
use olm_core::domain::player::Player;
use olm_core::domain::staff::Staff;
use olm_core::domain::team::Team;
use olm_core::game::Game;
use olm_core::generator::definitions::ScheduleConfig;
use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Clone, Deserialize)]
pub struct Manifest {
    pub id: String,
    pub name: String,
    pub schedule: ScheduleConfig,
}

#[derive(Debug, Deserialize)]
struct TeamsFile {
    teams: Vec<Team>,
}

#[derive(Debug, Deserialize)]
struct PlayersFile {
    players: Vec<Player>,
}

/// Resolve the data directory: `OLM_DATA_DIR` env var, else `data/` under cwd.
pub fn data_dir() -> PathBuf {
    std::env::var("OLM_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("data"))
}

/// Extract the competition prefix from a team id (`lck-team-x` → `lck`).
pub fn competition_id_from_team_id(team_id: &str) -> Option<&str> {
    olm_core::competitions::competition_id_from_team_id(team_id)
}

fn scan_manifests(base: &Path) -> Vec<Manifest> {
    let comp_dir = base.join("competitions");
    let Ok(entries) = std::fs::read_dir(&comp_dir) else {
        return vec![];
    };
    let mut out = Vec::new();
    for entry in entries.flatten() {
        let manifest_path = entry.path().join("manifest.json");
        if !manifest_path.is_file() {
            continue;
        }
        if let Ok(contents) = std::fs::read_to_string(&manifest_path) {
            match serde_json::from_str::<Manifest>(&contents) {
                Ok(m) => out.push(m),
                Err(e) => tracing::warn!("bad manifest {:?}: {e}", manifest_path),
            }
        }
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    out
}

fn parse_teams_file(path: &Path) -> Vec<Team> {
    let Ok(contents) = std::fs::read_to_string(path) else {
        return vec![];
    };
    match serde_json::from_str::<TeamsFile>(&contents) {
        Ok(tf) => tf.teams,
        Err(e) => {
            tracing::warn!("teams parse failed for {:?}: {e}", path);
            vec![]
        }
    }
}

fn parse_players_file(path: &Path) -> Vec<Player> {
    let Ok(contents) = std::fs::read_to_string(path) else {
        return vec![];
    };
    match serde_json::from_str::<PlayersFile>(&contents) {
        Ok(pf) => pf.players,
        Err(e) => {
            tracing::warn!("players parse failed for {:?}: {e}", path);
            vec![]
        }
    }
}

/// Every `*.json` file directly under `dir`, sorted for determinism.
fn list_json_files(dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return vec![];
    };
    let mut files: Vec<PathBuf> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().map(|e| e == "json").unwrap_or(false))
        .collect();
    files.sort();
    files
}

/// Lowercase alphanumerics only — mirrors the frontend `normalizeKey` so a
/// player's IGN matches across shards regardless of spacing/punctuation.
fn normalize_name(value: &str) -> String {
    value
        .chars()
        .filter(char::is_ascii_alphanumeric)
        .map(|c| c.to_ascii_lowercase())
        .collect()
}

/// normalized match_name → photo url, harvested from `data/erls/players`.
///
/// The OLMDBManager export stores photos on its ERL-tier competition records
/// but leaves `profile_image_url` null on the `data/players` shards for the
/// same leagues. Those photos were still downloaded to disk, so we recover them
/// by matching IGNs. First non-empty url per name wins.
fn build_photo_fallback_map(base: &Path) -> HashMap<String, String> {
    let dir = base.join("erls").join("players");
    let mut map: HashMap<String, String> = HashMap::new();
    for path in list_json_files(&dir) {
        let Ok(contents) = std::fs::read_to_string(&path) else {
            continue;
        };
        let Ok(value) = serde_json::from_str::<Value>(&contents) else {
            continue;
        };
        let items = value
            .get("players")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        for item in items {
            let url = item
                .get("profile_image_url")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|s| !s.is_empty());
            let name = item.get("match_name").and_then(Value::as_str);
            if let (Some(url), Some(name)) = (url, name) {
                let key = normalize_name(name);
                if !key.is_empty() {
                    map.entry(key).or_insert_with(|| url.to_string());
                }
            }
        }
    }
    map
}

/// One shard file per competition slug, preferring `data/erls/<kind>` over
/// `data/<kind>`. The OLMDBManager export emits ERL leagues twice: a sparse,
/// photo-less tier-1 copy under `data/<kind>` and the complete copy (full
/// roster + photos) under `data/erls/<kind>`. We load the complete one.
fn resolve_preferred_shards(base: &Path, kind: &str) -> Vec<PathBuf> {
    let mut by_slug: HashMap<String, PathBuf> = HashMap::new();
    for path in list_json_files(&base.join(kind)) {
        by_slug.insert(file_competition_id(&path), path);
    }
    for path in list_json_files(&base.join("erls").join(kind)) {
        by_slug.insert(file_competition_id(&path), path); // erls wins
    }
    let mut paths: Vec<PathBuf> = by_slug.into_values().collect();
    paths.sort();
    paths
}

/// Resolve a single competition's shard (`teams`/`players`), preferring the
/// complete `data/erls/<kind>` copy. Used by the team picker so the ids it
/// shows match the world that `assemble_world` builds.
pub fn preferred_shard_path(base: &Path, kind: &str, slug: &str) -> Option<PathBuf> {
    let file = format!("{slug}_{kind}.json");
    let erls = base.join("erls").join(kind).join(&file);
    if erls.is_file() {
        return Some(erls);
    }
    let main = base.join(kind).join(&file);
    main.is_file().then_some(main)
}

/// Competition slug for an unscheduled shard file: `al_teams.json` → `al`.
fn file_competition_id(path: &Path) -> String {
    path.file_stem()
        .and_then(|s| s.to_str())
        .map(|s| {
            s.trim_end_matches("_teams")
                .trim_end_matches("_players")
                .to_string()
        })
        .unwrap_or_default()
}

/// Namespace a competition's teams by id, recording the original→world id so
/// players and staff can be re-pointed. Teams whose original id was already
/// loaded (by an earlier, manifest-owned competition) are skipped.
fn add_teams(
    comp: &str,
    teams: Vec<Team>,
    all_teams: &mut Vec<Team>,
    team_id_map: &mut HashMap<String, String>,
    seen_teams: &mut HashSet<String>,
) {
    let prefix = format!("{}-", comp);
    for mut team in teams {
        if !seen_teams.insert(team.id.clone()) {
            continue;
        }
        let original = team.id.clone();
        if !team.id.starts_with(&prefix) {
            team.id = format!("{}{}", prefix, team.id);
        }
        team.competition_id = Some(comp.to_string());
        team_id_map.insert(original, team.id.clone());
        all_teams.push(team);
    }
}

fn round_money(value: u64, step: u64) -> u64 {
    value.max(step).div_ceil(step) * step
}

fn estimated_market_value(player: &Player) -> u64 {
    let ovr = player.attributes.overall();
    let potential = player.potential_base.max(ovr).min(100);
    let skill_gap = u64::from(ovr.saturating_sub(60));
    let potential_gap = u64::from(potential.saturating_sub(ovr));
    let raw_value = 75_000 + skill_gap * skill_gap * 2_250 + potential_gap * 70_000;

    round_money(raw_value, 10_000)
}

fn estimated_annual_wage(player: &Player, market_value: u64, team_wage_budget: Option<i64>) -> u32 {
    let ovr = u64::from(player.attributes.overall());
    let market_based = market_value / 8;
    let rating_based = 18_000 + ovr.saturating_sub(50) * 7_500;
    let budget_ceiling = team_wage_budget
        .and_then(|budget| (budget > 0).then_some((budget as u64 / 4).max(40_000)))
        .unwrap_or(1_250_000);
    let raw_wage = market_based
        .max(rating_based)
        .min(budget_ceiling)
        .max(12_000);

    round_money(raw_wage, 1_000).min(u64::from(u32::MAX)) as u32
}

fn missing_contract_end(contract_end: Option<&str>) -> bool {
    contract_end.map(str::trim).unwrap_or("").is_empty()
}

fn repair_player_financials_with_budget(
    player: &mut Player,
    team_wage_budget: Option<i64>,
) -> bool {
    let mut changed = false;
    if player.market_value == 0 {
        player.market_value = estimated_market_value(player);
        changed = true;
    }
    if player.wage == 0 {
        player.wage = estimated_annual_wage(player, player.market_value, team_wage_budget);
        changed = true;
    }
    if missing_contract_end(player.contract_end.as_deref()) {
        player.contract_end = Some("2028-11-30".to_string());
        changed = true;
    }
    changed
}

/// Imported public data can legitimately omit contract and finance fields.
/// Repair those holes both for newly assembled worlds and for already-created
/// web saves that were loaded before the importer had these defaults.
pub fn repair_player_financials(game: &mut Game) -> bool {
    let wage_budget_by_team: HashMap<String, i64> = game
        .teams
        .iter()
        .map(|team| (team.id.clone(), team.wage_budget))
        .collect();

    let mut changed = false;
    for player in &mut game.players {
        let team_wage_budget = player
            .team_id
            .as_ref()
            .and_then(|team_id| wage_budget_by_team.get(team_id).copied());
        changed |= repair_player_financials_with_budget(player, team_wage_budget);
    }
    changed
}

/// Coerce the `null`/missing fields that OLMDBManager staff exports routinely
/// carry into the shapes `olm_core::domain::Staff` requires, so a single bad record (or
/// `"wage": null`, `"attributes": null`) doesn't drop the whole file.
fn sanitize_staff_value(value: &mut Value) {
    let Some(obj) = value.as_object_mut() else {
        return;
    };
    for key in ["first_name", "last_name", "nationality"] {
        if obj.get(key).map(Value::is_null).unwrap_or(true) {
            obj.insert(key.to_string(), Value::String(String::new()));
        }
    }
    if obj.get("wage").map(Value::is_null).unwrap_or(false) {
        obj.insert("wage".to_string(), Value::from(0));
    }
    let attr_keys = [
        "coaching",
        "judging_ability",
        "judging_potential",
        "physiotherapy",
    ];
    match obj.get_mut("attributes").and_then(Value::as_object_mut) {
        Some(attrs) => {
            for key in attr_keys {
                if attrs.get(key).map(Value::is_null).unwrap_or(true) {
                    attrs.insert(key.to_string(), Value::from(0));
                }
            }
        }
        None => {
            let mut attrs = serde_json::Map::new();
            for key in attr_keys {
                attrs.insert(key.to_string(), Value::from(0));
            }
            obj.insert("attributes".to_string(), Value::Object(attrs));
        }
    }
}

/// Load every `data/staffs/*.json` shard, de-duplicated by id. Staff belong to
/// teams (not competitions), so this scans the whole folder and re-points each
/// `team_id` to the prefixed world id via `team_id_map`; staff whose team isn't
/// part of the assembled world become unattached (free agents).
fn load_all_staff(base: &Path, team_id_map: &HashMap<String, String>) -> Vec<Staff> {
    let dir = base.join("staffs");
    let Ok(entries) = std::fs::read_dir(&dir) else {
        return vec![];
    };

    let mut files: Vec<PathBuf> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().map(|e| e == "json").unwrap_or(false))
        .collect();
    files.sort();

    let mut seen: HashSet<String> = HashSet::new();
    let mut out: Vec<Staff> = Vec::new();
    for path in files {
        let Ok(contents) = std::fs::read_to_string(&path) else {
            continue;
        };
        let Ok(value) = serde_json::from_str::<Value>(&contents) else {
            tracing::warn!("staff parse failed for {:?}", path);
            continue;
        };
        let items = value
            .get("staff")
            .or_else(|| value.get("staffs"))
            .and_then(Value::as_array)
            .cloned()
            .or_else(|| value.as_array().cloned())
            .unwrap_or_default();

        for mut item in items {
            sanitize_staff_value(&mut item);
            let mut staff: Staff = match serde_json::from_value(item) {
                Ok(s) => s,
                Err(e) => {
                    tracing::debug!("skipping staff record in {:?}: {e}", path);
                    continue;
                }
            };
            if !seen.insert(staff.id.clone()) {
                continue;
            }
            staff.team_id = match staff.team_id {
                Some(tid) if tid != "fa" && tid != "freeagent" => team_id_map.get(&tid).cloned(),
                _ => None,
            };
            out.push(staff);
        }
    }
    out
}

/// Assemble the full world (teams, players, staff) across every loadable
/// competition. Team ids are namespaced by competition; player and staff
/// `team_id`s are re-pointed to match. This is the single source of truth for
/// both `select_team` and the import summary, so reported counts match what a
/// save actually loads.
pub fn assemble_world(base: &Path) -> (Vec<Team>, Vec<Player>, Vec<Staff>) {
    let mut all_teams: Vec<Team> = Vec::new();
    let mut all_players: Vec<Player> = Vec::new();
    // Original (export) team id → final world id, for re-pointing staff/players.
    let mut team_id_map: HashMap<String, String> = HashMap::new();
    let mut seen_teams: HashSet<String> = HashSet::new();

    // Teams, one shard per competition (ERL-complete copy preferred). The slug
    // matches each manifest id, so scheduling in `select_team` still resolves.
    for path in resolve_preferred_shards(base, "teams") {
        let comp = file_competition_id(&path);
        add_teams(
            &comp,
            parse_teams_file(&path),
            &mut all_teams,
            &mut team_id_map,
            &mut seen_teams,
        );
    }

    // Players, one shard per competition, de-duplicated by id. `team_id` is
    // re-pointed via the world id map; anything that doesn't resolve (free
    // agents, name-keyed refs, unloaded teams) becomes None.
    let photo_fallback = build_photo_fallback_map(base);
    let mut seen_players: HashSet<String> = HashSet::new();
    for path in resolve_preferred_shards(base, "players") {
        for mut player in parse_players_file(&path) {
            if !seen_players.insert(player.id.clone()) {
                continue;
            }
            player.team_id = player
                .team_id
                .and_then(|tid| team_id_map.get(&tid).cloned());
            // Recover missing photos by IGN from the ERL shards.
            if player
                .profile_image_url
                .as_deref()
                .map(str::trim)
                .unwrap_or("")
                .is_empty()
            {
                if let Some(url) = photo_fallback.get(&normalize_name(&player.match_name)) {
                    player.profile_image_url = Some(url.clone());
                }
            }
            if player.morale == 0 {
                player.morale = 68;
            }
            if player.condition == 0 {
                player.condition = 100;
            }
            let team_wage_budget = player.team_id.as_ref().and_then(|team_id| {
                all_teams
                    .iter()
                    .find(|team| &team.id == team_id)
                    .map(|team| team.wage_budget)
            });
            repair_player_financials_with_budget(&mut player, team_wage_budget);
            all_players.push(player);
        }
    }

    let all_staff = load_all_staff(base, &team_id_map);
    (all_teams, all_players, all_staff)
}

/// Count the entities the world assembles to (teams, players, staff). Used by
/// the import/catalog endpoints so the reported numbers match the game.
pub fn world_summary() -> (usize, usize, usize) {
    let (teams, players, staff) = assemble_world(&data_dir());
    (teams.len(), players.len(), staff.len())
}

/// Keep legacy/UI assumptions in sync: the chosen competition is both recorded
/// in `user_competition_id` and placed first in `game.leagues`.
pub fn repair_active_competition(game: &mut Game) -> bool {
    let Some(team_id) = game.manager.team_id.as_deref() else {
        return false;
    };
    let Some(cid) = competition_id_from_team_id(team_id) else {
        return false;
    };

    let mut changed = false;
    if game.user_competition_id.as_deref() != Some(cid) {
        game.user_competition_id = Some(cid.to_string());
        changed = true;
    }

    if let Some(index) = game
        .leagues
        .iter()
        .position(|league| league.competition_id.as_deref() == Some(cid))
    {
        if index != 0 {
            let league = game.leagues.remove(index);
            game.leagues.insert(0, league);
            changed = true;
        }
    }

    changed
}

/// Assemble the full world (all loadable competitions), assign the manager to
/// the chosen team, generate schedules, and bootstrap derived state.
///
/// Returns an error string if the team id is invalid or its competition can't
/// be loaded — mirroring the Tauri command's contract.
pub fn select_team(game: &mut Game, team_id: &str) -> Result<(), String> {
    let base = data_dir();
    let manifests = scan_manifests(&base);
    if manifests.is_empty() {
        return Err(format!(
            "no competitions found under {:?} (set OLM_DATA_DIR)",
            base
        ));
    }

    let (all_teams, all_players, all_staff) = assemble_world(&base);

    if !all_teams.iter().any(|t| t.id == team_id) {
        return Err(format!("team '{}' not found in assembled world", team_id));
    }

    game.teams = all_teams;
    game.players = all_players;
    game.staff = all_staff;

    // Assign manager to the chosen team.
    game.manager.hire(team_id.to_string());
    if let Some(team) = game.teams.iter_mut().find(|t| t.id == team_id) {
        team.manager_id = Some(game.manager.id.clone());
    }

    // Generate league schedules for every competition with enough teams and a
    // non-empty split config (the engine guard skips the rest gracefully).
    let season_year = game.clock.current_date.year() as u32;
    let user_cid = competition_id_from_team_id(team_id);
    let mut leagues = Vec::new();
    for manifest in &manifests {
        let team_ids: Vec<String> = game
            .teams
            .iter()
            .filter(|t| t.competition_id.as_deref() == Some(&manifest.id))
            .map(|t| t.id.clone())
            .collect();
        if team_ids.len() < 2 || manifest.schedule.splits.is_empty() {
            continue;
        }
        let mut league = olm_core::schedule::generate_schedule_from_config(
            &manifest.id,
            &manifest.name,
            season_year,
            &team_ids,
            &manifest.schedule,
            0,
        );

        // Preseason friendlies for the user's competition only.
        if user_cid == Some(manifest.id.as_str()) {
            let split = &manifest.schedule.splits[0];
            let opponents: Vec<String> = team_ids
                .iter()
                .filter(|t| t.as_str() != team_id)
                .cloned()
                .collect();
            if !opponents.is_empty() {
                let season_start = Utc
                    .with_ymd_and_hms(
                        season_year as i32,
                        split.season_start.month,
                        split.season_start.day,
                        0,
                        0,
                        0,
                    )
                    .unwrap();
                let today = game.clock.current_date.format("%Y-%m-%d").to_string();
                let mut friendlies = olm_core::schedule::generate_preseason_friendlies(
                    team_id,
                    &opponents,
                    season_start,
                    manifest.schedule.preseason_friendlies as usize,
                );
                friendlies.retain(|f| f.date >= today);
                olm_core::schedule::append_fixtures(&mut league, friendlies);
            }
        }

        league.competition_id = Some(manifest.id.clone());
        leagues.push(league);
    }
    if let Some(cid) = user_cid {
        leagues.sort_by_key(|league| {
            if league.competition_id.as_deref() == Some(cid) {
                0
            } else {
                1
            }
        });
        game.user_competition_id = Some(cid.to_string());
    } else {
        game.user_competition_id = None;
    }
    game.leagues = leagues;

    olm_core::champions::bootstrap_champion_state(game);
    repair_active_competition(game);
    olm_core::season_context::refresh_game_context(game);

    // ── Generate welcome messages ───────────────────────────
    let date_str = game.clock.current_date.to_rfc3339();
    let team_name = game.teams.iter().find(|t| t.id == team_id)
        .map(|t| t.name.clone()).unwrap_or_default();
    let user_cid = competition_id_from_team_id(team_id);
    let competitions_base = base.join("competitions");
    let season_year = game.clock.current_date.year();
    let league_display_name = user_cid
        .and_then(|cid| olm_core::competitions::load_competition_manifest(&competitions_base, cid).ok())
        .map(|m| format!("{} {}", m.name, m.schedule.splits.first().map(|s| s.name.as_str()).unwrap_or("")))
        .unwrap_or_else(|| "LEC Winter".to_string());

    game.messages.push(olm_core::messages::welcome_message(&team_name, team_id, &date_str, "en"));

    if let Some(parent_team) = game.teams.iter().find(|team| team.id == team_id) {
        if let Some(academy_team_id) = parent_team.academy_team_id.as_deref() {
            if let Some(academy_team) = game.teams.iter().find(|team| team.id == academy_team_id) {
                let academy_count = game.players.iter()
                    .filter(|p| p.team_id.as_deref() == Some(academy_team_id)).count();
                game.messages.push(olm_core::game_setup::academy_overview_message(
                    parent_team, academy_team, academy_count, &date_str,
                ));
            }
        }
    }

    let season_start_str = if let Some(cid) = user_cid {
        if let Ok(m) = olm_core::competitions::load_competition_manifest(&competitions_base, cid) {
            let split = &m.schedule.splits[0];
            format!("{} {}, {}", chrono::Month::try_from(split.season_start.month as u8)
                .map(|mon| mon.name()).unwrap_or("January"), split.season_start.day, season_year)
        } else {
            format!("January 18, {}", season_year)
        }
    } else {
        format!("January 18, {}", season_year)
    };

    game.messages.push(olm_core::messages::season_schedule_message(
        &league_display_name, &season_start_str, &date_str,
    ));

    let team_names: Vec<String> = game.teams.iter()
        .filter(|team| team.team_kind != olm_core::domain::team::TeamKind::Academy)
        .map(|team| team.name.clone()).collect();
    game.news.push(olm_core::news::season_preview_article(&team_names, &date_str));

    game.messages.push(olm_core::messages::staff_advice_message(&team_name, team_id, &date_str));
    olm_core::player_events::generate_contract_concern_messages(game, false);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use olm_core::domain::league::League;
    use olm_core::domain::manager::Manager;
    use olm_core::domain::player::PlayerAttributes;
    use olm_core::domain::stats::LolRole;
    use olm_core::clock::GameClock;

    fn imported_player_without_financials() -> Player {
        let attributes = PlayerAttributes {
            mechanics: 90,
            laning: 91,
            teamfighting: 90,
            macro_play: 92,
            consistency: 92,
            shotcalling: 89,
            champion_pool: 89,
            discipline: 91,
            mental_resilience: 91,
        };
        let mut player = Player::new(
            "player-1".to_string(),
            "Gumayusi".to_string(),
            "Lee Min-hyeong".to_string(),
            "2002-02-06".to_string(),
            "KR".to_string(),
            LolRole::Adc,
            attributes,
        );
        player.team_id = Some("team-hle".to_string());
        player.potential_base = 95;
        player
    }

    #[test]
    fn repair_active_competition_sets_user_competition_and_moves_league_first() {
        let clock = GameClock::new(Utc.with_ymd_and_hms(2025, 1, 1, 0, 0, 0).unwrap());
        let mut manager = Manager::new(
            "manager-1".to_string(),
            "Test".to_string(),
            "Manager".to_string(),
            "1980-01-01".to_string(),
            "ES".to_string(),
        );
        manager.hire("lec-g2".to_string());
        let mut game = Game::new(clock, manager, vec![], vec![], vec![], vec![]);
        game.leagues = vec![
            League::new(
                "cblol".to_string(),
                "CBLOL".to_string(),
                2025,
                &["cblol-loud".to_string(), "cblol-pain".to_string()],
                Some("cblol".to_string()),
            ),
            League::new(
                "lec".to_string(),
                "LEC".to_string(),
                2025,
                &["lec-g2".to_string(), "lec-fnc".to_string()],
                Some("lec".to_string()),
            ),
        ];

        assert!(repair_active_competition(&mut game));
        assert_eq!(game.user_competition_id.as_deref(), Some("lec"));
        assert_eq!(game.leagues[0].competition_id.as_deref(), Some("lec"));
    }

    #[test]
    fn sanitize_staff_value_recovers_null_required_fields() {
        // A record matching OLMDBManager's loose export shape: null wage,
        // null attributes, null last_name/nationality, plus extra fields.
        let mut value = serde_json::json!({
            "id": "staff-1",
            "first_name": "Lee",
            "last_name": null,
            "nationality": null,
            "role": "Assistant",
            "team_id": "team-abc",
            "wage": null,
            "attributes": null,
            "nickname": "Coach",
            "specialization": null
        });
        sanitize_staff_value(&mut value);
        let staff: Staff =
            serde_json::from_value(value).expect("sanitized record must deserialize");
        assert_eq!(staff.id, "staff-1");
        assert_eq!(staff.last_name, "");
        assert_eq!(staff.nationality, "");
        assert_eq!(staff.wage, 0);
        assert_eq!(staff.attributes.coaching, 0);
    }

    #[test]
    fn load_all_staff_repoints_team_ids_and_dedupes() {
        let dir = std::env::temp_dir().join(format!("olm_staff_test_{}", std::process::id()));
        let staffs = dir.join("staffs");
        std::fs::create_dir_all(&staffs).unwrap();
        // Two files; "staff-1" duplicated across both to exercise de-dup.
        let body = |team: &str| {
            serde_json::json!({
                "staff": [{
                    "id": "staff-1",
                    "first_name": "A",
                    "last_name": "B",
                    "nationality": "KR",
                    "role": "Coach",
                    "team_id": team,
                    "attributes": {"coaching":50,"judging_ability":50,"judging_potential":50,"physiotherapy":50}
                }]
            })
            .to_string()
        };
        std::fs::write(staffs.join("a_staffs.json"), body("team-known")).unwrap();
        std::fs::write(staffs.join("b_staffs.json"), body("team-known")).unwrap();

        let mut map = HashMap::new();
        map.insert("team-known".to_string(), "lck-team-known".to_string());
        let staff = load_all_staff(&dir, &map);

        std::fs::remove_dir_all(&dir).ok();
        assert_eq!(staff.len(), 1, "duplicate ids across files collapse to one");
        assert_eq!(staff[0].team_id.as_deref(), Some("lck-team-known"));
    }

    #[test]
    fn load_all_staff_unattaches_unknown_teams() {
        let dir = std::env::temp_dir().join(format!("olm_staff_orphan_{}", std::process::id()));
        let staffs = dir.join("staffs");
        std::fs::create_dir_all(&staffs).unwrap();
        let body = serde_json::json!({
            "staff": [{
                "id": "staff-9",
                "first_name": "A",
                "last_name": "B",
                "nationality": "KR",
                "role": "Scout",
                "team_id": "team-unloaded",
                "attributes": {"coaching":1,"judging_ability":1,"judging_potential":1,"physiotherapy":1}
            }]
        })
        .to_string();
        std::fs::write(staffs.join("x_staffs.json"), body).unwrap();

        let staff = load_all_staff(&dir, &HashMap::new());
        std::fs::remove_dir_all(&dir).ok();
        assert_eq!(staff.len(), 1);
        assert_eq!(
            staff[0].team_id, None,
            "staff for unloaded team become free agents"
        );
    }

    #[test]
    fn repair_player_financials_fills_imported_zeroes_once() {
        let mut player = imported_player_without_financials();

        assert!(repair_player_financials_with_budget(
            &mut player,
            Some(2_875_000),
        ));
        assert!(player.market_value > 0);
        assert!(player.wage > 0);
        assert_eq!(player.contract_end.as_deref(), Some("2028-11-30"));

        let market_value = player.market_value;
        let wage = player.wage;
        assert!(!repair_player_financials_with_budget(
            &mut player,
            Some(2_875_000),
        ));
        assert_eq!(player.market_value, market_value);
        assert_eq!(player.wage, wage);
    }
}


