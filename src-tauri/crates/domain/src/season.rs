use serde::{Deserialize, Serialize};
#[cfg(feature = "typescript")]
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub enum SeasonPhase {
    #[default]
    Preseason,
    InSeason,
    PostSeason,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub enum TransferWindowStatus {
    #[default]
    Closed,
    Open,
    DeadlineDay,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
#[serde(default)]
pub struct TransferWindowContext {
    pub status: TransferWindowStatus,
    pub opens_on: Option<String>,
    pub closes_on: Option<String>,
    pub days_until_opens: Option<i64>,
    pub days_remaining: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
#[serde(default)]
pub struct SeasonContext {
    pub phase: SeasonPhase,
    pub season_start: Option<String>,
    pub season_end: Option<String>,
    pub days_until_season_start: Option<i64>,
    pub transfer_window: TransferWindowContext,
}
