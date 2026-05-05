use serde::{Deserialize, Serialize};
#[cfg(feature = "typescript")]
use ts_rs::TS;

/// Aggregated stats for a champion across all matches.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct ChampionStatsSummary {
    pub champion_key: String,
    pub champion_name: String,

    // Volume
    pub total_games: u32,
    pub total_wins: u32,
    pub total_losses: u32,

    // Rates
    pub win_rate: f64,
    pub pick_rate: f64,
    pub ban_rate: f64,

    // Performance
    pub avg_kills: f64,
    pub avg_deaths: f64,
    pub avg_assists: f64,
    pub avg_kda: f64,
    pub avg_gold: f64,
    pub avg_damage: f64,
    pub avg_cs: f64,
    pub avg_vision: f64,
    pub avg_duration: f64,

    // Role distribution
    pub role_distribution: Vec<RolePopularity>,

    // Matchups
    pub best_against: Vec<ChampionMatchup>,
    pub worst_against: Vec<ChampionMatchup>,
    pub best_with: Vec<ChampionSynergy>,

    // Players
    pub top_players: Vec<ChampionTopPlayer>,
    pub most_played_players: Vec<ChampionTopPlayer>,

    // History
    pub weekly_history: Vec<WeeklyChampionStats>,
}

/// How often a champion is played in each role.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct RolePopularity {
    pub role: String,
    pub games: u32,
    pub percentage: f64,
}

/// Win rate against a specific opposing champion.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct ChampionMatchup {
    pub vs_champion_key: String,
    pub vs_champion_name: String,
    pub games: u32,
    pub wins: u32,
    pub win_rate: f64,
}

/// Win rate when paired with a specific allied champion.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct ChampionSynergy {
    pub with_champion_key: String,
    pub with_champion_name: String,
    pub games: u32,
    pub wins: u32,
    pub win_rate: f64,
}

/// Best-performing players on a champion.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct ChampionTopPlayer {
    pub player_id: String,
    pub player_name: String,
    pub team_name: String,
    pub games: u32,
    pub wins: u32,
    pub win_rate: f64,
    pub avg_kda: f64,
}

/// Per-week aggregated stats for history charts.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct WeeklyChampionStats {
    pub week_label: String,
    pub games: u32,
    pub wins: u32,
    pub win_rate: f64,
    pub avg_kda: f64,
    pub avg_damage: f64,
    pub avg_gold: f64,
}
