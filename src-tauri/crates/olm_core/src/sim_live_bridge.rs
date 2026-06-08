//! Protocol bridge for the live match simulation (WebSocket).
//!
//! Defines the message types used between frontend and server for
//! streaming live match ticks. The implementation of SimLiveSession
//! lives in `src-tauri/src/application/sim_live/` and will move here
//! in a future step.

// ─── Protocol types (JSON-serializable, no sim_live dependency) ─────

#[derive(serde::Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SimMessage {
    Init { request: serde_json::Value },
    Tick { request: serde_json::Value },
    Reset { request: serde_json::Value },
    Dispose { request: serde_json::Value },
    RunToCompletion { request: serde_json::Value },
    SkipToEnd { request: serde_json::Value },
}

#[derive(serde::Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SimResponse {
    State(serde_json::Value),
    Dispose(serde_json::Value),
    Complete(serde_json::Value),
    Error { message: String },
}
