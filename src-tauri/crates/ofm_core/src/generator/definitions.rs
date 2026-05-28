use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::data::{NATIONALITY_POOLS, TEAM_TEMPLATES};

// ---------------------------------------------------------------------------
// Definition file types (JSON-serialisable)
// ---------------------------------------------------------------------------

/// Name pools definition file format.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NamesDefinition {
    #[serde(default)]
    pub version: u32,
    #[serde(default)]
    pub description: String,
    /// Keyed by ISO 3166-1 alpha-2 country code.
    pub pools: HashMap<String, NamePool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NamePool {
    pub first_names: Vec<String>,
    pub last_names: Vec<String>,
}

/// Team templates definition file format.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamsDefinition {
    #[serde(default)]
    pub version: u32,
    #[serde(default)]
    pub description: String,
    pub teams: Vec<TeamDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamDef {
    pub name: String,
    #[serde(default)]
    pub short_name: String,
    pub city: String,
    /// ISO 3166-1 alpha-2 country code.
    pub country: String,
    pub colors: TeamColorsDef,
    #[serde(default = "default_play_style")]
    pub play_style: String,
    #[serde(default)]
    pub stadium_name: String,
    #[serde(default)]
    pub reputation_range: Option<[u32; 2]>,
    #[serde(default)]
    pub finance_range: Option<[i64; 2]>,
}

fn default_play_style() -> String {
    "Balanced".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamColorsDef {
    pub primary: String,
    pub secondary: String,
}

/// Try to load a names definition from a file, returning None on any error.
pub fn load_names_definition(path: &std::path::Path) -> Option<NamesDefinition> {
    let contents = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&contents).ok()
}

/// Try to load a teams definition from a file, returning None on any error.
pub fn load_teams_definition(path: &std::path::Path) -> Option<TeamsDefinition> {
    let contents = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&contents).ok()
}

/// Build the hardcoded names definition as fallback.
pub(super) fn default_names_definition() -> NamesDefinition {
    let mut pools = HashMap::new();
    for entry in NATIONALITY_POOLS {
        pools.insert(
            entry.nationality.to_string(),
            NamePool {
                first_names: entry.first_names.iter().map(|s| s.to_string()).collect(),
                last_names: entry.last_names.iter().map(|s| s.to_string()).collect(),
            },
        );
    }
    NamesDefinition {
        version: 1,
        description: "Built-in default".to_string(),
        pools,
    }
}

/// Build the hardcoded teams definition as fallback.
pub(super) fn default_teams_definition() -> TeamsDefinition {
    TeamsDefinition {
        version: 1,
        description: "Built-in default".to_string(),
        teams: TEAM_TEMPLATES
            .iter()
            .map(|t| TeamDef {
                name: t.name.to_string(),
                short_name: t
                    .name
                    .split_whitespace()
                    .filter_map(|w| w.chars().next())
                    .collect::<String>()
                    .to_uppercase()
                    .chars()
                    .take(3)
                    .collect(),
                city: t.city.to_string(),
                country: t.country.to_string(),
                colors: TeamColorsDef {
                    primary: t.colors.0.to_string(),
                    secondary: t.colors.1.to_string(),
                },
                play_style: t.play_style.to_string(),
                stadium_name: format!("{} Arena", t.city),
                reputation_range: Some([300, 900]),
                finance_range: Some([500_000, 10_000_000]),
            })
            .collect(),
    }
}

/// Serialisable world database — can be saved to / loaded from JSON.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldData {
    pub name: String,
    pub description: String,
    pub teams: Vec<domain::team::Team>,
    pub players: Vec<domain::player::Player>,
    pub staff: Vec<domain::staff::Staff>,
}

// ---------------------------------------------------------------------------
// Competition / multi-league definition types
// ---------------------------------------------------------------------------

/// Top-level manifest for a single competition (league / tournament).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompetitionManifest {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub full_name: Option<String>,
    pub region: String,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub tier: Option<u8>,
    #[serde(default)]
    pub logo: Option<String>,
    pub schedule: ScheduleConfig,
    #[serde(default = "default_teams_file")]
    pub teams_file: String,
    #[serde(default = "default_players_file")]
    pub players_file: String,
    #[serde(default)]
    pub staff_file: Option<String>,
    #[serde(default)]
    pub championships_file: Option<String>,
    #[serde(default)]
    pub erls: Vec<String>,
}

fn default_teams_file() -> String {
    "teams.json".to_string()
}

fn default_players_file() -> String {
    "players.json".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleConfig {
    pub format: String,
    pub team_count: u32,
    pub splits: Vec<SplitConfig>,
    #[serde(default = "default_preseason_friendlies")]
    pub preseason_friendlies: u32,
}

fn default_preseason_friendlies() -> u32 {
    3
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitConfig {
    pub name: String,
    pub season_start: SeasonStart,
    #[serde(default)]
    pub superweek_offsets: Vec<i64>,
    #[serde(default = "default_best_of")]
    pub best_of: u32,
    #[serde(default)]
    pub playoffs: Option<PlayoffConfig>,
}

fn default_best_of() -> u32 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeasonStart {
    pub month: u32,
    pub day: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayoffConfig {
    pub format: String,
    pub teams: u32,
}

// ---------------------------------------------------------------------------
// Team / player / staff data file types (Flow C — per-competition JSON)
// ---------------------------------------------------------------------------

/// Wrapper for `data/teams/*.json` files.
/// Supports both the full `domain::team::Team` format (with `name`/`description`)
/// and the simplified format (with `competition_id`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamDataFile {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub competition_id: Option<String>,
    pub teams: Vec<domain::team::Team>,
}

/// Wrapper for `data/players/*.json` files.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerDataFile {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub competition_id: Option<String>,
    pub players: Vec<domain::player::Player>,
}

/// Wrapper for `data/staffs/free_agents.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StaffDataFile {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    pub staff: Vec<domain::staff::Staff>,
}

// ---------------------------------------------------------------------------
// League selection screen types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct LeagueSelectionData {
    pub competitions: Vec<CompetitionSummary>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CompetitionSummary {
    pub id: String,
    pub name: String,
    pub region: String,
    #[serde(default)]
    pub logo: Option<String>,
    pub tier: u8,
    pub team_count: u32,
    pub teams: Vec<TeamSummary>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TeamSummary {
    pub id: String,
    pub name: String,
    pub short_name: String,
    #[serde(default)]
    pub logo_url: Option<String>,
    pub country: String,
    #[serde(default)]
    pub ovr: Option<u8>,
}

// ---------------------------------------------------------------------------
// World database types
// ---------------------------------------------------------------------------

/// Lightweight metadata shown in the UI when listing available databases.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldDatabaseInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub team_count: usize,
    pub player_count: usize,
    /// "builtin" | "user"
    pub source: String,
    /// Filesystem path (empty for built-in random)
    pub path: String,
}
