//! OLManager web server — Phase 0 spike.
//!
//! Proves the pure game engine (ofm_core/engine/domain/db) can run as an HTTP
//! service, decoupled from Tauri. For now it keeps games in an in-memory store
//! keyed by a generated id; persistence to Postgres comes in Phase 1.
//!
//! Endpoints:
//!   GET  /health             → liveness probe
//!   POST /api/games          → create a lightweight game (manager, empty world)
//!   GET  /api/games/:id       → fetch a game's serialized state

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::TimeZone;
use serde::Deserialize;
use serde_json::json;
use tower_http::cors::CorsLayer;
use uuid::Uuid;

use domain::manager::Manager;
use ofm_core::clock::GameClock;
use ofm_core::game::Game;

/// In-memory game store. Phase 1 replaces this with Postgres-backed,
/// per-user persistence. The shape (id → Game) stays the same.
#[derive(Clone, Default)]
struct AppState {
    games: Arc<Mutex<HashMap<String, Game>>>,
}

#[derive(Deserialize)]
struct NewGameRequest {
    first_name: String,
    last_name: String,
    #[serde(default)]
    nickname: Option<String>,
    /// YYYY-MM-DD
    date_of_birth: String,
    nationality: String,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tower_http=debug".into()),
        )
        .init();

    let state = AppState::default();

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/games", post(create_game))
        .route("/api/games/{id}", get(get_game))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = "0.0.0.0:3001";
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    tracing::info!("olmanager-server listening on http://{addr}");
    axum::serve(listener, app).await.unwrap();
}

async fn health() -> impl IntoResponse {
    Json(json!({ "status": "ok" }))
}

/// POST /api/games — create a lightweight game (manager only, empty world).
/// Mirrors `start_new_game_lightweight` from the Tauri command layer.
async fn create_game(
    State(state): State<AppState>,
    Json(req): Json<NewGameRequest>,
) -> impl IntoResponse {
    let first_name = req.first_name.trim().to_string();
    let last_name = req.last_name.trim().to_string();
    if first_name.is_empty() || last_name.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "first_name and last_name are required" })),
        )
            .into_response();
    }

    let start_date = chrono::Utc.with_ymd_and_hms(2025, 1, 1, 0, 0, 0).unwrap();
    let clock = GameClock::new(start_date);

    let mut manager = Manager::new(
        "mgr_user".to_string(),
        first_name,
        last_name,
        req.date_of_birth,
        req.nationality,
    );
    if let Some(nick) = req.nickname {
        manager.nickname = nick.trim().to_string();
    }

    let game = Game::new(clock, manager, vec![], vec![], vec![], vec![]);

    let id = Uuid::new_v4().to_string();
    state.games.lock().unwrap().insert(id.clone(), game.clone());

    tracing::info!("created game {id}");
    (StatusCode::CREATED, Json(json!({ "id": id, "game": game }))).into_response()
}

/// GET /api/games/:id — return a game's serialized state.
async fn get_game(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let games = state.games.lock().unwrap();
    match games.get(&id) {
        Some(game) => (StatusCode::OK, Json(json!({ "id": id, "game": game }))).into_response(),
        None => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "game not found" })),
        )
            .into_response(),
    }
}
