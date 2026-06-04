use serde::{Deserialize, Serialize};
#[cfg(feature = "typescript")]
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct IncludedPlayerEntry {
    pub player_id: String,
    #[serde(default)]
    pub player_name: String,
    #[serde(default)]
    pub player_ovr: u8,
    #[serde(default)]
    pub player_position: String,
    #[serde(default)]
    pub player_profile_image_url: Option<String>,
    #[serde(default)]
    pub valuation: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct TransferHistoryEntry {
    pub id: String,
    pub player_id: String,
    #[serde(default)]
    pub player_name: String,
    #[serde(default)]
    pub player_ovr: u8,
    #[serde(default)]
    pub player_position: String,
    #[serde(default)]
    pub player_profile_image_url: Option<String>,
    #[serde(default)]
    pub from_team_id: String,
    #[serde(default)]
    pub from_team_name: String,
    #[serde(default)]
    pub to_team_id: String,
    #[serde(default)]
    pub to_team_name: String,
    #[serde(default)]
    pub fee: u64,
    #[serde(default)]
    pub annual_wage: u32,
    #[serde(default)]
    pub contract_years: u8,
    #[serde(default)]
    pub date: String,
    #[serde(default)]
    pub is_user_involved: bool,
    #[serde(default)]
    pub is_user_buying: bool,
    #[serde(default)]
    pub was_negotiated: bool,
    #[serde(default)]
    pub initial_offer_fee: Option<u64>,
    #[serde(default)]
    pub negotiation_rounds: u8,
    #[serde(default)]
    pub included_players: Vec<IncludedPlayerEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub struct TransferHistory {
    pub entries: Vec<TransferHistoryEntry>,
}

impl Default for TransferHistory {
    fn default() -> Self {
        Self {
            entries: Vec::new(),
        }
    }
}
