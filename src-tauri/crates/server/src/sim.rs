//! WebSocket endpoint for live match simulation.
//!
//! Each WebSocket connection gets its own `SimLiveStoreState` with a single
//! session. When the client disconnects, the store is dropped.

use axum::extract::ws::{Message, WebSocket};
use axum::extract::{Path, State, WebSocketUpgrade};
use axum::response::Response;
use futures::{SinkExt, StreamExt};
use olm_core::sim_live_bridge::{SimMessage, SimResponse};
use olm_core::sim_live::{
    dispose, init, reset, run_to_completion, skip_to_end, tick, SimLiveStoreState,
};

use crate::AppState;

pub async fn sim_handler(
    ws: WebSocketUpgrade,
    Path(_id): Path<String>,
    State(_state): State<AppState>,
) -> Response {
    ws.on_upgrade(move |socket| sim_session(socket))
}

async fn sim_session(socket: WebSocket) {
    let (mut sender, mut receiver) = socket.split();
    let mut store: Option<SimLiveStoreState> = None;

    while let Some(Ok(msg)) = receiver.next().await {
        let text = match msg {
            Message::Text(t) => t,
            Message::Close(_) => break,
            _ => continue,
        };

        let sim_msg: SimMessage = match serde_json::from_str(&text) {
            Ok(m) => m,
            Err(e) => {
                let err = SimResponse::Error { message: format!("Invalid message: {e}") };
                let _ = sender.send(Message::Text(serde_json::to_string(&err).unwrap_or_default().into())).await;
                continue;
            }
        };

        if store.is_none() {
            store = Some(SimLiveStoreState::default());
        }
        let s = store.as_ref().unwrap();

        let response: SimResponse = match sim_msg {
            SimMessage::Init { request } => {
                let req = serde_json::from_value(request);
                match req {
                    Ok(r) => match init(s, r) {
                        Ok(resp) => SimResponse::State(serde_json::to_value(resp).unwrap_or_default()),
                        Err(e) => SimResponse::Error { message: e },
                    },
                    Err(e) => SimResponse::Error { message: e.to_string() },
                }
            }
            SimMessage::Tick { request } => {
                let req = serde_json::from_value(request);
                match req {
                    Ok(r) => match tick(s, r) {
                        Ok(resp) => SimResponse::State(serde_json::to_value(resp).unwrap_or_default()),
                        Err(e) => SimResponse::Error { message: e },
                    },
                    Err(e) => SimResponse::Error { message: e.to_string() },
                }
            }
            SimMessage::Reset { request } => {
                let req = serde_json::from_value(request);
                match req {
                    Ok(r) => match reset(s, r) {
                        Ok(resp) => SimResponse::State(serde_json::to_value(resp).unwrap_or_default()),
                        Err(e) => SimResponse::Error { message: e },
                    },
                    Err(e) => SimResponse::Error { message: e.to_string() },
                }
            }
            SimMessage::Dispose { request } => {
                let req = serde_json::from_value(request);
                match req {
                    Ok(r) => {
                        let _ = dispose(s, r);
                        SimResponse::Dispose(serde_json::json!({ "disposed": true }))
                    }
                    Err(e) => SimResponse::Error { message: e.to_string() },
                }
            }
            SimMessage::RunToCompletion { request } => {
                let req = serde_json::from_value(request);
                match req {
                    Ok(r) => match run_to_completion(s, r) {
                        Ok(resp) => SimResponse::Complete(serde_json::to_value(resp).unwrap_or_default()),
                        Err(e) => SimResponse::Error { message: e },
                    },
                    Err(e) => SimResponse::Error { message: e.to_string() },
                }
            }
            SimMessage::SkipToEnd { request } => {
                let req = serde_json::from_value(request);
                match req {
                    Ok(r) => match skip_to_end(s, r) {
                        Ok(resp) => SimResponse::Complete(serde_json::to_value(resp).unwrap_or_default()),
                        Err(e) => SimResponse::Error { message: e },
                    },
                    Err(e) => SimResponse::Error { message: e.to_string() },
                }
            }
        };

        let payload = serde_json::to_string(&response).unwrap_or_default();
        if sender.send(Message::Text(payload.into())).await.is_err() {
            break;
        }
    }
}
