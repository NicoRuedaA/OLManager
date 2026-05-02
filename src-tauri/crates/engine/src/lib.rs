// Pre-existing clippy warnings tracked in #92
#![allow(clippy::new_without_default, clippy::collapsible_if, clippy::useless_conversion)]

pub mod ai;
pub mod engine;
pub mod event;
pub mod live_match;
pub mod report;
pub(crate) mod shared;
pub mod types;

// Re-export key types for convenience
pub use engine::simulate_lol;
pub use event::{EventType, MatchEvent};
pub use live_match::LolRole;
pub use live_match::{
    LiveMatchState, MatchCommand, MatchPhase, MatchSnapshot, MinuteResult, SetPieceTakers,
    SubstitutionRecord,
};
pub use report::{
    KillDetail, MatchReport, MatchReportEndReason, PlayerMatchStats, TeamStats,
};
pub use types::{MatchConfig, PlayStyle, PlayerData, Side, TeamData, Zone};
