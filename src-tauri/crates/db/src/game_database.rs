use log::{debug, error, info, warn};
use rusqlite::Connection;
use std::path::{Path, PathBuf};

use crate::migrations::{MIGRATION_COUNT, all_migrations, ensure_compatible_schema};

/// Represents an open per-save game database with migrations applied.
pub struct GameDatabase {
    conn: Connection,
    path: Option<PathBuf>,
    /// Flag to track if champions table has been loaded/seeded.
    /// This prevents repeated seeding attempts on old saves.
    champions_loaded: bool,
}

impl GameDatabase {
    /// Open (or create) a game database at the given path and apply all migrations.
    pub fn open(path: &Path) -> Result<Self, String> {
        debug!("[game_db] opening database at {:?}", path);
        let mut conn = Connection::open(path).map_err(|e| {
            error!("[game_db] failed to open database at {:?}: {}", path, e);
            format!("Failed to open database: {}", e)
        })?;

        let migrations = all_migrations();
        migrations.to_latest(&mut conn).map_err(|e| {
            error!("[game_db] migration failed for {:?}: {}", path, e);
            format!("Database migration failed: {}", e)
        })?;

        ensure_compatible_schema(&conn).map_err(|e| {
            error!(
                "[game_db] compatibility schema repair failed for {:?}: {}",
                path, e
            );
            format!("Database compatibility repair failed: {}", e)
        })?;

        info!("[game_db] database ready at {:?}", path);
        Ok(Self {
            conn,
            path: Some(path.to_path_buf()),
            champions_loaded: false,
        })
    }

    /// Create an in-memory game database (useful for tests and pre-save state).
    pub fn open_in_memory() -> Result<Self, String> {
        debug!("[game_db] opening in-memory database");
        let mut conn = Connection::open_in_memory().map_err(|e| {
            error!("[game_db] failed to open in-memory database: {}", e);
            format!("Failed to open in-memory database: {}", e)
        })?;

        let migrations = all_migrations();
        migrations.to_latest(&mut conn).map_err(|e| {
            error!("[game_db] migration failed for in-memory db: {}", e);
            format!("Database migration failed: {}", e)
        })?;

        ensure_compatible_schema(&conn).map_err(|e| {
            error!(
                "[game_db] compatibility schema repair failed for in-memory db: {}",
                e
            );
            format!("Database compatibility repair failed: {}", e)
        })?;

        Ok(Self {
            conn,
            path: None,
            champions_loaded: false,
        })
    }

    /// Get a reference to the underlying connection (for repositories).
    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    /// Get the file path, if this is a file-backed database.
    pub fn path(&self) -> Option<&Path> {
        self.path.as_deref()
    }

    /// Get the current schema version (number of applied migrations).
    pub fn schema_version(&self) -> Result<i64, String> {
        self.conn
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .map_err(|e| format!("Failed to read schema version: {}", e))
    }

    /// Validate that the database has the expected schema version.
    /// Returns Ok(true) if valid, Ok(false) if version mismatch.
    pub fn validate_schema(&self) -> Result<bool, String> {
        let migrations = all_migrations();
        let current: usize = migrations
            .current_version(&self.conn)
            .map_err(|e| format!("Failed to get current version: {}", e))?
            .into();
        // We expect the version to equal the number of migrations (1 for V1)
        let expected = MIGRATION_COUNT;
        Ok(current == expected)
    }

    /// Ensure the champions table exists and is seeded.
    /// This is idempotent — safe to call multiple times.
    /// For OLD saves (pre-champions feature), the table won't exist and will be created + seeded.
    /// For NEW saves, the table exists via migration and this is a no-op.
    pub fn ensure_champions(&mut self) -> Result<(), String> {
        debug!("[game_db] ensure_champions called");
        // Already loaded — skip
        if self.champions_loaded {
            debug!("[game_db] champions already loaded, skipping");
            return Ok(());
        }

        debug!("[game_db] checking if champions table exists");
        // Check if champions table exists
        let table_exists: bool = self
            .conn
            .query_row(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='champions'",
                [],
                |row| row.get::<_, String>(0).map(|_| true),
            )
            .unwrap_or(false);

        debug!("[game_db] champions table exists: {}", table_exists);

        if !table_exists {
            warn!("[game_db] champions table not found, creating and seeding...");
            // Execute the SQL schema
            let schema_sql = include_str!("sql/v030_champions_table.sql");
            self.conn.execute_batch(schema_sql).map_err(|e| {
                error!("[game_db] failed to create champions table: {}", e);
                format!("Failed to create champions table: {}", e)
            })?;
        }

        // Seed if table is empty (covers both new creation and V31 migration reset)
        let champ_count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM champions", [], |row| row.get(0))
            .unwrap_or(0);

        if champ_count == 0 {
            info!("[game_db] champions table is empty, seeding...");
            // Seed from embedded JSON
            let json_content = include_str!("../../../../data/draft/champions.json");
            match crate::repositories::champion_repo::seed_from_json(&self.conn, json_content) {
                Ok(count) => {
                    info!("[game_db] champions table seeded with {} champions", count);
                }
                Err(e) => {
                    error!("[game_db] failed to seed champions: {}", e);
                    return Err(format!("Failed to seed champions: {}", e));
                }
            }
        } else {
            debug!(
                "[game_db] champions table already exists with {} champions",
                champ_count
            );
        }

        debug!("[game_db] setting champions_loaded = true");
        self.champions_loaded = true;
        debug!("[game_db] ensure_champions returning Ok");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_open_in_memory() {
        let db = GameDatabase::open_in_memory().unwrap();
        assert!(db.path().is_none());
        assert_eq!(
            db.schema_version().unwrap(),
            crate::migrations::MIGRATION_COUNT as i64
        );
    }

    #[test]
    fn test_open_file_database() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test_game.db");

        let db = GameDatabase::open(&db_path).unwrap();
        assert_eq!(db.path().unwrap(), db_path);
        assert_eq!(
            db.schema_version().unwrap(),
            crate::migrations::MIGRATION_COUNT as i64
        );
        assert!(db.validate_schema().unwrap());
    }

    #[test]
    fn test_reopen_existing_database() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test_reopen.db");

        // Create and close
        {
            let db = GameDatabase::open(&db_path).unwrap();
            assert_eq!(
                db.schema_version().unwrap(),
                crate::migrations::MIGRATION_COUNT as i64
            );
        }

        // Reopen — migrations should be idempotent
        let db = GameDatabase::open(&db_path).unwrap();
        assert_eq!(
            db.schema_version().unwrap(),
            crate::migrations::MIGRATION_COUNT as i64
        );
        assert!(db.validate_schema().unwrap());
    }

    #[test]
    fn test_validate_schema_on_empty_db() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("empty.db");

        // Create a raw DB without migrations
        {
            let _conn = Connection::open(&db_path).unwrap();
        }

        // Opening via GameDatabase applies migrations, so it should be valid
        let db = GameDatabase::open(&db_path).unwrap();
        assert!(db.validate_schema().unwrap());
    }

    #[test]
    fn test_conn_is_usable() {
        let db = GameDatabase::open_in_memory().unwrap();
        // Verify we can query a table created by the migration
        let count: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM teams", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }
}
