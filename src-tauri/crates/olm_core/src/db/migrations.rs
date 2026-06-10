use rusqlite::{Connection, Transaction};
use rusqlite_migration::{HookResult, M, Migrations};

fn column_exists(tx: &Transaction<'_>, table: &str, column: &str) -> rusqlite::Result<bool> {
    let mut stmt = tx.prepare(&format!("PRAGMA table_info({table})"))?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let name: String = row.get(1)?;
        if name == column {
            return Ok(true);
        }
    }
    Ok(false)
}

fn add_column_if_missing(
    tx: &Transaction<'_>,
    table: &str,
    column: &str,
    definition: &str,
) -> rusqlite::Result<()> {
    if !column_exists(tx, table, column)? {
        tx.execute(
            &format!("ALTER TABLE {table} ADD COLUMN {column} {definition}"),
            [],
        )?;
    }
    Ok(())
}

fn migrate_profile_image_urls(tx: &Transaction<'_>) -> HookResult {
    add_column_if_missing(tx, "players", "profile_image_url", "TEXT")?;
    add_column_if_missing(tx, "staff", "profile_image_url", "TEXT")?;
    Ok(())
}

fn migrate_manager_avatar_path(tx: &Transaction<'_>) -> HookResult {
    add_column_if_missing(tx, "managers", "avatar_path", "TEXT")?;
    Ok(())
}

fn migrate_stadium_to_arena(tx: &Transaction<'_>) -> HookResult {
    add_column_if_missing(tx, "teams", "stadium_name", "TEXT")?;
    // Only migrate data if the legacy column exists (old save files)
    if column_exists(tx, "teams", "stadium_name")? {
        tx.execute(
            "UPDATE teams SET stadium_name = COALESCE(stadium_name, 'Unknown Arena') WHERE stadium_name IS NULL",
            [],
        )?;
    }
    Ok(())
}

fn migrate_stadium_to_arena_capacity(tx: &Transaction<'_>) -> HookResult {
    add_column_if_missing(tx, "teams", "stadium_capacity", "INTEGER")?;
    // Only migrate data if the legacy column exists (old save files)
    if column_exists(tx, "teams", "stadium_capacity")? {
        tx.execute(
            "UPDATE teams SET stadium_capacity = COALESCE(stadium_capacity, 0) WHERE stadium_capacity IS NULL",
            [],
        )?;
    }
    Ok(())
}

/// V39 hook: drop football_nation column from players, managers, staff (legacy).
/// First ensures all required columns exist via add_column_if_missing,
/// then recreates each table via CREATE TABLE AS (SQLite lacks DROP COLUMN).
fn migrate_drop_football_nation(tx: &Transaction<'_>) -> HookResult {
    // Add missing columns (safe: no-op if already present)
    add_column_if_missing(
        tx,
        "players",
        "nationality_code",
        "TEXT NOT NULL DEFAULT ''",
    )?;
    add_column_if_missing(tx, "players", "competitive_region", "TEXT")?;
    add_column_if_missing(tx, "players", "profile_image_url", "TEXT")?;
    add_column_if_missing(
        tx,
        "managers",
        "nationality_code",
        "TEXT NOT NULL DEFAULT ''",
    )?;
    add_column_if_missing(tx, "managers", "competitive_region", "TEXT")?;
    add_column_if_missing(tx, "managers", "avatar_path", "TEXT")?;
    add_column_if_missing(tx, "staff", "nationality_code", "TEXT NOT NULL DEFAULT ''")?;
    add_column_if_missing(tx, "staff", "competitive_region", "TEXT")?;
    add_column_if_missing(tx, "staff", "profile_image_url", "TEXT")?;

    // Execute the table recreation SQL
    tx.execute_batch(include_str!("sql/v039_drop_football_nation.sql"))?;

    log::info!("[migration] V39: removed football_nation from players, managers, staff");
    Ok(())
}

/// V40 hook: audit legacy columns in teams table and log findings.
/// This is a non-destructive audit — columns are NOT removed yet.
/// If the audit shows all defaults, columns can be removed in a future migration.
fn migrate_audit_teams_legacy(tx: &Transaction<'_>) -> HookResult {
    let non_default: i64 = tx.query_row(
        "SELECT COUNT(*) FROM teams WHERE wage_budget != 0 OR transfer_budget != 0 OR season_income != 0 OR season_expenses != 0",
        [],
        |row| row.get(0),
    )?;

    if non_default > 0 {
        log::info!(
            "[migration] V40 audit: {} teams use legacy columns — deferring cleanup",
            non_default
        );
    } else {
        log::info!("[migration] V40 audit: no teams use legacy columns — safe to remove");
    }
    Ok(())
}

/// V42 pre-hook: normalize teams schema so the rebuild SQL can run on
/// very old/branch-divergent saves that still use stadium_* names.
fn migrate_prepare_teams_for_v42(tx: &Transaction<'_>) -> HookResult {
    add_column_if_missing(tx, "teams", "stadium_name", "TEXT")?;
    add_column_if_missing(tx, "teams", "stadium_capacity", "INTEGER")?;
    add_column_if_missing(
        tx,
        "teams",
        "team_roles",
        "TEXT NOT NULL DEFAULT '{\"captain\":null,\"shotcaller\":null}'",
    )?;

    if column_exists(tx, "teams", "stadium_name")? {
        tx.execute(
            "UPDATE teams SET stadium_name = COALESCE(stadium_name, stadium_name, 'Unknown Arena')",
            [],
        )?;
    } else {
        tx.execute(
            "UPDATE teams SET stadium_name = COALESCE(stadium_name, 'Unknown Arena')",
            [],
        )?;
    }

    if column_exists(tx, "teams", "stadium_capacity")? {
        tx.execute(
            "UPDATE teams SET stadium_capacity = COALESCE(stadium_capacity, stadium_capacity, 0)",
            [],
        )?;
    } else {
        tx.execute(
            "UPDATE teams SET stadium_capacity = COALESCE(stadium_capacity, 0)",
            [],
        )?;
    }

    tx.execute(
        "UPDATE teams SET team_roles = COALESCE(team_roles, '{\"captain\":null,\"shotcaller\":null}')",
        [],
    )?;

    Ok(())
}

/// V42 hook: pre-normalize legacy columns and then execute the table rebuild SQL.
fn migrate_v42_drop_dead_team_columns(tx: &Transaction<'_>) -> HookResult {
    migrate_prepare_teams_for_v42(tx)?;
    tx.execute_batch(include_str!("sql/v042_drop_dead_team_columns.sql"))?;
    Ok(())
}

fn migrate_day_phase(tx: &Transaction<'_>) -> HookResult {
    add_column_if_missing(
        tx,
        "game_meta",
        "day_phase",
        "TEXT NOT NULL DEFAULT 'Morning'",
    )?;
    Ok(())
}

fn migrate_scrim_reports(tx: &Transaction<'_>) -> HookResult {
    add_column_if_missing(tx, "teams", "scrim_reports", "TEXT NOT NULL DEFAULT '[]'")?;
    Ok(())
}

fn migrate_scrim_weekly_objective(tx: &Transaction<'_>) -> HookResult {
    add_column_if_missing(tx, "teams", "scrim_weekly_objective", "TEXT")?;
    Ok(())
}

fn migrate_scrim_setup_lock_week_key(tx: &Transaction<'_>) -> HookResult {
    add_column_if_missing(tx, "teams", "scrim_setup_locked_week_key", "TEXT")?;
    Ok(())
}

fn migrate_social_post_media_url(tx: &Transaction<'_>) -> HookResult {
    add_column_if_missing(tx, "social_posts", "media_url", "TEXT")?;
    Ok(())
}

fn migrate_team_logo_url(tx: &Transaction<'_>) -> HookResult {
    add_column_if_missing(tx, "teams", "logo_url", "TEXT")?;
    add_column_if_missing(tx, "teams", "competition_id", "TEXT")?;
    Ok(())
}

fn migrate_missing_scrim_columns(tx: &Transaction<'_>) -> HookResult {
    add_column_if_missing(
        tx,
        "teams",
        "weekly_scrim_plan_team_ids",
        "TEXT NOT NULL DEFAULT '[]'",
    )?;
    add_column_if_missing(
        tx,
        "teams",
        "scrim_weekly_slots",
        "INTEGER NOT NULL DEFAULT 0",
    )?;
    add_column_if_missing(
        tx,
        "teams",
        "scrim_reputation",
        "INTEGER NOT NULL DEFAULT 50",
    )?;
    add_column_if_missing(
        tx,
        "teams",
        "scrim_weekly_cancellations",
        "INTEGER NOT NULL DEFAULT 0",
    )?;
    Ok(())
}

fn connection_column_exists(
    conn: &Connection,
    table: &str,
    column: &str,
) -> rusqlite::Result<bool> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let name: String = row.get(1)?;
        if name == column {
            return Ok(true);
        }
    }
    Ok(false)
}

fn connection_add_column_if_missing(
    conn: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> rusqlite::Result<()> {
    if !connection_column_exists(conn, table, column)? {
        conn.execute(
            &format!("ALTER TABLE {table} ADD COLUMN {column} {definition}"),
            [],
        )?;
    }
    Ok(())
}

pub fn ensure_compatible_schema(conn: &Connection) -> rusqlite::Result<()> {
    // Ensure competitions table exists (V52 was a no-op before the real migration was registered)
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS competitions (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            full_name       TEXT,
            region          TEXT NOT NULL DEFAULT '',
            country         TEXT,
            tier            INTEGER NOT NULL DEFAULT 1,
            logo            TEXT,
            teams_file      TEXT NOT NULL DEFAULT '',
            players_file    TEXT NOT NULL DEFAULT '',
            schedule_config TEXT,
            created_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS seasons (
            id              TEXT PRIMARY KEY,
            competition_id  TEXT NOT NULL DEFAULT '',
            season_number   INTEGER NOT NULL,
            phase           TEXT NOT NULL DEFAULT 'Regular',
            created_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );"
    )?;
    // Add competition_id column if missing, then create indexes
    connection_add_column_if_missing(conn, "fixtures", "competition_id", "TEXT NOT NULL DEFAULT ''")?;
    connection_add_column_if_missing(conn, "standings", "competition_id", "TEXT NOT NULL DEFAULT ''")?;
    if connection_column_exists(conn, "fixtures", "competition_id")? {
        conn.execute_batch(
            "CREATE INDEX IF NOT EXISTS idx_fixtures_competition_id ON fixtures(competition_id);
             CREATE INDEX IF NOT EXISTS idx_standings_competition_id ON standings(competition_id);"
        )?;
    }
    if connection_column_exists(conn, "seasons", "competition_id")? {
        conn.execute("CREATE INDEX IF NOT EXISTS idx_seasons_competition_id ON seasons(competition_id)", [])?;
    }
    connection_add_column_if_missing(conn, "managers", "avatar_path", "TEXT")?;
    connection_add_column_if_missing(conn, "players", "profile_image_url", "TEXT")?;
    connection_add_column_if_missing(conn, "staff", "profile_image_url", "TEXT")?;
    connection_add_column_if_missing(
        conn,
        "teams",
        "weekly_scrim_plan_team_ids",
        "TEXT NOT NULL DEFAULT '[]'",
    )?;
    connection_add_column_if_missing(conn, "teams", "scrim_weekly_objective", "TEXT")?;
    connection_add_column_if_missing(conn, "teams", "scrim_setup_locked_week_key", "TEXT")?;
    connection_add_column_if_missing(
        conn,
        "teams",
        "scrim_weekly_slots",
        "INTEGER NOT NULL DEFAULT 0",
    )?;
    connection_add_column_if_missing(
        conn,
        "teams",
        "scrim_reputation",
        "INTEGER NOT NULL DEFAULT 50",
    )?;
    connection_add_column_if_missing(
        conn,
        "teams",
        "scrim_weekly_cancellations",
        "INTEGER NOT NULL DEFAULT 0",
    )?;
    connection_add_column_if_missing(conn, "teams", "scrim_reports", "TEXT NOT NULL DEFAULT '[]'")?;
    connection_add_column_if_missing(
        conn,
        "game_meta",
        "day_phase",
        "TEXT NOT NULL DEFAULT 'Morning'",
    )?;
    Ok(())
}

/// Number of migrations defined. Keep in sync with the vec in `all_migrations`.
pub const MIGRATION_COUNT: usize = 59;

/// All migrations for a per-save game database.
/// Each save `.db` file gets this schema applied via `rusqlite_migration`.
pub fn all_migrations() -> Migrations<'static> {
    Migrations::new(vec![
        // V1: Initial schema — all game entity tables
        M::up(include_str!("sql/v001_initial_schema.sql")),
        // V2: Training groups per team
        M::up(include_str!("sql/v002_training_groups.sql")),
        // V3: Alternate positions per player
        M::up(include_str!("sql/v003_alternate_positions.sql")),
        // V4: Natural/preferred position per player
        M::up(include_str!("sql/v004_natural_position.sql")),
        // V5: Per-player training focus override
        M::up(include_str!("sql/v005_player_training_focus.sql")),
        // V6: Team match roles defaults
        M::up(include_str!("sql/v006_team_match_roles.sql")),
        // V7: Team financial ledger
        M::up(include_str!("sql/v007_team_financial_ledger.sql")),
        // V8: Team sponsorship state
        M::up(include_str!("sql/v008_team_sponsorship.sql")),
        // V9: Team facilities state
        M::up(include_str!("sql/v009_team_facilities.sql")),
        // V10: Hidden per-player morale architecture state
        M::up(include_str!("sql/v010_player_morale_core.sql")),
        // V11: Player footedness identity fields
        M::up(include_str!("sql/v011_player_footedness.sql")),
        // V12: Fixture competition metadata
        M::up(include_str!("sql/v012_fixture_competition.sql")),
        // V13: Player long-term fitness value
        M::up(include_str!("sql/v013_player_fitness.sql")),
        // V14: Legacy: explicit national identity fields for teams and people
        M::up(include_str!("sql/v014_football_identity.sql")),
        // V15: Historical player and team match stats
        M::up(include_str!("sql/v015_match_stats_history.sql")),
        // V16: Manager board-warning stage tracking (per-club, resets on hire)
        M::up(include_str!("sql/v016_manager_warning_stage.sql")),
        // V17: Manager nickname support (LoL-style handle)
        M::up(include_str!("sql/v017_manager_nickname.sql")),
        // V18: Champion id per player match stats row
        M::up(include_str!("sql/v018_player_match_champion_id.sql")),
        // V19: Champion win/loss per player match stats row
        M::up(include_str!("sql/v019_player_match_champion_win.sql")),
        // V20: LoL-first stats columns with explicit legacy bridge
        M::up(include_str!("sql/v020_lol_stats_schema.sql")),
        // V21: Pure LoL stats tables (primary path) + legacy import bridge
        M::up(include_str!("sql/v021_lol_pure_stats_tables.sql")),
        // V22: Player potential research tracking fields
        M::up(include_str!("sql/v022_player_potential_research.sql")),
        // V23: Weekly scrim planning state per team
        M::up(include_str!("sql/v023_team_weekly_scrims.sql")),
        // V24: Weekly scrim counters for staff summary
        M::up(include_str!("sql/v024_team_scrim_weekly_counters.sql")),
        // V25: Per-slot scrim simulation results for UI timeline
        M::up(include_str!("sql/v025_team_scrim_slot_results.sql")),
        // V26: Fixture series length metadata (best-of)
        M::up(include_str!("sql/v026_fixture_best_of.sql")),
        // V27: Persist academy team kind, affiliation links, and ERL metadata
        M::up(include_str!("sql/v027_academy_team_metadata.sql")),
        // V28: Add avatar_path column to managers table (note: v028_avatar_path.sql
        // is an orphan file — the actual migration uses the hook below)
        M::up_with_hook("SELECT 1;", migrate_manager_avatar_path),
        // V29: Champion mastery + patch progression persistence
        M::up(include_str!("sql/v028_champion_progression_state.sql")),
        // V30: Optional unified profile image URLs for players and staff
        M::up_with_hook("SELECT 1;", migrate_profile_image_urls),
        // V30 (second): Champions table for LoL champion data
        M::up(include_str!("sql/v030_champions_table.sql")),
        // V31: Fix champion seed data
        M::up(include_str!("sql/v031_fix_champion_seed.sql")),
        // V32: Fix champion names
        M::up(include_str!("sql/v032_fix_champion_names.sql")),
        // V33: Add profile_image_url to players (no-op: already handled by V29 hook)
        M::up("SELECT 1;"),
        // V34: Add profile_image_url to staff (no-op: already handled by V29 hook)
        M::up("SELECT 1;"),
        // V35: Rename stadium_name to stadium_name for LoL terminology
        M::up_with_hook("SELECT 1;", migrate_stadium_to_arena),
        // V36: Rename stadium_capacity to stadium_capacity for LoL terminology
        M::up_with_hook("SELECT 1;", migrate_stadium_to_arena_capacity),
        // V37: Rename legacy stat tables to _deprecated_ prefix
        M::up(include_str!("sql/v037_rename_legacy_stats.sql")),
        // V38: Drop deprecated legacy stat tables
        M::up(include_str!("sql/v038_drop_deprecated_stats.sql")),
        // V39: Remove football_nation column from players, managers, staff (legacy)
        // Recreates tables via CREATE TABLE AS (SQLite lacks DROP COLUMN)
        M::up_with_hook("SELECT 1;", migrate_drop_football_nation),
        // V40: Audit legacy columns in teams (non-destructive)
        M::up_with_hook("SELECT 1;", migrate_audit_teams_legacy),
        // V41: Add team_roles column (replaces match_roles)
        M::up(include_str!("sql/v041_team_roles.sql")),
        // V42: Drop dead columns from teams table (football_nation legacy, match_roles, nationality_code)
        M::up_with_hook("SELECT 1;", migrate_v42_drop_dead_team_columns),
        // V43: Add bans_json column to lol_player_match_stats for ban rate
        M::up(include_str!("sql/v043_add_bans_column.sql")),
        // V44: Persist day phase for phase-based advancement
        M::up_with_hook("SELECT 1;", migrate_day_phase),
        // V45: Enriched scrim reports for gameplay consequences
        M::up_with_hook("SELECT 1;", migrate_scrim_reports),
        // V46: Optional weekly scrim objective for planning intent
        M::up_with_hook("SELECT 1;", migrate_scrim_weekly_objective),
        // V47: Optional weekly setup lock marker key
        M::up_with_hook("SELECT 1;", migrate_scrim_setup_lock_week_key),
        // V48: Persist humorous social feed posts per save
        M::up(include_str!("sql/v035_social_posts.sql")),
        // V49: Add optional media URL to social posts
        M::up_with_hook("SELECT 1;", migrate_social_post_media_url),
        // V50: Persist social accounts and templates for editor workflows
        M::up(include_str!("sql/v036_social_registry.sql")),
        // V51: Add missing scrim columns to teams table (weekly_scrim_plan_team_ids, scrim_weekly_slots, scrim_reputation, scrim_weekly_cancellations)
        M::up_with_hook("SELECT 1;", migrate_missing_scrim_columns),
        // V52: Multi-competition schema — competitions, seasons tables + competition_id on fixtures/standings
        M::up(include_str!("sql/v052_multi_competitions.sql")),
        // V53: Drop formation column from teams table (formation no longer used)
        M::up(include_str!("sql/v053_remove_formation.sql")),
        // V54: Rename play_style column to draft_strategy
        M::up(include_str!("sql/v054_rename_play_style_to_draft_strategy.sql")),
        // V55: Add logo_url and competition_id to teams table
        M::up_with_hook("SELECT 1;", migrate_team_logo_url),
        // V55: Drop injury column from players table (football remnant)
        M::up(include_str!("sql/v055_remove_injury_column.sql")),
        // V44: Persist transfer history entries
        M::up(include_str!("sql/v044_transfer_history.sql")),
        // V56: Add nickname column to staff (esports handle from import)
        M::up(include_str!("sql/v056_add_staff_nickname.sql")),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_migrations_are_valid() {
        let migrations = all_migrations();
        migrations.validate().expect("migrations should be valid");
    }

    #[test]
    fn test_apply_migrations_to_empty_db() {
        let mut conn = Connection::open_in_memory().unwrap();
        let migrations = all_migrations();
        migrations
            .to_latest(&mut conn)
            .expect("migrations should apply cleanly");

        // Verify all expected tables exist
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(
            tables.contains(&"game_meta".to_string()),
            "missing game_meta"
        );
        assert!(tables.contains(&"managers".to_string()), "missing managers");
        assert!(tables.contains(&"teams".to_string()), "missing teams");
        assert!(tables.contains(&"players".to_string()), "missing players");
        assert!(
            tables.contains(&"lol_player_match_stats".to_string()),
            "missing lol_player_match_stats"
        );
        assert!(tables.contains(&"staff".to_string()), "missing staff");
        assert!(
            tables.contains(&"lol_team_match_stats".to_string()),
            "missing lol_team_match_stats"
        );
        assert!(
            tables.contains(&"lol_team_match_stats".to_string()),
            "missing lol_team_match_stats"
        );
        assert!(tables.contains(&"league".to_string()), "missing league");
        assert!(tables.contains(&"fixtures".to_string()), "missing fixtures");
        assert!(
            tables.contains(&"standings".to_string()),
            "missing standings"
        );
        assert!(tables.contains(&"messages".to_string()), "missing messages");
        assert!(tables.contains(&"news".to_string()), "missing news");
        assert!(
            tables.contains(&"social_posts".to_string()),
            "missing social_posts"
        );
        assert!(
            tables.contains(&"social_accounts".to_string()),
            "missing social_accounts"
        );
        assert!(
            tables.contains(&"social_templates".to_string()),
            "missing social_templates"
        );
        assert!(
            tables.contains(&"board_objectives".to_string()),
            "missing board_objectives"
        );
        assert!(
            tables.contains(&"scouting_assignments".to_string()),
            "missing scouting_assignments"
        );
    }

    #[test]
    fn test_migrations_are_idempotent() {
        let mut conn = Connection::open_in_memory().unwrap();
        let migrations = all_migrations();
        migrations
            .to_latest(&mut conn)
            .expect("first apply should succeed");
        // Applying again should be a no-op (already at latest)
        migrations
            .to_latest(&mut conn)
            .expect("second apply should succeed (idempotent)");
    }

    #[test]
    fn test_schema_version_after_migration() {
        let mut conn = Connection::open_in_memory().unwrap();
        let migrations = all_migrations();
        migrations.to_latest(&mut conn).unwrap();

        let version: i64 = conn
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        // rusqlite_migration sets user_version to the number of applied migrations
        assert_eq!(
            version, MIGRATION_COUNT as i64,
            "expected schema version {} after migrations",
            MIGRATION_COUNT
        );
    }

    #[test]
    fn test_profile_image_url_migration_tolerates_existing_columns() {
        let mut conn = Connection::open_in_memory().unwrap();
        let migrations = all_migrations();
        // Apply up to V29 (index 28 = 29 migrations), BEFORE the profile_image_url hook at V30
        migrations
            .to_version(&mut conn, 29)
            .expect("migrations before profile image URLs should apply");

        // Manually add columns BEFORE running the V30 hook
        conn.execute("ALTER TABLE players ADD COLUMN profile_image_url TEXT", [])
            .unwrap();
        conn.execute("ALTER TABLE staff ADD COLUMN profile_image_url TEXT", [])
            .unwrap();

        // Apply remaining migrations (V30 onwards) — V30 hook uses add_column_if_missing
        migrations
            .to_latest(&mut conn)
            .expect("profile image URL migration should skip existing columns");
    }

    #[test]
    fn test_compatible_schema_repairs_missing_avatar_path() {
        let mut conn = Connection::open_in_memory().unwrap();
        let migrations = all_migrations();
        migrations
            .to_version(&mut conn, 27)
            .expect("migrations before avatar_path should apply");

        assert!(!connection_column_exists(&conn, "managers", "avatar_path").unwrap());
        ensure_compatible_schema(&conn).expect("compatibility repair should add avatar_path");
        assert!(connection_column_exists(&conn, "managers", "avatar_path").unwrap());
    }
}
