use chrono::{Datelike, TimeZone};
use domain::message::{InboxMessage, MessageCategory, MessageContext, MessagePriority};
use domain::player::{Player, PlayerAttributes};
use domain::staff::Staff;
use domain::team::{
    AcademyLifecycle, AcademyMetadata, ErlAssignment, ErlAssignmentRule, Team, TeamKind,
};
use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;
use tauri::Manager as TauriManager;
use tauri::State;

use db::save_index::SaveEntry;
use domain::manager::Manager;
use domain::stats::StatsState;
use ofm_core::clock::GameClock;
use ofm_core::game::Game;
use ofm_core::generator::definitions::PlayerDataFile;
use ofm_core::state::StateManager;

use crate::SaveManagerState;
use crate::application::game_setup::avatar;
use crate::error::AppError;
use validator::Validate;

#[derive(Debug, Clone, Serialize)]
pub struct TeamSelectionData {
    pub manager: Manager,
    pub teams: Vec<domain::team::Team>,
    pub players: Vec<domain::player::Player>,
}

const ACADEMY_FALLBACK_PHOTO: &str = "/player-photos/107455908655055017.webp";

fn calculate_age_on_date(birth_date: chrono::NaiveDate, as_of_date: chrono::NaiveDate) -> i32 {
    let mut age = as_of_date.year() - birth_date.year();
    if (as_of_date.month(), as_of_date.day()) < (birth_date.month(), birth_date.day()) {
        age -= 1;
    }
    age
}

#[derive(Debug, Clone)]
pub(crate) struct ExampleAcademyPlayerSeed {
    pub(crate) role: String,
    pub(crate) nickname: String,
    pub(crate) full_name: String,
    pub(crate) nationality: String,
    pub(crate) dob: Option<String>,
    pub(crate) image_url: String,
}

#[derive(Debug, Clone)]
pub(crate) struct ExampleAcademyTeamSeed {
    pub(crate) league_id: String,
    pub(crate) league_name: String,
    pub(crate) country_code: String,
    pub(crate) team_name: String,
    pub(crate) short_name: String,
    pub(crate) logo_url: Option<String>,
    pub(crate) players: Vec<ExampleAcademyPlayerSeed>,
}

fn normalize_academy_key(value: &str) -> String {
    value
        .to_lowercase()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect()
}

pub(crate) fn slugify_academy_key(value: &str) -> String {
    let slug: String = value
        .to_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect();
    slug.trim_matches('-')
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

pub(crate) fn academy_seed_team_id(league_id: &str, team_name: &str) -> String {
    let mut academy_id = format!("academy-{}-{}", league_id, slugify_academy_key(team_name));
    if academy_id == format!("academy-{}-", league_id) {
        academy_id = format!("academy-{}", league_id);
    }
    academy_id
}

fn generate_fallback_dob(seed: &str) -> String {
    let hash = seed.bytes().fold(0_u32, |acc, byte| {
        acc.wrapping_mul(31).wrapping_add(u32::from(byte))
    });
    let year = 2004 + (hash % 4);
    let month = 1 + ((hash / 7) % 12);
    let day = 1 + ((hash / 13) % 28);
    format!("{year:04}-{month:02}-{day:02}")
}

fn seed_role_to_canonical(role: &str) -> String {
    match normalize_academy_key(role).as_str() {
        "top" | "toplaner" => "top",
        "jungle" | "jungler" => "jungle",
        "mid" | "midlaner" | "middle" => "mid",
        "adc" | "bot" | "bottom" => "adc",
        "support" | "sup" => "support",
        _ => "mid",
    }
    .to_string()
}

pub(crate) fn example_academy_seed_catalog() -> &'static Vec<ExampleAcademyTeamSeed> {
    static CATALOG: OnceLock<Vec<ExampleAcademyTeamSeed>> = OnceLock::new();
    CATALOG.get_or_init(|| {
        // Read ERL teams from JSON data files at runtime to power the academy candidate catalog.
        // The runtime academy bootstrapping uses bootstrap_academy_pool_from_erl_json() instead.
        let data_base = resolve_data_dir_for_seed_catalog();
        let Some(data_base) = data_base else { return vec![] };

        let erls_dir = data_base.join("erls").join("competitions");
        let entries = match std::fs::read_dir(&erls_dir) {
            Ok(e) => e,
            Err(_) => return vec![],
        };

        let mut teams = Vec::new();
        for entry in entries.flatten() {
            let dir_path = entry.path();
            if !dir_path.is_dir() { continue; }
            let file_name = match dir_path.file_name().and_then(|n| n.to_str()) {
                Some(n) => n.to_string(),
                None => continue,
            };

            // Read manifest to get country code
            let manifest_path = dir_path.join("manifest.json");
            let league_meta = match std::fs::read_to_string(&manifest_path)
                .ok()
                .and_then(|json| serde_json::from_str::<serde_json::Value>(&json).ok())
            {
                Some(m) => (
                    m["name"].as_str().unwrap_or(&file_name).to_string(),
                    m["country"].as_str().unwrap_or("EU").to_string(),
                ),
                None => (file_name.clone(), "EU".to_string()),
            };
            let (league_name, country_code) = league_meta;

            // Read teams from data/erls/teams/{file_name}_teams.json
            let teams_path = data_base.join("erls").join("teams").join(format!("{}_teams.json", file_name));
            let json_str = match std::fs::read_to_string(&teams_path) {
                Ok(s) => s,
                Err(_) => continue,
            };
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(&json_str) {
                if let Some(entries) = data["teams"].as_array() {
                    let academy_league_id = if file_name == "les" { "liga-espanola" } else { &file_name };
                    for entry in entries {
                        let team_name = entry["name"].as_str().unwrap_or("Unknown").to_string();
                        let short_name = entry["short_name"].as_str().unwrap_or("ACD").to_string();
                        let logo_url = entry["logo_url"].as_str().map(|s| s.to_string());
                        teams.push(ExampleAcademyTeamSeed {
                            league_id: academy_league_id.to_string(),
                            league_name: league_name.clone(),
                            country_code: country_code.clone(),
                            team_name,
                            short_name,
                            logo_url,
                            players: Vec::new(),
                        });
                    }
                }
            }
        }
        teams
    })
}

fn resolve_data_dir_for_seed_catalog() -> Option<std::path::PathBuf> {
    let cwd = std::env::current_dir().ok()?;
    for candidate in [
        cwd.join("..").join("data"),
        cwd.join("data"),
        cwd.join("src-tauri").join("data"),
    ] {
        if candidate.is_dir() {
            return Some(candidate);
        }
    }
    None
}

fn academy_team_alias_for_parent(parent_name: &str) -> Option<&'static str> {
    match normalize_academy_key(parent_name).as_str() {
        "movistarkoi" => Some("movistarkoifnix"),
        "g2esports" => Some("g2nord"),
        "giantx" => Some("giantxitero"),
        "karminecorp" => Some("karminecorpblue"),
        "teamvitality" => Some("teamvitalitybee"),
        "teamheretics" | "heretics" => Some("teamheretics"),
        _ => None,
    }
}

fn generated_academy_ovr(player_name: &str) -> u8 {
    let hash = player_name.bytes().fold(0_u32, |acc, byte| {
        acc.wrapping_mul(37).wrapping_add(u32::from(byte))
    });
    (60 + (hash % 11)) as u8
}

fn generated_academy_potential(player_name: &str, ovr: u8) -> u8 {
    let hash = player_name.bytes().fold(0_u32, |acc, byte| {
        acc.wrapping_mul(41).wrapping_add(u32::from(byte))
    });
    let elite = (hash % 100) < 15;
    let mut potential = if elite {
        84 + ((hash / 7) % 7) as u8
    } else {
        75 + ((hash / 5) % 9) as u8
    };
    let minimum = ovr.saturating_add(4).min(90);
    if potential < minimum {
        potential = minimum;
    }
    potential.min(90)
}

fn round_seed_market_value(value: u64) -> u64 {
    value.max(50_000).div_ceil(10_000) * 10_000
}

fn suggested_seed_market_value(ovr: u8, potential: u8, is_academy: bool) -> u64 {
    let skill_gap = u64::from(ovr.saturating_sub(60));
    let potential_gap = u64::from(potential.saturating_sub(ovr));
    let skill_value = 50_000 + skill_gap * skill_gap * 300;
    let potential_value = potential_gap * if is_academy { 3_000 } else { 6_000 };
    let raw_value = skill_value + potential_value;
    let adjusted_value = if is_academy {
        raw_value * 70 / 100
    } else {
        raw_value
    };

    round_seed_market_value(adjusted_value)
}

fn academy_overview_message(
    parent_team: &Team,
    academy_team: &Team,
    academy_players: usize,
    date: &str,
) -> InboxMessage {
    InboxMessage::new(
        format!("academy-overview-{}", parent_team.id),
        format!("Academia activa: {}", academy_team.name),
        format!(
            "Tu club ya cuenta con academia vinculada. {} tiene {} prospectos cargados y listos para seguimiento/promocion.",
            academy_team.name, academy_players
        ),
        "Director Deportivo".to_string(),
        date.to_string(),
    )
    .with_category(MessageCategory::Welcome)
    .with_priority(MessagePriority::Normal)
    .with_sender_role("Director Deportivo")
    .with_context(MessageContext {
        team_id: Some(parent_team.id.clone()),
        ..Default::default()
    })
}

pub(crate) fn bootstrap_example_academy_pool_from_example(
    teams: &mut Vec<Team>,
    players: &mut Vec<Player>,
    current_date_iso: &str,
) {
    let seed_catalog = example_academy_seed_catalog();
    if seed_catalog.is_empty() {
        return;
    }

    let mut existing_team_ids: HashSet<String> = teams.iter().map(|team| team.id.clone()).collect();

    for seed_team in seed_catalog.iter() {
        let academy_id = academy_seed_team_id(&seed_team.league_id, &seed_team.team_name);
        if existing_team_ids.contains(&academy_id) {
            continue;
        }

        let mut academy_team = Team::new(
            academy_id.clone(),
            seed_team.team_name.clone(),
            seed_team.short_name.clone(),
            seed_team.country_code.clone(),
            seed_team.league_name.clone(),
            format!("{} Academy Arena", seed_team.short_name),
            2_500,
        );
        academy_team.team_kind = TeamKind::Academy;
        academy_team.parent_team_id = None;
        academy_team.manager_id = None;
        academy_team.reputation = 6_000;
        academy_team.finance = 0;
        academy_team.wage_budget = 0;
        academy_team.transfer_budget = 0;
        academy_team.academy = Some(AcademyMetadata {
            lifecycle: AcademyLifecycle::Planned,
            erl_assignment: ErlAssignment {
                erl_league_id: seed_team.league_id.clone(),
                country_rule: ErlAssignmentRule::Domestic,
                fallback_reason: Some(format!(
                    "Seeded from {} academy roster",
                    seed_team.league_name
                )),
                reputation: 60,
                acquisition_cost: 0,
                acquired_at: String::new(),
                creation_cost: 0,
                created_at: current_date_iso.to_string(),
            },
            source_team_id: academy_id.clone(),
            original_name: seed_team.team_name.clone(),
            original_short_name: seed_team.short_name.clone(),
            original_logo_url: seed_team.logo_url.clone(),
            current_logo_url: seed_team.logo_url.clone(),
            acquisition_cost: 0,
            acquired_at: String::new(),
        });

        for (player_index, seed_player) in seed_team.players.iter().enumerate() {
            let ovr = generated_academy_ovr(&seed_player.nickname);
            let potential = generated_academy_potential(&seed_player.nickname, ovr);
            let seed = DraftPlayerSeed {
                ign: seed_player.nickname.clone(),
                first_name: None,
                last_name: None,
                dob: Some(
                    seed_player
                        .dob
                        .clone()
                        .unwrap_or_else(|| generate_fallback_dob(&seed_player.nickname)),
                ),
                nationality: Some(seed_player.nationality.clone()),
                role: Some(seed_role_to_canonical(&seed_player.role)),
                team_id: Some(academy_id.clone()),
                rating: Some(ovr),
                potential: Some(potential),
                salary: Some(8_000),
                contract_end: Some("2028-11-30".to_string()),
                market_value: Some(suggested_seed_market_value(ovr, potential, true)),
                reputation: Some(62),
                photo: seed_profile_image_url(
                    (!seed_player.image_url.is_empty()).then_some(seed_player.image_url.as_str()),
                ),
            };

            let attributes = build_attributes_from_seed(&seed);
            let position = role_to_lol_role(seed.role.as_deref());
            let player_id = format!("{}-player-{}", academy_id, player_index + 1);

            let mut player = Player::new(
                player_id,
                seed_player.nickname.clone(),
                seed_player.full_name.clone(),
                seed.dob
                    .clone()
                    .unwrap_or_else(|| generate_fallback_dob(&seed_player.nickname)),
                seed_player.nationality.clone(),
                position,
                attributes,
            );
            player.team_id = Some(academy_id.clone());
            player.contract_end = seed.contract_end.clone();
            player.wage = seed.salary.unwrap_or(8_000);
            player.market_value = seed.market_value.unwrap_or(240_000);
            player.potential_base = potential;
            player.profile_image_url = seed.photo.clone();
            player.morale = 68;
            player.condition = 100;

            if seed_player.image_url.is_empty() {
                let _ = ACADEMY_FALLBACK_PHOTO;
            }

            players.push(player);
        }

        existing_team_ids.insert(academy_id.clone());
        teams.push(academy_team);
    }

    let parent_snapshots: Vec<(usize, String, String)> = teams
        .iter()
        .enumerate()
        .filter(|(_, team)| team.team_kind == TeamKind::Main)
        .map(|(index, team)| (index, team.id.clone(), team.name.clone()))
        .collect();

    for (parent_index, parent_id, parent_name) in parent_snapshots {
        let Some(academy_alias) = academy_team_alias_for_parent(&parent_name) else {
            continue;
        };

        let Some(parent) = teams.get(parent_index) else {
            continue;
        };
        if parent.academy_team_id.is_some() {
            continue;
        }

        let Some(seed_team) = seed_catalog
            .iter()
            .find(|candidate| normalize_academy_key(&candidate.team_name) == academy_alias)
        else {
            continue;
        };

        let academy_id = academy_seed_team_id(&seed_team.league_id, &seed_team.team_name);
        let Some(academy_index) = teams
            .iter()
            .position(|team| team.id == academy_id && team.team_kind == TeamKind::Academy)
        else {
            continue;
        };

        if let Some(parent_mut) = teams.iter_mut().find(|team| team.id == parent_id) {
            parent_mut.academy_team_id = Some(academy_id.clone());
        }

        if let Some(academy_team) = teams.get_mut(academy_index) {
            academy_team.parent_team_id = Some(parent_id.clone());
            academy_team.manager_id = None;
            academy_team.reputation = 6_200;
            academy_team.academy = Some(AcademyMetadata {
                lifecycle: AcademyLifecycle::Active,
                erl_assignment: ErlAssignment {
                    erl_league_id: seed_team.league_id.clone(),
                    country_rule: ErlAssignmentRule::Domestic,
                    fallback_reason: Some(format!(
                        "Seeded from {} academy roster",
                        seed_team.league_name
                    )),
                    reputation: 62,
                    acquisition_cost: 0,
                    acquired_at: current_date_iso.to_string(),
                    creation_cost: 0,
                    created_at: current_date_iso.to_string(),
                },
                source_team_id: academy_id,
                original_name: seed_team.team_name.clone(),
                original_short_name: seed_team.short_name.clone(),
                original_logo_url: seed_team.logo_url.clone(),
                current_logo_url: seed_team.logo_url.clone(),
                acquisition_cost: 0,
                acquired_at: current_date_iso.to_string(),
            });
        }
    }
}

pub(crate) fn ensure_example_academy_pool(game: &mut Game) {
    let bootstrap_date = game.clock.current_date.format("%Y-%m-%d").to_string();
    bootstrap_example_academy_pool_from_example(
        &mut game.teams,
        &mut game.players,
        &bootstrap_date,
    );
    remove_free_agents_shadowed_by_academy(&mut game.players, &game.teams);
}

fn resolve_default_world_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let cwd = std::env::current_dir().map_err(|e| format!("Failed to read current dir: {}", e))?;
    let mut candidates = vec![
        app_handle
            .path()
            .resource_dir()
            .ok()
            .map(|dir| dir.join("databases").join("world.json")),
        cwd.join("src-tauri")
            .join("databases")
            .join("world.json")
            .into(),
        cwd.join("databases").join("world.json").into(),
    ];

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(Some(exe_dir.join("databases").join("world.json")));
            candidates.push(Some(
                exe_dir
                    .join("resources")
                    .join("databases")
                    .join("world.json"),
            ));
        }
    }

    for candidate in candidates.into_iter().flatten() {
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    let embedded_world_json = include_str!("../../databases/world.json");
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| {
        format!(
            "Default world database not found and app data dir is unavailable: {}",
            e
        )
    })?;
    let db_dir = app_data_dir.join("databases");
    std::fs::create_dir_all(&db_dir)
        .map_err(|e| format!("Failed to create fallback databases directory: {}", e))?;

    let fallback_path = db_dir.join("world.json");
    if !fallback_path.exists() {
        std::fs::write(&fallback_path, embedded_world_json)
            .map_err(|e| format!("Failed to write fallback world database: {}", e))?;
    }

    if fallback_path.exists() {
        return Ok(fallback_path);
    }

    Err("Default world database not found (world.json).".to_string())
}

#[allow(dead_code)]
#[derive(Clone, Copy)]
struct LolSeedRatings {
    mechanics: u8,
    laning: u8,
    teamfighting: u8,
    macro_play: u8,
    consistency: u8,
    shotcalling: u8,
    champion_pool: u8,
    discipline: u8,
    mental_resilience: u8,
}

#[derive(Debug, Deserialize)]
struct DraftSeedRoot {
    data: DraftSeedData,
}

#[derive(Debug, Deserialize)]
struct DraftSeedData {
    #[allow(dead_code)]
    rostered_seeds: Vec<DraftPlayerSeed>,
    #[serde(default)]
    free_agent_seeds: Vec<DraftPlayerSeed>,
}

#[derive(Debug, Deserialize, Clone)]
struct DraftPlayerSeed {
    ign: String,
    #[serde(default)]
    #[serde(rename = "firstName")]
    first_name: Option<String>,
    #[serde(default)]
    #[serde(rename = "lastName")]
    last_name: Option<String>,
    #[serde(default)]
    dob: Option<String>,
    #[serde(default)]
    nationality: Option<String>,
    #[serde(default)]
    role: Option<String>,
    #[serde(default)]
    #[serde(rename = "teamId")]
    team_id: Option<String>,
    #[serde(default)]
    rating: Option<u8>,
    #[serde(default)]
    potential: Option<u8>,
    #[serde(default)]
    salary: Option<u32>,
    #[serde(default)]
    #[serde(rename = "contractEnd")]
    contract_end: Option<String>,
    #[serde(default)]
    #[serde(rename = "marketValue")]
    market_value: Option<u64>,
    #[serde(default)]
    reputation: Option<u8>,
    #[serde(default)]
    photo: Option<String>,
}

fn seed_profile_image_url(photo: Option<&str>) -> Option<String> {
    let value = photo?.trim();
    if value.is_empty() {
        return None;
    }
    if value.starts_with("/images/") {
        return Some(format!("/data/lec{}", value));
    }
    Some(value.to_string())
}

fn load_draft_seed_root() -> DraftSeedRoot {
    // Runtime read from draft/players.json for world editor compatibility.
    // Returns empty if file doesn't exist — Flow C provides players from modular data.
    let content = match std::fs::read_to_string(
        std::env::current_dir().ok().map_or_else(
            || std::path::PathBuf::from("data/draft/players.json"),
            |cwd| {
                let mut path = cwd.clone();
                path.push("data");
                path.push("draft");
                path.push("players.json");
                if path.exists() { return path; }
                // tauri dev: cwd is src-tauri/
                path = cwd;
                path.push("..");
                path.push("data");
                path.push("draft");
                path.push("players.json");
                path
            },
        ),
    ) {
        Ok(c) => c,
        Err(_) => return DraftSeedRoot {
            data: DraftSeedData {
                rostered_seeds: vec![],
                free_agent_seeds: vec![],
            },
        },
    };

    let mut merged = serde_json::from_str::<DraftSeedRoot>(&content).unwrap_or(DraftSeedRoot {
        data: DraftSeedData {
            rostered_seeds: vec![],
            free_agent_seeds: vec![],
        },
    });

    if let Some(external) = load_external_more_fa_seed() {
        let mut seen = HashSet::new();
        let mut combined = merged.data.free_agent_seeds;
        combined.extend(external.data.free_agent_seeds);
        combined.retain(|seed| {
            let key = normalize_seed_name(&seed.ign);
            if key.is_empty() || seen.contains(&key) {
                return false;
            }
            seen.insert(key)
        });
        merged.data.free_agent_seeds = combined;
    }

    merged
}

fn load_external_more_fa_seed() -> Option<DraftSeedRoot> {
    let mut candidates: Vec<std::path::PathBuf> = Vec::new();

    if let Ok(user_profile) = std::env::var("USERPROFILE") {
        candidates.push(
            std::path::PathBuf::from(user_profile)
                .join("Downloads")
                .join("MoreFA_Players.json"),
        );
    }

    if let Ok(home) = std::env::var("HOME") {
        candidates.push(
            std::path::PathBuf::from(home)
                .join("Downloads")
                .join("MoreFA_Players.json"),
        );
    }

    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("MoreFA_Players.json"));
        candidates.push(
            cwd.join("data")
                .join("lec")
                .join("draft")
                .join("MoreFA_Players.json"),
        );
    }

    for path in candidates {
        if !path.exists() {
            continue;
        }

        let Ok(raw) = std::fs::read_to_string(&path) else {
            continue;
        };

        if let Ok(parsed) = serde_json::from_str::<DraftSeedRoot>(&raw) {
            return Some(parsed);
        }
    }

    None
}

/// Load and cache free agent players from `data/players/free_agents.json`.
/// Uses OnceLock for lazy init — file is read once per process lifetime.
fn load_free_agent_players() -> &'static Vec<Player> {
    static FREE_AGENTS: OnceLock<Vec<Player>> = OnceLock::new();
    FREE_AGENTS.get_or_init(|| {
        let cwd = std::env::current_dir().ok();
        let candidates = [
            cwd.as_ref().map(|p| p.join("data").join("players").join("free_agents.json")),
            cwd.as_ref().map(|p| p.join("..").join("data").join("players").join("free_agents.json")),
            cwd.as_ref().map(|p| p.join("src-tauri").join("data").join("players").join("free_agents.json")),
        ];

        for path in candidates.iter().flatten() {
            if let Ok(content) = std::fs::read_to_string(path) {
                if let Ok(data) = serde_json::from_str::<PlayerDataFile>(&content) {
                    info!(
                        "[game] loaded {} free agent players from {:?}",
                        data.players.len(),
                        path
                    );
                    return data.players;
                }
            }
        }

        warn!("[game] data/players/free_agents.json not found — using empty pool");
        Vec::new()
    })
}

/// Inject players from `data/players/free_agents.json` into the player list.
/// Deduplicates by player ID to avoid collisions with competition-loaded players.
pub(crate) fn inject_json_free_agents(players: &mut Vec<Player>) {
    let mut existing_ids: HashSet<String> = players.iter().map(|p| p.id.clone()).collect();
    for fa in load_free_agent_players() {
        if !existing_ids.contains(&fa.id) {
            players.push(fa.clone());
            existing_ids.insert(fa.id.clone());
        }
    }
}

fn draft_seed_root() -> &'static DraftSeedRoot {
    static ROOT: OnceLock<DraftSeedRoot> = OnceLock::new();
    ROOT.get_or_init(load_draft_seed_root)
}

#[allow(dead_code)]
fn draft_potential_map() -> &'static HashMap<String, u8> {
    static POTENTIALS: OnceLock<HashMap<String, u8>> = OnceLock::new();
    POTENTIALS.get_or_init(|| {
        let parsed = draft_seed_root();

        let mut all_seeds = parsed.data.rostered_seeds.clone();
        all_seeds.extend(parsed.data.free_agent_seeds.clone());

        all_seeds
            .into_iter()
            .filter_map(|seed| {
                let key = normalize_seed_name(&seed.ign);
                if key.is_empty() {
                    return None;
                }
                Some((key, seed.potential.unwrap_or(99)))
            })
            .collect()
    })
}

pub(crate) fn potential_seed_for_player(match_name: &str) -> Option<u8> {
    let key = normalize_seed_name(match_name);
    draft_potential_map().get(&key).copied().or_else(
        || {
            if key == "kyeahoo" { Some(89) } else { None }
        },
    )
}

pub(crate) fn apply_seed_potential_defaults(players: &mut [Player]) {
    for player in players.iter_mut() {
        let Some(seed_potential) = potential_seed_for_player(&player.match_name) else {
            continue;
        };
        let current_ovr = ofm_core::potential::calculate_lol_ovr(player);
        player.potential_base = seed_potential.max(current_ovr).min(99);
        player.potential_revealed = None;
        player.potential_research_started_on = None;
        player.potential_research_eta_days = None;
    }
}

#[allow(dead_code)]
fn draft_photo_map() -> &'static HashMap<String, String> {
    static PHOTOS: OnceLock<HashMap<String, String>> = OnceLock::new();
    PHOTOS.get_or_init(|| {
        let parsed = draft_seed_root();

        let mut all_seeds = parsed.data.rostered_seeds.clone();
        all_seeds.extend(parsed.data.free_agent_seeds.clone());

        all_seeds
            .into_iter()
            .filter_map(|seed| {
                let key = normalize_seed_name(&seed.ign);
                let photo = seed_profile_image_url(seed.photo.as_deref())?;
                if key.is_empty() {
                    return None;
                }
                Some((key, photo))
            })
            .collect()
    })
}

#[allow(dead_code)]
fn photo_seed_for_player(match_name: &str) -> Option<String> {
    let key = normalize_seed_name(match_name);
    draft_photo_map().get(&key).cloned()
}

fn normalize_seed_name(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect()
}

#[allow(dead_code)]
fn lol_ratings_seed_for_player(match_name: &str) -> Option<LolSeedRatings> {
    let key = normalize_seed_name(match_name);
    let ratings = match key.as_str() {
        "myrwn" => LolSeedRatings {
            mechanics: 86,
            laning: 85,
            teamfighting: 85,
            macro_play: 80,
            consistency: 75,
            shotcalling: 75,
            champion_pool: 90,
            discipline: 78,
            mental_resilience: 85,
        },
        "elyoya" => LolSeedRatings {
            mechanics: 87,
            laning: 90,
            teamfighting: 85,
            macro_play: 87,
            consistency: 85,
            shotcalling: 90,
            champion_pool: 84,
            discipline: 88,
            mental_resilience: 90,
        },
        "jojopyun" => LolSeedRatings {
            mechanics: 91,
            laning: 93,
            teamfighting: 88,
            macro_play: 87,
            consistency: 82,
            shotcalling: 86,
            champion_pool: 82,
            discipline: 80,
            mental_resilience: 82,
        },
        "supa" => LolSeedRatings {
            mechanics: 84,
            laning: 82,
            teamfighting: 82,
            macro_play: 80,
            consistency: 82,
            shotcalling: 74,
            champion_pool: 79,
            discipline: 82,
            mental_resilience: 83,
        },
        "alvaro" => LolSeedRatings {
            mechanics: 85,
            laning: 84,
            teamfighting: 88,
            macro_play: 85,
            consistency: 80,
            shotcalling: 84,
            champion_pool: 80,
            discipline: 84,
            mental_resilience: 83,
        },
        "brokenblade" => LolSeedRatings {
            mechanics: 84,
            laning: 86,
            teamfighting: 84,
            macro_play: 86,
            consistency: 80,
            shotcalling: 84,
            champion_pool: 88,
            discipline: 83,
            mental_resilience: 85,
        },
        "skewmond" => LolSeedRatings {
            mechanics: 87,
            laning: 88,
            teamfighting: 86,
            macro_play: 84,
            consistency: 86,
            shotcalling: 82,
            champion_pool: 83,
            discipline: 86,
            mental_resilience: 88,
        },
        "caps" => LolSeedRatings {
            mechanics: 85,
            laning: 85,
            teamfighting: 88,
            macro_play: 93,
            consistency: 90,
            shotcalling: 93,
            champion_pool: 86,
            discipline: 90,
            mental_resilience: 90,
        },
        "hanssama" => LolSeedRatings {
            mechanics: 84,
            laning: 83,
            teamfighting: 84,
            macro_play: 84,
            consistency: 83,
            shotcalling: 82,
            champion_pool: 78,
            discipline: 82,
            mental_resilience: 82,
        },
        "labrov" => LolSeedRatings {
            mechanics: 83,
            laning: 84,
            teamfighting: 83,
            macro_play: 78,
            consistency: 78,
            shotcalling: 75,
            champion_pool: 80,
            discipline: 82,
            mental_resilience: 82,
        },
        "canna" => LolSeedRatings {
            mechanics: 84,
            laning: 88,
            teamfighting: 86,
            macro_play: 88,
            consistency: 88,
            shotcalling: 82,
            champion_pool: 85,
            discipline: 88,
            mental_resilience: 86,
        },
        "yike" => LolSeedRatings {
            mechanics: 89,
            laning: 86,
            teamfighting: 87,
            macro_play: 83,
            consistency: 84,
            shotcalling: 84,
            champion_pool: 85,
            discipline: 84,
            mental_resilience: 86,
        },
        "kyeahoo" => LolSeedRatings {
            mechanics: 84,
            laning: 83,
            teamfighting: 82,
            macro_play: 80,
            consistency: 81,
            shotcalling: 79,
            champion_pool: 84,
            discipline: 80,
            mental_resilience: 81,
        },
        "caliste" => LolSeedRatings {
            mechanics: 87,
            laning: 85,
            teamfighting: 84,
            macro_play: 80,
            consistency: 84,
            shotcalling: 76,
            champion_pool: 80,
            discipline: 84,
            mental_resilience: 86,
        },
        "busio" => LolSeedRatings {
            mechanics: 88,
            laning: 89,
            teamfighting: 85,
            macro_play: 84,
            consistency: 84,
            shotcalling: 85,
            champion_pool: 84,
            discipline: 83,
            mental_resilience: 84,
        },
        "naaknako" => LolSeedRatings {
            mechanics: 90,
            laning: 88,
            teamfighting: 86,
            macro_play: 85,
            consistency: 84,
            shotcalling: 82,
            champion_pool: 86,
            discipline: 84,
            mental_resilience: 85,
        },
        "lyncas" => LolSeedRatings {
            mechanics: 84,
            laning: 82,
            teamfighting: 84,
            macro_play: 82,
            consistency: 80,
            shotcalling: 84,
            champion_pool: 78,
            discipline: 82,
            mental_resilience: 83,
        },
        "humanoid" => LolSeedRatings {
            mechanics: 88,
            laning: 86,
            teamfighting: 86,
            macro_play: 85,
            consistency: 75,
            shotcalling: 85,
            champion_pool: 85,
            discipline: 80,
            mental_resilience: 79,
        },
        "carzzy" => LolSeedRatings {
            mechanics: 83,
            laning: 84,
            teamfighting: 83,
            macro_play: 81,
            consistency: 76,
            shotcalling: 80,
            champion_pool: 81,
            discipline: 77,
            mental_resilience: 76,
        },
        "fleshy" => LolSeedRatings {
            mechanics: 84,
            laning: 83,
            teamfighting: 82,
            macro_play: 78,
            consistency: 78,
            shotcalling: 80,
            champion_pool: 80,
            discipline: 80,
            mental_resilience: 77,
        },
        "lot" => LolSeedRatings {
            mechanics: 82,
            laning: 80,
            teamfighting: 79,
            macro_play: 76,
            consistency: 75,
            shotcalling: 78,
            champion_pool: 76,
            discipline: 78,
            mental_resilience: 75,
        },
        "isma" => LolSeedRatings {
            mechanics: 79,
            laning: 77,
            teamfighting: 78,
            macro_play: 79,
            consistency: 78,
            shotcalling: 80,
            champion_pool: 76,
            discipline: 82,
            mental_resilience: 80,
        },
        "jackies" => LolSeedRatings {
            mechanics: 84,
            laning: 82,
            teamfighting: 83,
            macro_play: 76,
            consistency: 75,
            shotcalling: 79,
            champion_pool: 77,
            discipline: 78,
            mental_resilience: 80,
        },
        "noah" => LolSeedRatings {
            mechanics: 85,
            laning: 85,
            teamfighting: 83,
            macro_play: 81,
            consistency: 80,
            shotcalling: 77,
            champion_pool: 80,
            discipline: 83,
            mental_resilience: 76,
        },
        "jun" => LolSeedRatings {
            mechanics: 85,
            laning: 86,
            teamfighting: 85,
            macro_play: 84,
            consistency: 82,
            shotcalling: 80,
            champion_pool: 80,
            discipline: 82,
            mental_resilience: 82,
        },
        "maynter" => LolSeedRatings {
            mechanics: 76,
            laning: 81,
            teamfighting: 78,
            macro_play: 77,
            consistency: 82,
            shotcalling: 76,
            champion_pool: 75,
            discipline: 82,
            mental_resilience: 78,
        },
        "rhilech" => LolSeedRatings {
            mechanics: 85,
            laning: 81,
            teamfighting: 84,
            macro_play: 80,
            consistency: 80,
            shotcalling: 82,
            champion_pool: 79,
            discipline: 80,
            mental_resilience: 84,
        },
        "poby" => LolSeedRatings {
            mechanics: 80,
            laning: 81,
            teamfighting: 80,
            macro_play: 82,
            consistency: 84,
            shotcalling: 78,
            champion_pool: 80,
            discipline: 80,
            mental_resilience: 77,
        },
        "samd" => LolSeedRatings {
            mechanics: 81,
            laning: 78,
            teamfighting: 82,
            macro_play: 76,
            consistency: 80,
            shotcalling: 78,
            champion_pool: 80,
            discipline: 81,
            mental_resilience: 76,
        },
        "parus" => LolSeedRatings {
            mechanics: 82,
            laning: 84,
            teamfighting: 82,
            macro_play: 85,
            consistency: 81,
            shotcalling: 84,
            champion_pool: 82,
            discipline: 81,
            mental_resilience: 82,
        },
        "empyros" => LolSeedRatings {
            mechanics: 74,
            laning: 73,
            teamfighting: 77,
            macro_play: 75,
            consistency: 78,
            shotcalling: 74,
            champion_pool: 78,
            discipline: 79,
            mental_resilience: 76,
        },
        "razork" => LolSeedRatings {
            mechanics: 88,
            laning: 83,
            teamfighting: 82,
            macro_play: 80,
            consistency: 78,
            shotcalling: 82,
            champion_pool: 83,
            discipline: 82,
            mental_resilience: 84,
        },
        "vladi" => LolSeedRatings {
            mechanics: 82,
            laning: 79,
            teamfighting: 80,
            macro_play: 79,
            consistency: 76,
            shotcalling: 80,
            champion_pool: 77,
            discipline: 75,
            mental_resilience: 76,
        },
        "upset" => LolSeedRatings {
            mechanics: 85,
            laning: 84,
            teamfighting: 80,
            macro_play: 81,
            consistency: 82,
            shotcalling: 79,
            champion_pool: 76,
            discipline: 82,
            mental_resilience: 80,
        },
        "lospa" => LolSeedRatings {
            mechanics: 83,
            laning: 84,
            teamfighting: 80,
            macro_play: 82,
            consistency: 78,
            shotcalling: 75,
            champion_pool: 77,
            discipline: 78,
            mental_resilience: 80,
        },
        "wunder" => LolSeedRatings {
            mechanics: 75,
            laning: 76,
            teamfighting: 78,
            macro_play: 76,
            consistency: 74,
            shotcalling: 80,
            champion_pool: 83,
            discipline: 72,
            mental_resilience: 73,
        },
        "skeanz" => LolSeedRatings {
            mechanics: 74,
            laning: 72,
            teamfighting: 72,
            macro_play: 73,
            consistency: 76,
            shotcalling: 75,
            champion_pool: 76,
            discipline: 78,
            mental_resilience: 75,
        },
        "lider" => LolSeedRatings {
            mechanics: 80,
            laning: 78,
            teamfighting: 78,
            macro_play: 72,
            consistency: 69,
            shotcalling: 74,
            champion_pool: 68,
            discipline: 70,
            mental_resilience: 72,
        },
        "jopa" => LolSeedRatings {
            mechanics: 82,
            laning: 80,
            teamfighting: 82,
            macro_play: 76,
            consistency: 80,
            shotcalling: 77,
            champion_pool: 78,
            discipline: 80,
            mental_resilience: 82,
        },
        "mikyx" => LolSeedRatings {
            mechanics: 78,
            laning: 79,
            teamfighting: 78,
            macro_play: 83,
            consistency: 77,
            shotcalling: 84,
            champion_pool: 82,
            discipline: 78,
            mental_resilience: 77,
        },
        "rooster" => LolSeedRatings {
            mechanics: 80,
            laning: 82,
            teamfighting: 76,
            macro_play: 72,
            consistency: 75,
            shotcalling: 67,
            champion_pool: 72,
            discipline: 78,
            mental_resilience: 78,
        },
        "boukada" => LolSeedRatings {
            mechanics: 72,
            laning: 69,
            teamfighting: 72,
            macro_play: 67,
            consistency: 71,
            shotcalling: 70,
            champion_pool: 68,
            discipline: 70,
            mental_resilience: 71,
        },
        "nuc" => LolSeedRatings {
            mechanics: 79,
            laning: 80,
            teamfighting: 80,
            macro_play: 81,
            consistency: 80,
            shotcalling: 80,
            champion_pool: 76,
            discipline: 78,
            mental_resilience: 77,
        },
        "paduck" => LolSeedRatings {
            mechanics: 80,
            laning: 78,
            teamfighting: 78,
            macro_play: 73,
            consistency: 76,
            shotcalling: 68,
            champion_pool: 70,
            discipline: 78,
            mental_resilience: 77,
        },
        "trymbi" => LolSeedRatings {
            mechanics: 72,
            laning: 72,
            teamfighting: 76,
            macro_play: 74,
            consistency: 75,
            shotcalling: 77,
            champion_pool: 78,
            discipline: 75,
            mental_resilience: 73,
        },
        "tracyn" => LolSeedRatings {
            mechanics: 80,
            laning: 76,
            teamfighting: 74,
            macro_play: 74,
            consistency: 76,
            shotcalling: 77,
            champion_pool: 72,
            discipline: 80,
            mental_resilience: 80,
        },
        "daglas" => LolSeedRatings {
            mechanics: 76,
            laning: 71,
            teamfighting: 73,
            macro_play: 70,
            consistency: 73,
            shotcalling: 72,
            champion_pool: 73,
            discipline: 78,
            mental_resilience: 76,
        },
        "serin" => LolSeedRatings {
            mechanics: 77,
            laning: 80,
            teamfighting: 76,
            macro_play: 75,
            consistency: 78,
            shotcalling: 75,
            champion_pool: 75,
            discipline: 78,
            mental_resilience: 75,
        },
        "ice" => LolSeedRatings {
            mechanics: 84,
            laning: 80,
            teamfighting: 80,
            macro_play: 80,
            consistency: 82,
            shotcalling: 72,
            champion_pool: 78,
            discipline: 80,
            mental_resilience: 80,
        },
        "way" => LolSeedRatings {
            mechanics: 70,
            laning: 72,
            teamfighting: 73,
            macro_play: 78,
            consistency: 74,
            shotcalling: 68,
            champion_pool: 74,
            discipline: 75,
            mental_resilience: 78,
        },
        _ => return None,
    };

    Some(ratings)
}

#[allow(dead_code)]
pub(crate) fn apply_lol_seed_ratings(players: &mut [Player]) {
    for player in players.iter_mut() {
        let Some(seed) = lol_ratings_seed_for_player(&player.match_name) else {
            continue;
        };

        // Keep legacy schema compatibility but use a strict 1:1 mapping to LoL stats.
        // These are now treated as the source for LoL profile/training progression.
        player.attributes.mechanics = seed.mechanics;
        player.attributes.laning = seed.laning;
        player.attributes.teamfighting = seed.teamfighting;
        player.attributes.macro_play = seed.macro_play;
        player.attributes.consistency = seed.consistency;
        player.attributes.shotcalling = seed.shotcalling;
        player.attributes.champion_pool = seed.champion_pool;
        player.attributes.discipline = seed.discipline;
        player.attributes.mental_resilience = seed.mental_resilience;

        if let Some(potential_base) = potential_seed_for_player(&player.match_name) {
            player.potential_base = potential_base.min(99);
        }
        if player.profile_image_url.is_none() {
            player.profile_image_url = photo_seed_for_player(&player.match_name);
        }
        player.potential_revealed = None;
        player.potential_research_started_on = None;
        player.potential_research_eta_days = None;
    }
}

fn default_initial_contract_end_for_start_year(start_year: i32) -> String {
    format!("{}-11-30", start_year + 1)
}

pub(crate) fn apply_default_initial_contract_end(players: &mut [Player]) {
    let default_initial_contract_end = default_initial_contract_end_for_start_year(2025);

    for player in players.iter_mut() {
        if player.contract_end.is_none() {
            player.contract_end = Some(default_initial_contract_end.clone());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{apply_default_initial_contract_end, default_initial_contract_end_for_start_year};
    use domain::player::{Player, PlayerAttributes};
    use domain::stats::LolRole;

    fn default_attrs() -> PlayerAttributes {
        PlayerAttributes {
            mechanics: 60,
            laning: 60,
            teamfighting: 60,
            macro_play: 60,
            consistency: 60,
            shotcalling: 60,
            champion_pool: 60,
            discipline: 60,
            mental_resilience: 60,
        }
    }

    fn player_with_contract(id: &str, contract_end: Option<&str>) -> Player {
        let mut player = Player::new(
            id.to_string(),
            id.to_string(),
            id.to_string(),
            "2000-01-01".to_string(),
            "ES".to_string(),
            LolRole::Jungle,
            default_attrs(),
        );
        player.contract_end = contract_end.map(str::to_string);
        player
    }

    #[test]
    fn default_initial_contract_end_survives_first_next_season_friendlies() {
        assert_eq!(
            default_initial_contract_end_for_start_year(2025),
            "2026-11-30"
        );
        assert_eq!(
            default_initial_contract_end_for_start_year(2026),
            "2027-11-30"
        );
    }

    #[test]
    fn apply_default_initial_contract_end_only_fills_missing_contracts() {
        let mut players = vec![
            player_with_contract("missing", None),
            player_with_contract("existing", Some("2028-11-30")),
        ];

        apply_default_initial_contract_end(&mut players);

        assert_eq!(players[0].contract_end.as_deref(), Some("2026-11-30"));
        assert_eq!(players[1].contract_end.as_deref(), Some("2028-11-30"));
    }
}

fn seed_is_free_agent(seed: &DraftPlayerSeed) -> bool {
    seed.team_id
        .as_deref()
        .map(normalize_seed_name)
        .map(|team| team == "fa" || team == "freeagent")
        .unwrap_or(true)
}

fn role_to_lol_role(role: Option<&str>) -> domain::stats::LolRole {
    let key = role.map(normalize_seed_name).unwrap_or_default();
    match key.as_str() {
        "top" => domain::stats::LolRole::Top,
        "jungle" => domain::stats::LolRole::Jungle,
        "mid" | "middle" => domain::stats::LolRole::Mid,
        "bot" | "adc" | "bottom" => domain::stats::LolRole::Adc,
        "support" | "sup" | "utility" => domain::stats::LolRole::Support,
        _ => domain::stats::LolRole::Mid,
    }
}

fn clamp_stat(value: i16) -> u8 {
    value.clamp(25, 99) as u8
}

fn build_lol_stats_from_seed(seed: &DraftPlayerSeed) -> [u8; 9] {
    let target = i16::from(seed.rating.unwrap_or(60).clamp(45, 95));
    let role_key = normalize_seed_name(seed.role.as_deref().unwrap_or(""));
    let role_bias: [i16; 9] = match role_key.as_str() {
        "top" => [1, 0, 1, 0, 1, 1, 0, 1, 2],
        "jungle" => [0, 0, 1, 2, 1, 2, 1, 1, 1],
        "mid" | "middle" => [2, 2, 0, 1, 0, 1, 1, 0, 0],
        "bot" | "adc" | "bottom" => [2, 2, 1, 0, 0, 0, 1, 0, 1],
        "support" | "sup" | "utility" => [0, 0, 1, 2, 1, 2, 0, 1, 1],
        _ => [0, 0, 0, 0, 0, 0, 0, 0, 0],
    };

    let base_hash = normalize_seed_name(&seed.ign)
        .chars()
        .fold(0_i16, |acc, ch| acc.wrapping_add(ch as i16));

    let mut values = [target; 9];
    for index in 0..9 {
        let jitter = ((base_hash + (index as i16 * 7)) % 5) - 2;
        values[index] = target + role_bias[index] + jitter;
    }

    let current_avg = values.iter().sum::<i16>() / 9;
    let mut delta = target - current_avg;
    let mut cursor = 0_usize;
    while delta != 0 {
        let direction = if delta > 0 { 1 } else { -1 };
        let candidate = values[cursor] + direction;
        if (25..=99).contains(&candidate) {
            values[cursor] = candidate;
            delta -= direction;
        }
        cursor = (cursor + 1) % 9;
    }

    [
        clamp_stat(values[0]),
        clamp_stat(values[1]),
        clamp_stat(values[2]),
        clamp_stat(values[3]),
        clamp_stat(values[4]),
        clamp_stat(values[5]),
        clamp_stat(values[6]),
        clamp_stat(values[7]),
        clamp_stat(values[8]),
    ]
}

fn build_attributes_from_seed(seed: &DraftPlayerSeed) -> PlayerAttributes {
    let [mechanics, laning, teamfighting, macro_play, consistency, shotcalling, champion_pool, discipline, mental_resilience] =
        build_lol_stats_from_seed(seed);

    PlayerAttributes {
        mechanics,
        laning,
        teamfighting,
        macro_play,
        consistency,
        shotcalling,
        champion_pool,
        discipline,
        mental_resilience,
    }
}

fn build_free_agent_player(seed: &DraftPlayerSeed, index: usize) -> Option<Player> {
    let ign = seed.ign.trim();
    if ign.is_empty() {
        return None;
    }

    let first_name = seed.first_name.as_deref().unwrap_or(ign).trim().to_string();
    let last_name = seed.last_name.as_deref().unwrap_or("").trim().to_string();
    let full_name = if last_name.is_empty() {
        first_name.clone()
    } else {
        format!("{} {}", first_name, last_name)
    };

    let dob = seed.dob.clone().unwrap_or_else(|| "2002-01-01".to_string());
    let nationality = seed.nationality.clone().unwrap_or_else(|| "KR".to_string());
    let position = role_to_lol_role(seed.role.as_deref());
    let attributes = build_attributes_from_seed(seed);

    let seed_key = normalize_seed_name(ign);
    let id = format!("lec-fa-{}-{}", seed_key, index + 1);

    let mut player = Player::new(
        id,
        ign.to_string(),
        full_name,
        dob,
        nationality,
        position,
        attributes,
    );
    player.team_id = None;
    player.transfer_listed = true;
    player.loan_listed = false;
    let seed_ovr = seed.rating.unwrap_or(70);
    let seed_potential = seed.potential.unwrap_or(seed_ovr).max(seed_ovr);
    player.market_value = seed
        .market_value
        .unwrap_or_else(|| suggested_seed_market_value(seed_ovr, seed_potential, false));
    player.wage = seed.salary.unwrap_or(40_000);
    player.contract_end = seed.contract_end.clone();
    player.condition = 100;
    player.morale = seed.reputation.unwrap_or(68).clamp(35, 95);
    player.potential_base = seed
        .potential
        .unwrap_or(seed.rating.unwrap_or(70))
        .clamp(45, 99);
    player.profile_image_url = seed_profile_image_url(seed.photo.as_deref());

    Some(player)
}

pub(crate) fn inject_seed_free_agents(players: &mut Vec<Player>) {
    let existing_ids: HashSet<String> = players
        .iter()
        .map(|player| normalize_seed_name(&player.match_name))
        .collect();
    let mut existing_ids = existing_ids;

    for (index, seed) in draft_seed_root().data.free_agent_seeds.iter().enumerate() {
        if !seed_is_free_agent(seed) {
            continue;
        }

        let seed_key = normalize_seed_name(&seed.ign);
        if seed_key.is_empty() || existing_ids.contains(&seed_key) {
            continue;
        }

        if let Some(player) = build_free_agent_player(seed, index) {
            players.push(player);
            existing_ids.insert(seed_key);
        }
    }
}

pub(crate) fn remove_free_agents_shadowed_by_academy(players: &mut Vec<Player>, teams: &[Team]) {
    let academy_team_ids: HashSet<&str> = teams
        .iter()
        .filter(|team| team.team_kind == TeamKind::Academy)
        .map(|team| team.id.as_str())
        .collect();

    if academy_team_ids.is_empty() {
        return;
    }

    let academy_names: HashSet<String> = players
        .iter()
        .filter(|player| {
            player
                .team_id
                .as_deref()
                .map(|team_id| academy_team_ids.contains(team_id))
                .unwrap_or(false)
        })
        .map(|player| normalize_seed_name(&player.match_name))
        .filter(|key| !key.is_empty())
        .collect();

    if academy_names.is_empty() {
        return;
    }

    players.retain(|player| {
        player.team_id.is_some()
            || !academy_names.contains(&normalize_seed_name(&player.match_name))
    });
}

/// Step 1 (Flow C / lightweight): Create manager only, no world loaded.
/// Teams, players, staff are empty — they'll be assembled on select_team().
/// Used when the frontend wants to show league/team selection first.
#[tauri::command]
pub async fn start_new_game_lightweight(
    app_handle: tauri::AppHandle,
    state: State<'_, StateManager>,
    nickname: Option<String>,
    first_name: String,
    last_name: String,
    dob: String,
    nationality: String,
) -> Result<String, String> {
    info!(
        "[cmd] start_new_game_lightweight: {} {} (nickname={:?}, nationality={})",
        first_name, last_name, nickname, nationality
    );
    // Validate inputs (same as start_new_game)
    let first_name = first_name.trim().to_string();
    let last_name = last_name.trim().to_string();
    let nickname = nickname.unwrap_or_default().trim().to_string();
    if first_name.is_empty() || last_name.is_empty() {
        return Err("First name and last name are required.".to_string());
    }
    if first_name.len() > 30 || last_name.len() > 30 {
        return Err("First name and last name must not exceed 30 characters.".to_string());
    }
    if nickname.len() > 20 {
        return Err("Nickname must not exceed 20 characters.".to_string());
    }
    let nationality = nationality.trim().to_string();
    if nationality.is_empty() {
        return Err("Nationality is required.".to_string());
    }

    let start_date = chrono::Utc.with_ymd_and_hms(2025, 1, 1, 0, 0, 0).unwrap();

    let birth_date = chrono::NaiveDate::parse_from_str(&dob, "%Y-%m-%d")
        .map_err(|_| "Invalid date of birth. Use YYYY-MM-DD format.".to_string())?;
    let age = calculate_age_on_date(birth_date, start_date.date_naive());
    if age > 99 {
        return Err("Invalid date of birth.".to_string());
    }

    let mut manager = Manager::new(
        "mgr_user".to_string(),
        first_name,
        last_name,
        dob,
        nationality,
    );
    manager.nickname = nickname;

    let clock = GameClock::new(start_date);

    // Empty world — will be assembled on select_team()
    let new_game = Game::new(clock, manager, vec![], vec![], vec![], vec![]);

    info!(
        "[cmd] start_new_game_lightweight: manager created (no world), storing game in state"
    );
    state.set_game(new_game);
    state.set_stats_state(StatsState::default());
    info!("[cmd] start_new_game_lightweight: completed");
    Ok("ok".to_string())
}

/// Step 1: Create manager + generate world. No team assigned yet.
/// Returns the Game object so the frontend can show team selection.
/// world_source: "random" (default) or a file path to a JSON world database.
#[tauri::command]
pub async fn start_new_game(
    app_handle: tauri::AppHandle,
    state: State<'_, StateManager>,
    nickname: Option<String>,
    first_name: String,
    last_name: String,
    dob: String,
    nationality: String,
    world_source: Option<String>,
    avatar_path: Option<String>,
) -> Result<String, String> {
    info!(
        "[cmd] start_new_game: {} {} (nickname={:?}, nationality={}, world_source={:?})",
        first_name, last_name, nickname, nationality, world_source
    );
    // Validate inputs
    let first_name = first_name.trim().to_string();
    let last_name = last_name.trim().to_string();
    let nickname = nickname.unwrap_or_default().trim().to_string();
    if first_name.is_empty() || last_name.is_empty() {
        return Err("First name and last name are required.".to_string());
    }
    if first_name.len() > 30 || last_name.len() > 30 {
        return Err("First name and last name must not exceed 30 characters.".to_string());
    }
    if nickname.len() > 20 {
        return Err("Nickname must not exceed 20 characters.".to_string());
    }
    let nationality = nationality.trim().to_string();
    if nationality.is_empty() {
        return Err("Nationality is required.".to_string());
    }

    let start_date = chrono::Utc.with_ymd_and_hms(2025, 1, 1, 0, 0, 0).unwrap();

    // Validate DOB: must be a valid date and within a sensible range for the game start date.
    let birth_date = chrono::NaiveDate::parse_from_str(&dob, "%Y-%m-%d")
        .map_err(|_| "Invalid date of birth. Use YYYY-MM-DD format.".to_string())?;
    let age = calculate_age_on_date(birth_date, start_date.date_naive());
    if age > 99 {
        return Err("Invalid date of birth.".to_string());
    }

    let mut manager = Manager::new(
        "mgr_user".to_string(),
        first_name,
        last_name,
        dob,
        nationality,
    );
    manager.nickname = nickname;
    manager.avatar_path = avatar_path;

    let clock = GameClock::new(start_date);

    // Load world based on source
    let world_source = world_source.unwrap_or_else(|| "default".to_string());
    let (teams, mut players, staff) = if world_source == "random" {
        ofm_core::generator::generate_world(None)
    } else if world_source == "default" {
        let path = resolve_default_world_path(&app_handle)?;
        let json = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read world database: {}", e))?;
        let has_explicit_potential_base = json.contains("\"potential_base\"");
        let mut world = ofm_core::generator::load_world_from_json(&json)?;
        if !has_explicit_potential_base {
            apply_seed_potential_defaults(&mut world.players);
        }
        (world.teams, world.players, world.staff)
    } else {
        // Try to load from file path (strip "file:" prefix if present)
        let path = world_source.strip_prefix("file:").unwrap_or(&world_source);
        let json = std::fs::read_to_string(path)
            .map_err(|e| format!("Failed to read world database: {}", e))?;
        let has_explicit_potential_base = json.contains("\"potential_base\"");
        let mut world = ofm_core::generator::load_world_from_json(&json)?;
        if !has_explicit_potential_base {
            apply_seed_potential_defaults(&mut world.players);
        }
        (world.teams, world.players, world.staff)
    };

    let academy_bootstrap_date = clock.current_date.format("%Y-%m-%d").to_string();
    let mut teams = teams;
    bootstrap_example_academy_pool_from_example(&mut teams, &mut players, &academy_bootstrap_date);
    remove_free_agents_shadowed_by_academy(&mut players, &teams);
    inject_seed_free_agents(&mut players);
    inject_json_free_agents(&mut players);
    apply_default_initial_contract_end(&mut players);

    let new_game = Game::new(clock, manager, teams, players, staff, vec![]);

    info!(
        "[cmd] start_new_game: world generated with {} teams, {} players, {} staff",
        new_game.teams.len(),
        new_game.players.len(),
        new_game.staff.len()
    );
    info!("[cmd] start_new_game: storing game in state");
    state.set_game(new_game);
    state.set_stats_state(StatsState::default());
    info!("[cmd] start_new_game: completed");
    Ok("ok".to_string())
}

/// Extract competition ID from a scoped team ID like "lec-g2" → "lec".
fn competition_id_from_team_id(team_id: &str) -> Option<&str> {
    let dash_pos = team_id.find('-')?;
    let prefix = &team_id[..dash_pos];
    if prefix.is_empty() {
        return None;
    }
    Some(prefix)
}

/// Assemble teams, players, and staff from modular competition data files.
/// Used by Flow C: the game was created lightweight (empty teams/players),
/// and now we need to load the selected competition's data.
fn assemble_world_from_modular_data(
    app_handle: &tauri::AppHandle,
    competition_id: &str,
    team_id: &str,
) -> Result<(Vec<Team>, Vec<Player>, Vec<Staff>), String> {
    info!(
        "[game] assemble_world_from_modular_data: competition={}, team_id={}",
        competition_id, team_id
    );

    // 1. Scan ALL competitions and load every team + player
    let manifests = crate::commands::competitions::scan_competitions(app_handle);
    let mut all_teams: Vec<Team> = Vec::new();
    let mut all_players: Vec<Player> = Vec::new();

    for manifest in &manifests {
        let cid = &manifest.id;
        let prefix = format!("{}-", cid);

        if let Ok(mut comp_teams) = crate::commands::competitions::load_competition_teams(app_handle, manifest) {
            for team in &mut comp_teams {
                if !team.id.starts_with(&prefix) {
                    team.id = format!("{}{}", prefix, team.id);
                }
                team.competition_id = Some(cid.to_string());
            }
            all_teams.extend(comp_teams);
        }
        let player_count_before = all_players.len();
        if let Ok(comp_players) = crate::commands::competitions::load_competition_players(app_handle, manifest) {
            for mut player in comp_players {
                if let Some(ref tid) = player.team_id.clone() {
                    if tid != "fa" && tid != "freeagent" && !tid.starts_with(&prefix) {
                        player.team_id = Some(format!("{}-{}", cid, tid));
                    }
                }
                if player.morale == 0 { player.morale = 68; }
                if player.condition == 0 { player.condition = 100; }
                all_players.push(player);
            }
        }
        let loaded = all_players.len() - player_count_before;
        info!("[game] loaded {} players for '{}'", loaded, cid);
    }

    // 2. Load staff free agents
    let mut staff = crate::commands::competitions::load_staff_free_agents(app_handle)?;

    // 3. Bootstrap academy seeds from ERL JSON data
    let academy_bootstrap_date = "2025-01-01".to_string();
    let academy_count = crate::commands::competitions::bootstrap_academy_pool_from_erl_json(
        app_handle,
        &mut all_teams,
        &mut all_players,
        &academy_bootstrap_date,
    );
    if academy_count == 0 {
        // Fallback: compile-time .txt catalog (legacy worlds)
        bootstrap_example_academy_pool_from_example(&mut all_teams, &mut all_players, &academy_bootstrap_date);
    }
    remove_free_agents_shadowed_by_academy(&mut all_players, &all_teams);

    // 4. Inject free agent players from JSON
    inject_json_free_agents(&mut all_players);

    // 5. Apply default contract ends
    apply_default_initial_contract_end(&mut all_players);

    info!(
        "[game] assemble_world_from_modular_data: {} teams, {} players",
        all_teams.len(),
        all_players.len()
    );

    Ok((all_teams, all_players, staff))
}

/// Step 2: User picks a team. Assigns manager, generates welcome message, saves to DB.
/// Supports both Flow A (world pre-loaded) and Flow C (modular assembly).
#[tauri::command]
pub async fn select_team(
    state: State<'_, StateManager>,
    sm_state: State<'_, SaveManagerState>,
    app_handle: tauri::AppHandle,
    team_id: String,
) -> Result<Game, String> {
    info!("[cmd] select_team: team_id={}", team_id);
    let mut game = state
        .get_game(|g: &Game| g.clone())
        .ok_or("No active game session".to_string())?;

    // Detect flow: if game has no teams, this is Flow C (modular assembly)
    if game.teams.is_empty() {
        info!("[cmd] select_team: empty game state — assembling from modular data");

        // Extract competition ID from team ID (e.g. "lec-g2" → "lec")
        let competition_id = competition_id_from_team_id(&team_id)
            .ok_or_else(|| format!("Invalid team ID format '{}': missing competition prefix", team_id))?;

        // Assemble teams, players, staff from modular data
        let (assembled_teams, assembled_players, assembled_staff) =
            assemble_world_from_modular_data(&app_handle, competition_id, &team_id)?;

        game.teams = assembled_teams;
        game.players = assembled_players;
        game.staff = assembled_staff;
    }

    // Validate team exists
    let team = game
        .teams
        .iter()
        .find(|t| t.id == team_id)
        .ok_or("Team not found".to_string())?;
    if team.team_kind == TeamKind::Academy {
        return Err("Academy teams cannot be selected as manager team".to_string());
    }
    let team_name = team.name.clone();

    // Assign manager to team
    game.manager.hire(team_id.clone());
    if let Some(t) = game.teams.iter_mut().find(|t| t.id == team_id) {
        t.manager_id = Some(game.manager.id.clone());
    }

    // Generate schedules for ALL competitions
    let season_year = game.clock.current_date.year();
    let user_cid = competition_id_from_team_id(&team_id);
    let all_manifests = crate::commands::competitions::scan_competitions(&app_handle);
    let mut all_leagues: Vec<domain::league::League> = Vec::new();

    for manifest in &all_manifests {
        let cid = &manifest.id;
        let prefix = format!("{}-", cid);
        let team_ids: Vec<String> = game.teams.iter()
            .filter(|team| team.team_kind != TeamKind::Academy && team.id.starts_with(&prefix))
            .map(|team| team.id.clone()).collect();

        if team_ids.len() < 2 { continue; }

        let schedule_config = &manifest.schedule;
        let mut league = ofm_core::schedule::generate_schedule_from_config(
            &manifest.name, season_year as u32, &team_ids, schedule_config, 0,
        );

        // Generate preseason friendlies for ALL competitions
        let today = game.clock.current_date.format("%Y-%m-%d").to_string();
        let split = &schedule_config.splits[0];
        let season_start = chrono::Utc
            .with_ymd_and_hms(season_year, split.season_start.month, split.season_start.day, 0, 0, 0)
            .unwrap();
        let num_friendlies = schedule_config.preseason_friendlies as usize;
        if num_friendlies > 0 {
            if user_cid == Some(cid.as_str()) {
                // User's competition: only generate friendlies for the user's team
                let opponents: Vec<String> = team_ids.iter()
                    .filter(|tid| tid.as_str() != team_id).cloned().collect();
                if !opponents.is_empty() {
                    let mut friendlies = ofm_core::schedule::generate_preseason_friendlies(
                        &team_id, &opponents, season_start, num_friendlies,
                    );
                    friendlies.retain(|fixture| fixture.date >= today);
                    ofm_core::schedule::append_fixtures(&mut league, friendlies);
                }
            } else {
                // Background competitions: generate friendlies for all teams
                for tid in &team_ids {
                    let opponents: Vec<String> = team_ids.iter()
                        .filter(|t| t.as_str() != tid.as_str()).cloned().collect();
                    if !opponents.is_empty() {
                        let mut friendlies = ofm_core::schedule::generate_preseason_friendlies(
                            tid, &opponents, season_start, num_friendlies,
                        );
                        friendlies.retain(|fixture| fixture.date >= today);
                        ofm_core::schedule::append_fixtures(&mut league, friendlies);
                    }
                }
            }
        }

        league.competition_id = Some(cid.clone());
        all_leagues.push(league);
    }

    // Populate competition_configs from all manifests for bg season cycling
    for manifest in &all_manifests {
        game.competition_configs
            .insert(manifest.id.clone(), manifest.schedule.clone());
    }

    game.leagues = all_leagues;
    game.user_competition_id = user_cid.map(String::from);
    ofm_core::champions::bootstrap_champion_state(&mut game);
    ofm_core::season_context::refresh_game_context(&mut game);

    // Rich templated messages
    let date_str = game.clock.current_date.to_rfc3339();

    // Get league name for messages
    let league_display_name = user_cid
        .and_then(|cid| crate::commands::competitions::load_competition_manifest(&app_handle, cid).ok())
        .map(|m| format!("{} {}", m.name, m.schedule.splits.first().map(|s| s.name.as_str()).unwrap_or("")))
        .unwrap_or_else(|| "LEC Winter".to_string());

    let welcome_msg = ofm_core::messages::welcome_message(&team_name, &team_id, &date_str);
    game.messages.push(welcome_msg);

    if let Some(parent_team) = game.teams.iter().find(|team| team.id == team_id) {
        if let Some(academy_team_id) = parent_team.academy_team_id.as_deref() {
            if let Some(academy_team) = game.teams.iter().find(|team| team.id == academy_team_id) {
                let academy_roster_count = game
                    .players
                    .iter()
                    .filter(|player| player.team_id.as_deref() == Some(academy_team_id))
                    .count();
                game.messages.push(academy_overview_message(
                    parent_team,
                    academy_team,
                    academy_roster_count,
                    &date_str,
                ));
            }
        }
    }

    // For schedule message, compute season start from user competition manifest or fallback
    let season_start_str = if let Some(cid) = user_cid {
        if let Ok(m) = crate::commands::competitions::load_competition_manifest(&app_handle, cid) {
            let split = &m.schedule.splits[0];
            format!(
                "{} {}, {}",
                chrono::Month::try_from(split.season_start.month as u8).map(|mon| mon.name()).unwrap_or("January"),
                split.season_start.day,
                season_year
            )
        } else {
            format!("January 18, {}", season_year)
        }
    } else {
        format!("January 18, {}", season_year)
    };

    let season_msg = ofm_core::messages::season_schedule_message(
        &league_display_name,
        &season_start_str,
        &date_str,
    );
    game.messages.push(season_msg);

    let team_names: Vec<String> = game
        .teams
        .iter()
        .filter(|team| team.team_kind != TeamKind::Academy)
        .map(|team| team.name.clone())
        .collect();
    game.news.push(ofm_core::news::season_preview_article(
        &team_names,
        &date_str,
    ));

    let staff_msg = ofm_core::messages::staff_advice_message(&team_name, &team_id, &date_str);
    game.messages.push(staff_msg);

    ofm_core::player_events::generate_contract_concern_messages(&mut game, false);

    // Save to new per-save DB
    let manager_name = game.manager.display_name();
    let save_name = format!("{}'s Career", manager_name);

    let mut sm = sm_state
        .0
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    let save_id = sm.create_save(&game, &save_name)?;
    state.set_save_id(save_id);

    state.set_game(game.clone());
    state.set_stats_state(StatsState::default());
    Ok(game)
}

#[tauri::command]
pub async fn get_saves(sm_state: State<'_, SaveManagerState>) -> Result<Vec<SaveEntry>, String> {
    log::debug!("[cmd] get_saves");
    let sm = sm_state
        .0
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    Ok(sm.list_saves().to_vec())
}

#[tauri::command]
pub async fn delete_save(
    sm_state: State<'_, SaveManagerState>,
    save_id: String,
) -> Result<bool, String> {
    info!("[cmd] delete_save: save_id={}", save_id);
    let mut sm = sm_state
        .0
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    sm.delete_save(&save_id)
}

#[tauri::command]
pub async fn load_game(
    state: State<'_, StateManager>,
    sm_state: State<'_, SaveManagerState>,
    save_id: String,
) -> Result<String, String> {
    info!("[cmd] load_game: save_id={}", save_id);

    let mut sm = sm_state
        .0
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    info!("[cmd] load_game: loading game data from save");
    let mut game = sm.load_game(&save_id)?;
    info!(
        "[cmd] load_game: game loaded, players={}, teams={}",
        game.players.len(),
        game.teams.len()
    );

    // Legacy migration is handled by Game's custom Deserialize

    remove_free_agents_shadowed_by_academy(&mut game.players, &game.teams);
    inject_seed_free_agents(&mut game.players);
    inject_json_free_agents(&mut game.players);
    ofm_core::champions::bootstrap_champion_state(&mut game);

    info!("[cmd] load_game: loading stats state");
    let stats_state = sm.load_stats_state(&save_id)?;
    info!("[cmd] load_game: stats state loaded");

    ofm_core::season_context::refresh_game_context(&mut game);
    info!("[cmd] load_game: context refreshed");

    let mgr_name = game.manager.display_name();
    info!("[cmd] load_game: manager={}", mgr_name);

    info!("[cmd] load_game: setting state");
    state.set_save_id(save_id);
    state.set_game(game);
    state.set_stats_state(stats_state);
    info!("[cmd] load_game: state set, returning manager name");

    Ok(mgr_name)
}

#[tauri::command]
pub async fn get_active_game(state: State<'_, StateManager>) -> Result<Game, String> {
    log::info!("[cmd] get_active_game: start");
    let game = state.get_game(|g: &Game| g.clone()).ok_or_else(|| {
        log::error!("[cmd] get_active_game: no active game in state");
        "No active game session".to_string()
    })?;
    log::info!(
        "[cmd] get_active_game: found game with {} players, {} teams",
        game.players.len(),
        game.teams.len()
    );
    ofm_core::champions::bootstrap_champion_state(&mut game.clone());
    Ok(game)
}

#[tauri::command]
pub async fn get_team_selection_data(
    state: State<'_, StateManager>,
) -> Result<TeamSelectionData, String> {
    log::debug!("[cmd] get_team_selection_data");
    state
        .get_game(|game| TeamSelectionData {
            manager: game.manager.clone(),
            teams: game
                .teams
                .iter()
                .filter(|team| team.team_kind != TeamKind::Academy)
                .cloned()
                .collect(),
            players: game.players.clone(),
        })
        .ok_or("No active game session".to_string())
}

#[tauri::command]
pub async fn save_game(
    state: State<'_, StateManager>,
    sm_state: State<'_, SaveManagerState>,
) -> Result<(), String> {
    info!("[cmd] save_game");
    let game = state
        .get_game(|g: &Game| g.clone())
        .ok_or("No active game session".to_string())?;

    let save_id = state
        .get_save_id()
        .ok_or("No active save session".to_string())?;

    let mut sm = sm_state
        .0
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    sm.save_game(&game, &save_id)?;
    let stats_state = state
        .get_stats_state(|stats| stats.clone())
        .unwrap_or_default();
    sm.save_stats_state(&stats_state, &save_id)
}

/// Save the current game and clear the active session so the player returns to the main menu.
#[tauri::command]
pub async fn exit_to_menu(
    state: State<'_, StateManager>,
    sm_state: State<'_, SaveManagerState>,
) -> Result<(), String> {
    info!("[cmd] exit_to_menu");
    let game = state
        .get_game(|g: &Game| g.clone())
        .ok_or("No active game session")?;

    // Auto-save
    if let Some(save_id) = state.get_save_id() {
        let mut sm = sm_state
            .0
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        sm.save_game(&game, &save_id)?;
        let stats_state = state
            .get_stats_state(|stats| stats.clone())
            .unwrap_or_default();
        sm.save_stats_state(&stats_state, &save_id)?;
    }

    // Clear the in-memory game state
    state.clear_game();
    state.clear_save_id();

    Ok(())
}

/// Save manager avatar file to app data directory
#[tauri::command]
pub async fn save_manager_avatar(
    app_handle: tauri::AppHandle,
    filename: String,
    data: Vec<u8>,
) -> Result<String, AppError> {
    info!("[cmd] save_manager_avatar: filename={}", filename);

    let safe_name = avatar::safe_avatar_filename(&filename)?;

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(format!("Failed to get app data dir: {}", e)))?;

    let avatar_dir = app_data_dir.join("manager-avatars");
    std::fs::create_dir_all(&avatar_dir)
        .map_err(|e| AppError::Io(format!("Failed to create avatar directory: {}", e)))?;

    let file_path = avatar_dir.join(&safe_name);
    // Extra safety: verify resolved path is within the avatar directory
    let canonical = file_path
        .canonicalize()
        .map_err(|e| AppError::Io(format!("Failed to resolve avatar path: {}", e)))?;
    let canonical_dir = avatar_dir
        .canonicalize()
        .map_err(|e| AppError::Io(format!("Failed to resolve avatar directory: {}", e)))?;
    if !canonical.starts_with(&canonical_dir) {
        return Err(AppError::Validation(
            "Avatar path traversal detected".into(),
        ));
    }

    std::fs::write(&file_path, &data)
        .map_err(|e| AppError::Io(format!("Failed to write avatar file: {}", e)))?;

    info!("[cmd] save_manager_avatar: saved to {:?}", file_path);
    Ok(safe_name)
}

/// Load manager avatar as base64 data URL
#[tauri::command]
pub async fn load_manager_avatar(
    app_handle: tauri::AppHandle,
    filename: String,
) -> Result<String, AppError> {
    info!("[cmd] load_manager_avatar: filename={}", filename);

    let safe_name = avatar::safe_avatar_filename(&filename)?;

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(format!("Failed to get app data dir: {}", e)))?;

    let avatar_dir = app_data_dir.join("manager-avatars");
    let file_path = avatar_dir.join(&safe_name);
    // Extra safety: verify resolved path is within the avatar directory
    let canonical = file_path
        .canonicalize()
        .map_err(|e| AppError::Io(format!("Failed to resolve avatar path: {}", e)))?;
    let canonical_dir = avatar_dir
        .canonicalize()
        .map_err(|e| AppError::Io(format!("Failed to resolve avatar directory: {}", e)))?;
    if !canonical.starts_with(&canonical_dir) {
        return Err(AppError::Validation(
            "Avatar path traversal detected".into(),
        ));
    }

    if !file_path.exists() {
        return Err(AppError::NotFound(format!(
            "Avatar file not found: {}",
            safe_name
        )));
    }

    let data = std::fs::read(&file_path)
        .map_err(|e| AppError::Io(format!("Failed to read avatar file: {}", e)))?;

    // Determine MIME type from extension
    let mime_type = match safe_name.rsplit('.').next() {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        _ => "application/octet-stream",
    };

    // Use modern base64 API (0.22+)
    use base64::Engine;
    let base64_data = base64::engine::general_purpose::STANDARD.encode(&data);
    let data_url = format!("data:{};base64,{}", mime_type, base64_data);

    info!("[cmd] load_manager_avatar: loaded {} bytes", data.len());
    Ok(data_url)
}

/// Validated input for updating manager profile fields.
#[derive(Debug, validator::Validate)]
struct ManagerProfileInput {
    #[validate(length(max = 30))]
    nickname: Option<String>,
    #[validate(length(max = 30))]
    first_name: Option<String>,
    #[validate(length(max = 30))]
    last_name: Option<String>,
    #[validate(custom(function = "validate_date_format"))]
    dob: Option<String>,
    #[validate(length(max = 3))]
    nationality: Option<String>,
    avatar_path: Option<String>,
}

fn validate_date_format(date: &str) -> Result<(), validator::ValidationError> {
    if chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d").is_ok() {
        Ok(())
    } else {
        Err(validator::ValidationError::new("invalid_date_format"))
    }
}

/// Update manager profile fields (nickname, name, dob, nationality, avatar)
#[tauri::command]
pub async fn update_manager_profile(
    state: State<'_, StateManager>,
    nickname: Option<String>,
    first_name: Option<String>,
    last_name: Option<String>,
    dob: Option<String>,
    nationality: Option<String>,
    avatar_path: Option<String>,
) -> Result<(), AppError> {
    info!("[cmd] update_manager_profile");

    // Validate input
    let input = ManagerProfileInput {
        nickname: nickname.clone(),
        first_name: first_name.clone(),
        last_name: last_name.clone(),
        dob: dob.clone(),
        nationality: nationality.clone(),
        avatar_path: avatar_path.clone(),
    };
    input
        .validate()
        .map_err(|e| AppError::Validation(format!("Validation failed: {}", e)))?;

    let mut game = state
        .get_game(|g: &Game| g.clone())
        .ok_or(AppError::Session("No active game session".into()))?;

    // Update only the provided fields (not None)
    if let Some(nick) = nickname {
        let trimmed = nick.trim().to_string();
        if !trimmed.is_empty() {
            game.manager.nickname = trimmed;
        }
    }
    if let Some(first) = first_name {
        let trimmed = first.trim().to_string();
        if !trimmed.is_empty() {
            game.manager.first_name = trimmed;
        }
    }
    if let Some(last) = last_name {
        let trimmed = last.trim().to_string();
        if !trimmed.is_empty() {
            game.manager.last_name = trimmed;
        }
    }
    if let Some(date) = dob {
        // Already validated by validator custom function
        game.manager.date_of_birth = date;
    }
    if let Some(nat) = nationality {
        let trimmed = nat.trim().to_string();
        if !trimmed.is_empty() {
            game.manager.nationality = trimmed;
        }
    }
    if let Some(avatar) = avatar_path {
        game.manager.avatar_path = Some(avatar);
    }

    // Save the game state back
    state.set_game(game.clone());

    info!("[cmd] update_manager_profile: completed");
    Ok(())
}

#[cfg(test)]
mod player_age_tests {
    use super::*;

    #[test]
    fn calculates_age_against_game_date_not_system_date() {
        let birth_date = chrono::NaiveDate::from_ymd_opt(2000, 1, 2).unwrap();
        let game_date = chrono::NaiveDate::from_ymd_opt(2025, 1, 1).unwrap();

        assert_eq!(calculate_age_on_date(birth_date, game_date), 24);
    }

    #[test]
    fn increments_age_on_birthday() {
        let birth_date = chrono::NaiveDate::from_ymd_opt(2000, 1, 1).unwrap();
        let game_date = chrono::NaiveDate::from_ymd_opt(2025, 1, 1).unwrap();

        assert_eq!(calculate_age_on_date(birth_date, game_date), 25);
    }
}
