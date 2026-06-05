//! Postgres-backed save persistence (Supabase).
//!
//! A game is stored as a bincode blob in `saves.data` (bytea) — same format as
//! the desktop .olsave files. We use sqlx's runtime query API (not the
//! compile-time macros) so the crate builds without a live database connection.

use olm_core::game::Game;
use sqlx::postgres::{PgPool, PgPoolOptions};
use sqlx::Row;
use uuid::Uuid;

#[derive(Clone)]
pub struct Store {
    pool: PgPool,
}

/// A row in the saves list (without the heavy blob).
#[derive(serde::Serialize)]
pub struct SaveSummary {
    pub id: Uuid,
    pub name: String,
    pub manager: Option<String>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl Store {
    pub async fn connect(database_url: &str) -> Result<Self, String> {
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(database_url)
            .await
            .map_err(|e| format!("connect postgres: {e}"))?;
        Ok(Self { pool })
    }

    /// Create a new save for a user, returning its id.
    pub async fn create(
        &self,
        user_id: &str,
        name: &str,
        game: &Game,
    ) -> Result<Uuid, String> {
        let blob = bincode::serialize(game).map_err(|e| format!("serialize game: {e}"))?;
        let manager = game.manager.display_name();
        let uid = Uuid::parse_str(user_id).map_err(|e| format!("bad user id: {e}"))?;

        let row = sqlx::query(
            "insert into public.saves (user_id, name, manager, data)
             values ($1, $2, $3, $4) returning id",
        )
        .bind(uid)
        .bind(name)
        .bind(manager)
        .bind(blob)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("insert save: {e}"))?;

        Ok(row.get::<Uuid, _>("id"))
    }

    /// List a user's saves (no blob).
    pub async fn list(&self, user_id: &str) -> Result<Vec<SaveSummary>, String> {
        let uid = Uuid::parse_str(user_id).map_err(|e| format!("bad user id: {e}"))?;
        let rows = sqlx::query(
            "select id, name, manager, updated_at
             from public.saves where user_id = $1 order by updated_at desc",
        )
        .bind(uid)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("list saves: {e}"))?;

        Ok(rows
            .into_iter()
            .map(|r| SaveSummary {
                id: r.get("id"),
                name: r.get("name"),
                manager: r.get("manager"),
                updated_at: r.get("updated_at"),
            })
            .collect())
    }

    /// Load a save's game, enforcing ownership.
    pub async fn load(&self, user_id: &str, save_id: Uuid) -> Result<Option<Game>, String> {
        let uid = Uuid::parse_str(user_id).map_err(|e| format!("bad user id: {e}"))?;
        let row = sqlx::query("select data from public.saves where id = $1 and user_id = $2")
            .bind(save_id)
            .bind(uid)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| format!("load save: {e}"))?;

        match row {
            None => Ok(None),
            Some(r) => {
                let blob: Vec<u8> = r.get("data");
                let game: Game =
                    bincode::deserialize(&blob).map_err(|e| format!("deserialize game: {e}"))?;
                Ok(Some(game))
            }
        }
    }

    /// Persist an updated game, enforcing ownership. Returns false if the save
    /// doesn't exist or isn't the user's.
    pub async fn save(&self, user_id: &str, save_id: Uuid, game: &Game) -> Result<bool, String> {
        let uid = Uuid::parse_str(user_id).map_err(|e| format!("bad user id: {e}"))?;
        let blob = bincode::serialize(game).map_err(|e| format!("serialize game: {e}"))?;
        let manager = game.manager.display_name();

        let result = sqlx::query(
            "update public.saves set data = $1, manager = $2 where id = $3 and user_id = $4",
        )
        .bind(blob)
        .bind(manager)
        .bind(save_id)
        .bind(uid)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("update save: {e}"))?;

        Ok(result.rows_affected() > 0)
    }

    /// Delete a save, enforcing ownership.
    pub async fn delete(&self, user_id: &str, save_id: Uuid) -> Result<bool, String> {
        let uid = Uuid::parse_str(user_id).map_err(|e| format!("bad user id: {e}"))?;
        let result = sqlx::query("delete from public.saves where id = $1 and user_id = $2")
            .bind(save_id)
            .bind(uid)
            .execute(&self.pool)
            .await
            .map_err(|e| format!("delete save: {e}"))?;
        Ok(result.rows_affected() > 0)
    }
}

