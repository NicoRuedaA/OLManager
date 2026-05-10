use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub(super) struct Vec2 {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct RuntimeStats {
    pub blue: RuntimeTeamStats,
    pub red: RuntimeTeamStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct RuntimeTeamStats {
    pub kills: i64,
    pub towers: i64,
    pub dragons: i64,
    pub barons: i64,
    pub gold: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct RuntimeEvent {
    pub t: f64,
    pub text: String,
    #[serde(rename = "type")]
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct WardRuntime {
    pub id: String,
    pub team: String,
    pub owner_champion_id: String,
    pub pos: Vec2,
    pub expires_at: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct RuntimeSummonerSpellSlot {
    pub key: String,
    pub cd_until: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct RuntimeUltimateSlot {
    pub archetype: String,
    #[serde(default)]
    pub icon: String,
    pub cd_until: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LanerCombatStateRuntime {
    pub last_disengage_at: f64,
    pub reengage_at: f64,
    pub recent_trade_until: f64,
    pub last_ai_debug_at: f64,
}

impl Default for LanerCombatStateRuntime {
    fn default() -> Self {
        Self {
            last_disengage_at: -999.0,
            reengage_at: -999.0,
            recent_trade_until: -999.0,
            last_ai_debug_at: -999.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LolChampionCombatProfileInput {
    pub base_hp: f64,
    pub attack_type: String,
    pub attack_range: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LolChampionUltimateInput {
    pub archetype: String,
    #[serde(default)]
    pub icon: String,
}
