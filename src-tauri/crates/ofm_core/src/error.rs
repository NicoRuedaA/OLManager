//! Error types for multiplayer mode

use thiserror::Error;

/// Errors specific to multiplayer mode
#[derive(Debug, Error)]
pub enum MultiplayerError {
    /// The player context is invalid for this operation
    #[error("Invalid player context: {0}")]
    InvalidPlayerContext(String),

    /// Operation not allowed in multiplayer mode
    #[error("Operation not allowed in multiplayer mode: {0}")]
    OperationNotAllowedInMultiplayer(String),

    /// PvP match sync required - host must simulate
    #[error("PvP match sync required: host must simulate the match")]
    PvPSyncRequired,

    /// Player not found in multiplayer session
    #[error("Player not found: {0}")]
    PlayerNotFound(String),

    /// Cannot modify opponent's team
    #[error("Cannot modify opponent's team")]
    CannotModifyOpponentTeam,

    /// Game is not in multiplayer mode
    #[error("Game is not in multiplayer mode")]
    NotMultiplayerMode,
}

impl From<MultiplayerError> for String {
    fn from(err: MultiplayerError) -> String {
        err.to_string()
    }
}
