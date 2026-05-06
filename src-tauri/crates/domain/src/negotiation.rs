use serde::{Deserialize, Serialize};
use std::collections::HashMap;
#[cfg(feature = "typescript")]
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
#[serde(rename_all = "snake_case")]
pub enum NegotiationMood {
    #[default]
    Calm,
    Firm,
    Tense,
    Positive,
    Guarded,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
#[serde(default)]
pub struct NegotiationFeedback {
    pub mood: NegotiationMood,
    pub headline_key: String,
    pub detail_key: Option<String>,
    pub tension: u8,
    pub patience: u8,
    pub round: u8,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub params: HashMap<String, String>,
}
