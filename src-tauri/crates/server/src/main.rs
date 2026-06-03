//! OLManager web server.
//!
//! Authenticated, Postgres-backed game API (Supabase). The pure engine
//! (ofm_core/engine/domain/db) runs server-side; each mutating request loads
//! the player's save blob, runs the command, and persists it back.
//!
//! Endpoints:
//!   GET    /health
//!   POST   /api/saves                  create a new game            [auth]
//!   GET    /api/saves                  list my saves                [auth]
//!   GET    /api/saves/{id}             load a save                  [auth]
//!   POST   /api/saves/{id}/select-team assemble world, pick team    [auth]
//!   POST   /api/saves/{id}/advance     advance one day              [auth]
//!   POST   /api/saves/{id}/cmd/{cmd}    dispatch a Tauri command     [auth]
//!   DELETE /api/saves/{id}             delete a save                [auth]
//!   POST   /api/admin/auto-import       sync OLMDBManager export     [auth]

use axum::{
    extract::{DefaultBodyLimit, Multipart, Path, State},
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

mod auth;
mod commands;
mod data;
mod import;
mod store;
mod time_blockers;

use auth::{AuthUser, HasVerifier, JwtVerifier};
use store::Store;

#[derive(Clone)]
struct AppState {
    store: Option<Store>,
    verifier: JwtVerifier,
}

impl HasVerifier for AppState {
    fn verifier(&self) -> &JwtVerifier {
        &self.verifier
    }
}

impl AppState {
    /// Resolve the store or return a 503 if persistence isn't configured.
    fn store(&self) -> Result<&Store, (StatusCode, Json<serde_json::Value>)> {
        self.store.as_ref().ok_or((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "error": "persistence not configured (set DATABASE_URL)" })),
        ))
    }
}

#[tokio::main]
async fn main() {
    let _ = dotenvy::dotenv();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tower_http=debug".into()),
        )
        .init();

    let jwks_url = std::env::var("SUPABASE_JWKS_URL").unwrap_or_else(|_| {
        let base = std::env::var("SUPABASE_URL").unwrap_or_default();
        format!("{base}/auth/v1/.well-known/jwks.json")
    });
    let verifier = JwtVerifier::new(jwks_url);

    let store = match std::env::var("DATABASE_URL") {
        Ok(url) if !url.is_empty() => match Store::connect(&url).await {
            Ok(s) => {
                tracing::info!("connected to Postgres");
                Some(s)
            }
            Err(e) => {
                tracing::error!("DATABASE_URL set but connection failed: {e}");
                None
            }
        },
        _ => {
            tracing::warn!("DATABASE_URL not set — /api/saves routes will return 503");
            None
        }
    };

    let state = AppState { store, verifier };

    import::run_startup_import().await;

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/me", get(me))
        .route("/api/saves", post(create_save).get(list_saves))
        .route("/api/saves/{id}", get(load_save).delete(delete_save))
        .route("/api/saves/{id}/select-team", post(select_team))
        .route("/api/saves/{id}/advance", post(advance))
        .route("/api/saves/{id}/cmd/{command}", post(dispatch_command))
        .route(
            "/api/admin/import-export",
            post(import_export).layer(DefaultBodyLimit::max(512 * 1024 * 1024)),
        )
        .route("/api/admin/auto-import", post(auto_import))
        .route("/api/admin/catalog-summary", get(catalog_summary))
        .route("/api/admin/catalog", get(catalog))
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

/// GET /api/me — echo the authenticated user id. Auth-only (no store);
/// useful to verify the JWT pipeline independently of the database.
async fn me(user: AuthUser) -> impl IntoResponse {
    Json(json!({ "user_id": user.user_id }))
}

/// POST /api/admin/import-export — upload an OLMDBManager export zip and
/// extract it into the server data dir + public photo dirs. Auth-required and
/// additionally gated by OLM_ALLOW_IMPORT (the extraction checks the flag).
async fn import_export(_user: AuthUser, mut multipart: Multipart) -> impl IntoResponse {
    let mut bytes: Option<Vec<u8>> = None;
    while let Ok(Some(field)) = multipart.next_field().await {
        if field.name() == Some("file") {
            match field.bytes().await {
                Ok(b) => bytes = Some(b.to_vec()),
                Err(e) => {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(json!({ "error": format!("read upload: {e}") })),
                    )
                        .into_response()
                }
            }
        }
    }

    let Some(bytes) = bytes else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "missing 'file' field with the export zip" })),
        )
            .into_response();
    };

    match import::import_zip(&bytes) {
        Ok(summary) => {
            tracing::info!(
                "import: {} data files, {} photos, {} skipped",
                summary.data_files,
                summary.photo_files,
                summary.skipped
            );
            (StatusCode::OK, Json(json!({ "summary": summary }))).into_response()
        }
        Err(e) => (StatusCode::BAD_REQUEST, Json(json!({ "error": e }))).into_response(),
    }
}

/// POST /api/admin/auto-import — download the configured public OLMDBManager
/// export URL (OLM_IMPORT_SOURCE) and extract it into data/public.
async fn auto_import(_user: AuthUser) -> impl IntoResponse {
    match import::import_configured_source().await {
        Ok(summary) => {
            tracing::info!(
                "auto import: {} data files, {} photos, {} players, {} teams, {} staff, {} skipped",
                summary.data_files,
                summary.photo_files,
                summary.player_count,
                summary.team_count,
                summary.staff_count,
                summary.skipped
            );
            (StatusCode::OK, Json(json!({ "summary": summary }))).into_response()
        }
        Err(e) => (StatusCode::BAD_REQUEST, Json(json!({ "error": e }))).into_response(),
    }
}

/// GET /api/admin/catalog-summary — count the current imported world data.
async fn catalog_summary(_user: AuthUser) -> impl IntoResponse {
    let summary = import::current_catalog_summary();
    (StatusCode::OK, Json(json!({ "summary": summary }))).into_response()
}

/// GET /api/admin/catalog — list the current imported world data.
async fn catalog(_user: AuthUser) -> impl IntoResponse {
    let catalog = import::current_catalog();
    (StatusCode::OK, Json(catalog)).into_response()
}

// ── helpers ─────────────────────────────────────────────────────────────

fn parse_save_id(id: &str) -> Result<Uuid, (StatusCode, Json<serde_json::Value>)> {
    Uuid::parse_str(id).map_err(|_| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "invalid save id" })),
        )
    })
}

fn err(status: StatusCode, msg: impl Into<String>) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(json!({ "error": msg.into() })))
}

// ── handlers ────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct CreateSaveRequest {
    first_name: String,
    last_name: String,
    #[serde(default)]
    nickname: Option<String>,
    date_of_birth: String,
    nationality: String,
    #[serde(default)]
    name: Option<String>,
}

/// POST /api/saves — create a lightweight game and persist it.
async fn create_save(
    State(state): State<AppState>,
    user: AuthUser,
    Json(req): Json<CreateSaveRequest>,
) -> impl IntoResponse {
    let store = match state.store() {
        Ok(s) => s,
        Err(e) => return e.into_response(),
    };

    let first_name = req.first_name.trim().to_string();
    let last_name = req.last_name.trim().to_string();
    if first_name.is_empty() || last_name.is_empty() {
        return err(
            StatusCode::BAD_REQUEST,
            "first_name and last_name are required",
        )
        .into_response();
    }

    let start_date = chrono::Utc.with_ymd_and_hms(2025, 1, 1, 0, 0, 0).unwrap();
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
    let game = Game::new(
        GameClock::new(start_date),
        manager,
        vec![],
        vec![],
        vec![],
        vec![],
    );
    let name = req.name.unwrap_or_else(|| "Career".to_string());

    match store.create(&user.user_id, &name, &game).await {
        Ok(id) => (StatusCode::CREATED, Json(json!({ "id": id, "game": game }))).into_response(),
        Err(e) => err(StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    }
}

/// GET /api/saves — list my saves.
async fn list_saves(State(state): State<AppState>, user: AuthUser) -> impl IntoResponse {
    let store = match state.store() {
        Ok(s) => s,
        Err(e) => return e.into_response(),
    };
    match store.list(&user.user_id).await {
        Ok(saves) => (StatusCode::OK, Json(json!({ "saves": saves }))).into_response(),
        Err(e) => err(StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    }
}

/// GET /api/saves/:id — load a save.
async fn load_save(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let store = match state.store() {
        Ok(s) => s,
        Err(e) => return e.into_response(),
    };
    let save_id = match parse_save_id(&id) {
        Ok(u) => u,
        Err(e) => return e.into_response(),
    };
    match store.load(&user.user_id, save_id).await {
        Ok(Some(game)) => (StatusCode::OK, Json(json!({ "id": id, "game": game }))).into_response(),
        Ok(None) => err(StatusCode::NOT_FOUND, "save not found").into_response(),
        Err(e) => err(StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    }
}

#[derive(Deserialize)]
struct SelectTeamRequest {
    team_id: String,
}

/// POST /api/saves/:id/select-team — assemble world, pick team, persist.
async fn select_team(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(req): Json<SelectTeamRequest>,
) -> impl IntoResponse {
    let store = match state.store() {
        Ok(s) => s,
        Err(e) => return e.into_response(),
    };
    let save_id = match parse_save_id(&id) {
        Ok(u) => u,
        Err(e) => return e.into_response(),
    };

    let mut game = match store.load(&user.user_id, save_id).await {
        Ok(Some(g)) => g,
        Ok(None) => return err(StatusCode::NOT_FOUND, "save not found").into_response(),
        Err(e) => return err(StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    };

    if let Err(e) = data::select_team(&mut game, &req.team_id) {
        return err(StatusCode::BAD_REQUEST, e).into_response();
    }
    match store.save(&user.user_id, save_id, &game).await {
        Ok(true) => (StatusCode::OK, Json(json!({ "id": id, "game": game }))).into_response(),
        Ok(false) => err(StatusCode::NOT_FOUND, "save not found").into_response(),
        Err(e) => err(StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    }
}

/// POST /api/saves/:id/advance — advance one day, persist.
async fn advance(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let store = match state.store() {
        Ok(s) => s,
        Err(e) => return e.into_response(),
    };
    let save_id = match parse_save_id(&id) {
        Ok(u) => u,
        Err(e) => return e.into_response(),
    };

    let mut game = match store.load(&user.user_id, save_id).await {
        Ok(Some(g)) => g,
        Ok(None) => return err(StatusCode::NOT_FOUND, "save not found").into_response(),
        Err(e) => return err(StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    };

    ofm_core::turn::process_day(&mut game);

    match store.save(&user.user_id, save_id, &game).await {
        Ok(true) => (StatusCode::OK, Json(json!({ "id": id, "game": game }))).into_response(),
        Ok(false) => err(StatusCode::NOT_FOUND, "save not found").into_response(),
        Err(e) => err(StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    }
}

/// POST /api/saves/:id/cmd/:command — generic web invoke bridge.
async fn dispatch_command(
    State(state): State<AppState>,
    user: AuthUser,
    Path((id, command)): Path<(String, String)>,
    Json(args): Json<serde_json::Value>,
) -> impl IntoResponse {
    let store = match state.store() {
        Ok(s) => s,
        Err(e) => return e.into_response(),
    };
    let save_id = match parse_save_id(&id) {
        Ok(u) => u,
        Err(e) => return e.into_response(),
    };

    let mut game = match store.load(&user.user_id, save_id).await {
        Ok(Some(g)) => g,
        Ok(None) => return err(StatusCode::NOT_FOUND, "save not found").into_response(),
        Err(e) => return err(StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    };

    let result = match commands::dispatch(&command, args, &mut game) {
        Ok(result) => result,
        Err(e) => return err(e.status, e.message).into_response(),
    };

    if result.persist {
        match store.save(&user.user_id, save_id, &game).await {
            Ok(true) => {}
            Ok(false) => return err(StatusCode::NOT_FOUND, "save not found").into_response(),
            Err(e) => return err(StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
        }
    }

    (StatusCode::OK, Json(result.value)).into_response()
}

/// DELETE /api/saves/:id — delete a save.
async fn delete_save(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let store = match state.store() {
        Ok(s) => s,
        Err(e) => return e.into_response(),
    };
    let save_id = match parse_save_id(&id) {
        Ok(u) => u,
        Err(e) => return e.into_response(),
    };
    match store.delete(&user.user_id, save_id).await {
        Ok(true) => (StatusCode::OK, Json(json!({ "deleted": id }))).into_response(),
        Ok(false) => err(StatusCode::NOT_FOUND, "save not found").into_response(),
        Err(e) => err(StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    }
}
