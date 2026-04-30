use chrono::Utc;
use domain::stats::StatsState;

use ofm_core::clock::GameClock;
use ofm_core::game::{BoardObjective, Game, ObjectiveType, ScoutingAssignment};

use crate::game_database::GameDatabase;
use crate::repositories::{
    league_repo, manager_repo, message_repo, meta_repo, news_repo, objective_repo, player_repo,
    scouting_repo, staff_repo, stats_repo, team_repo,
};

pub struct GamePersistenceWriter;

impl GamePersistenceWriter {
    pub fn write_game(
        db: &GameDatabase,
        game: &Game,
        save_id: &str,
        save_name: &str,
    ) -> Result<(), String> {
        let conn = db.conn();
        let now = Utc::now().to_rfc3339();

        meta_repo::upsert_meta(
            conn,
            &meta_repo::GameMeta {
                save_id: save_id.to_string(),
                save_name: save_name.to_string(),
                manager_id: game.manager.id.clone(),
                start_date: game.clock.start_date.to_rfc3339(),
                game_date: game.clock.current_date.to_rfc3339(),
                created_at: now.clone(),
                last_played_at: now,
                // Multiplayer fields
                player2_manager_id: game.player2_manager.as_ref().map(|m| m.id.clone()),
                multiplayer_mode: match game.multiplayer_mode {
                    ofm_core::game::MultiplayerMode::Hotseat => "hotseat".to_string(),
                    ofm_core::game::MultiplayerMode::Online => "online".to_string(),
                    _ => "offline".to_string(),
                },
                room_code: game.room_code.clone(),
            },
        )?;

        manager_repo::upsert_manager(conn, &game.manager)?;

        // Save player2_manager if exists
        if let Some(ref p2_mgr) = game.player2_manager {
            manager_repo::upsert_manager(conn, p2_mgr)?;
        }

        team_repo::upsert_teams(conn, &game.teams)?;
        player_repo::upsert_players(conn, &game.players)?;
        staff_repo::upsert_staff_list(conn, &game.staff)?;
        message_repo::upsert_messages(conn, &game.messages)?;
        news_repo::upsert_news_list(conn, &game.news)?;

        if let Some(ref league) = game.league {
            league_repo::upsert_league(conn, league)?;
        }

        let objective_rows: Vec<objective_repo::BoardObjectiveRow> = game
            .board_objectives
            .iter()
            .map(|objective| objective_repo::BoardObjectiveRow {
                id: objective.id.clone(),
                description: objective.description.clone(),
                target: objective.target,
                objective_type: format!("{:?}", objective.objective_type),
                met: objective.met,
            })
            .collect();
        objective_repo::upsert_objectives(conn, &objective_rows)?;

        let scouting_rows: Vec<scouting_repo::ScoutingAssignmentRow> = game
            .scouting_assignments
            .iter()
            .map(|assignment| scouting_repo::ScoutingAssignmentRow {
                id: assignment.id.clone(),
                scout_id: assignment.scout_id.clone(),
                player_id: assignment.player_id.clone(),
                days_remaining: assignment.days_remaining,
            })
            .collect();
        scouting_repo::upsert_scouting_list(conn, &scouting_rows)?;

        Ok(())
    }
}

impl GamePersistenceWriter {
    pub fn write_stats_state(db: &GameDatabase, stats: &StatsState) -> Result<(), String> {
        stats_repo::replace_stats_state(db.conn(), stats)
    }
}

pub struct GamePersistenceReader;

impl GamePersistenceReader {
    pub fn read_game(db: &GameDatabase) -> Result<Game, String> {
        let conn = db.conn();

        let meta = meta_repo::load_meta(conn)?
            .ok_or_else(|| "No game_meta found in database".to_string())?;

        let start_date = chrono::DateTime::parse_from_rfc3339(&meta.start_date)
            .map_err(|error| format!("Invalid start_date: {}", error))?
            .with_timezone(&Utc);
        let game_date = chrono::DateTime::parse_from_rfc3339(&meta.game_date)
            .map_err(|error| format!("Invalid game_date: {}", error))?
            .with_timezone(&Utc);

        let mut clock = GameClock::new(start_date);
        clock.current_date = game_date;

        let manager = manager_repo::load_manager(conn, &meta.manager_id)?
            .ok_or_else(|| format!("Manager '{}' not found", meta.manager_id))?;

        // Load player2_manager if exists
        let player2_manager = if let Some(p2_id) = &meta.player2_manager_id {
            manager_repo::load_manager(conn, p2_id)?
        } else {
            None
        };

        let teams = team_repo::load_all_teams(conn)?;
        let players = player_repo::load_all_players(conn)?;
        let staff = staff_repo::load_all_staff(conn)?;
        let messages = message_repo::load_all_messages(conn)?;
        let news = news_repo::load_all_news(conn)?;
        let league = league_repo::load_league(conn)?;

        let objective_rows = objective_repo::load_all_objectives(conn)?;
        let board_objectives: Vec<BoardObjective> = objective_rows
            .into_iter()
            .map(|objective| BoardObjective {
                id: objective.id,
                description: objective.description,
                target: objective.target,
                objective_type: parse_objective_type(&objective.objective_type),
                met: objective.met,
            })
            .collect();

        let scouting_rows = scouting_repo::load_all_scouting(conn)?;
        let scouting_assignments: Vec<ScoutingAssignment> = scouting_rows
            .into_iter()
            .map(|assignment| ScoutingAssignment {
                id: assignment.id,
                scout_id: assignment.scout_id,
                player_id: assignment.player_id,
                days_remaining: assignment.days_remaining,
            })
            .collect();

        let mut game = Game {
            clock,
            manager,
            teams,
            players,
            staff,
            messages,
            news,
            league,
            academy_league: None,
            scouting_assignments,
            board_objectives,
            season_context: domain::season::SeasonContext::default(),
            days_since_last_job_offer: None,
            champion_masteries: vec![],
            champion_patch: ofm_core::champions::ChampionPatchState::default(),
            // Multiplayer fields from meta
            player2_manager,
            multiplayer_mode: match meta.multiplayer_mode.as_str() {
                "hotseat" => ofm_core::game::MultiplayerMode::Hotseat,
                "online" => ofm_core::game::MultiplayerMode::Online,
                _ => ofm_core::game::MultiplayerMode::Offline,
            },
            current_player: 1,
            player1_day_ready: false,
            player2_day_ready: false,
            room_code: meta.room_code,
        };
        ofm_core::season_context::refresh_game_context(&mut game);

        Ok(game)
    }
}

impl GamePersistenceReader {
    pub fn read_stats_state(db: &GameDatabase) -> Result<StatsState, String> {
        stats_repo::load_stats_state(db.conn())
    }
}

// ============================================================================
// Backup Save/Load Functions
// ============================================================================

/// Metadata stored with backup saves
pub struct BackupMetadata {
    pub game_id: String,
    pub backup_timestamp: u64,
    pub host_player_id: String,
    pub client_player_id: String,
    pub last_sync_checksum: u64,
}

impl BackupMetadata {
    pub fn new(
        game_id: String,
        host_player_id: String,
        client_player_id: String,
        last_sync_checksum: u64,
    ) -> Self {
        let backup_timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Self {
            game_id,
            backup_timestamp,
            host_player_id,
            client_player_id,
            last_sync_checksum,
        }
    }
}

/// Write a backup save to a separate database file
///
/// Client uses this to save a backup that can be recovered if Host disconnects
pub fn write_backup(
    db_path: &std::path::Path,
    game: &Game,
    save_id: &str,
    metadata: &BackupMetadata,
) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create backup directory: {}", e))?;
    }

    // Open/create the backup database
    let db = GameDatabase::open(db_path)?;

    // Write game state (same as normal save)
    GamePersistenceWriter::write_game(&db, game, save_id, "backup")?;

    // Write backup metadata to a separate table
    db.conn()
        .execute(
            "CREATE TABLE IF NOT EXISTS backup_metadata (
                game_id TEXT PRIMARY KEY,
                backup_timestamp INTEGER NOT NULL,
                host_player_id TEXT NOT NULL,
                client_player_id TEXT NOT NULL,
                last_sync_checksum INTEGER NOT NULL
            )",
            [],
        )
        .map_err(|e| format!("Failed to create metadata table: {}", e))?;

    db.conn()
        .execute(
            "INSERT OR REPLACE INTO backup_metadata 
             (game_id, backup_timestamp, host_player_id, client_player_id, last_sync_checksum)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                metadata.game_id,
                metadata.backup_timestamp as i64,
                metadata.host_player_id,
                metadata.client_player_id,
                metadata.last_sync_checksum as i64,
            ],
        )
        .map_err(|e| format!("Failed to write backup metadata: {}", e))?;

    log::info!(
        "Backup saved: game_id={}, timestamp={}, checksum={:016x}",
        metadata.game_id,
        metadata.backup_timestamp,
        metadata.last_sync_checksum
    );

    Ok(())
}

/// Read a backup save from a separate database file
pub fn read_backup(db_path: &std::path::Path) -> Result<(Game, BackupMetadata), String> {
    // Check if backup exists
    if !db_path.exists() {
        return Err("Backup file does not exist".to_string());
    }

    let db = GameDatabase::open(db_path)
        .map_err(|e| format!("Failed to open backup database: {}", e))?;

    // Verify it's a valid backup file by checking for metadata table
    let has_metadata: bool = db
        .conn()
        .query_row(
            "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='backup_metadata'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !has_metadata {
        return Err("Invalid backup file: missing metadata".to_string());
    }

    // Read game state
    let game = GamePersistenceReader::read_game(&db)?;

    // Read metadata
    let metadata = db.conn()
        .query_row(
            "SELECT game_id, backup_timestamp, host_player_id, client_player_id, last_sync_checksum 
             FROM backup_metadata LIMIT 1",
            [],
            |row| {
                Ok(BackupMetadata {
                    game_id: row.get(0)?,
                    backup_timestamp: row.get::<_, i64>(1)? as u64,
                    host_player_id: row.get(2)?,
                    client_player_id: row.get(3)?,
                    last_sync_checksum: row.get::<_, i64>(4)? as u64,
                })
            },
        )
        .map_err(|e| format!("Failed to read backup metadata: {}", e))?;

    log::info!(
        "Backup loaded: game_id={}, timestamp={}",
        metadata.game_id,
        metadata.backup_timestamp
    );

    Ok((game, metadata))
}

/// Check if a backup file exists
pub fn backup_exists(db_path: &std::path::Path) -> bool {
    db_path.exists()
}

/// Delete a backup file
pub fn delete_backup(db_path: &std::path::Path) -> Result<(), String> {
    if db_path.exists() {
        std::fs::remove_file(db_path).map_err(|e| format!("Failed to delete backup: {}", e))?;
        log::info!("Backup deleted: {:?}", db_path);
    }
    Ok(())
}

/// Get the backup file path for a given save_id
pub fn get_backup_path(saves_dir: &std::path::Path, save_id: &str) -> std::path::PathBuf {
    saves_dir.join(format!("{}_backup.db", save_id))
}

fn parse_objective_type(value: &str) -> ObjectiveType {
    match value {
        "LeaguePosition" => ObjectiveType::LeaguePosition,
        "Wins" => ObjectiveType::Wins,
        "GoalsScored" => ObjectiveType::GoalsScored,
        _ => ObjectiveType::Wins,
    }
}
