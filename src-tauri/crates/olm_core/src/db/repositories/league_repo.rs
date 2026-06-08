use crate::domain::league::{FixtureStatus, League, MatchType};
use rusqlite::{Connection, params};

use super::competition_repo;

/// Upsert the league using the competition repository.
///
/// Delegates to `competition_repo::upsert_competition` which stores data in
/// the normalized `competitions` table with scoped `competition_id` on
/// fixtures/standings. Also writes a marker row to the legacy `league` table
/// so existing callers can find the active competition.
pub fn upsert_league(
    conn: &Connection,
    league: &League,
    schedule_config_json: Option<&str>,
) -> Result<(), String> {
    // Write full competition data via the new repo (with optional schedule_config)
    competition_repo::upsert_competition(conn, league, schedule_config_json)?;

    // Write active-competition marker to the legacy league table
    conn.execute(
        "INSERT OR REPLACE INTO league (id, name, season) VALUES (?1, ?2, ?3)",
        params![league.id, league.name, league.season],
    )
    .map_err(|e| format!("Failed to upsert league marker: {}", e))?;

    Ok(())
}

/// Load the active league via the competition repository.
///
/// Reads the active competition ID from the legacy `league` marker table,
/// then loads the full competition data (fixtures + standings) from the
/// normalized tables via `competition_repo`.
pub fn load_league(conn: &Connection) -> Result<Option<League>, String> {
    // Find the active competition via the legacy marker
    let mut stmt = conn
        .prepare("SELECT id, season FROM league ORDER BY season DESC, rowid DESC LIMIT 1")
        .map_err(|e| format!("Failed to prepare league marker query: {}", e))?;

    let mut rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, u32>(1)?,
            ))
        })
        .map_err(|e| format!("Failed to query league marker: {}", e))?;

    let (league_id, season) = match rows.next() {
        Some(Ok(tuple)) => tuple,
        Some(Err(e)) => return Err(format!("Failed to read league marker: {}", e)),
        None => return Ok(None),
    };

    // Load full competition data (fixtures + standings) from the normalized tables
    let result = competition_repo::load_competition(conn, &league_id)?;
    let mut league = result.map(|(l, _config)| l);
    if let Some(ref mut league) = league {
        league.season = season;
    }
    Ok(league)
}

/// Check if stale/unlinked competition data exists.
///
/// Uses `competition_id` from the normalized tables instead of the legacy
/// `league_id` column.
pub fn needs_cleanup(conn: &Connection, active_competition_id: Option<&str>) -> Result<bool, String> {
    let comp_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM competitions", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count competitions: {}", e))?;

    let Some(active_id) = active_competition_id else {
        return Ok(comp_count > 0);
    };

    if comp_count != 1 {
        return Ok(true);
    }

    let stale_fixture_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM fixtures WHERE competition_id != ?1",
            params![active_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count stale fixtures: {}", e))?;
    if stale_fixture_count > 0 {
        return Ok(true);
    }

    let stale_standings_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM standings WHERE competition_id != ?1",
            params![active_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count stale standings: {}", e))?;

    Ok(stale_standings_count > 0)
}

/// Parse fixture status string. Used by competition_repo.
pub(crate) fn parse_fixture_status(s: &str) -> FixtureStatus {
    match s {
        "InProgress" => FixtureStatus::InProgress,
        "Completed" => FixtureStatus::Completed,
        _ => FixtureStatus::Scheduled,
    }
}

/// Parse fixture competition enum string. Used by competition_repo.
pub(crate) fn parse_fixture_competition(s: &str) -> MatchType {
    match s {
        "Friendly" => MatchType::Friendly,
        "PreseasonTournament" => MatchType::PreseasonTournament,
        "Playoffs" => MatchType::Playoffs,
        _ => MatchType::League,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_database::GameDatabase;
    use crate::domain::league::{Fixture, LeagueKind, MatchResult, StandingEntry};

    fn test_db() -> GameDatabase {
        GameDatabase::open_in_memory().unwrap()
    }

    fn sample_league() -> League {
        let team_ids = vec!["team-001".to_string(), "team-002".to_string()];
        let mut league = League::new(
            "league-1".to_string(),
            "Premier Division".to_string(),
            2026,
            &team_ids,
            None,
        );
        league.fixtures = vec![
            Fixture {
                id: "fix-001".to_string(),
                matchday: 1,
                date: "2026-08-15".to_string(),
                home_team_id: "team-001".to_string(),
                away_team_id: "team-002".to_string(),
                match_type: MatchType::League,
                status: FixtureStatus::Scheduled,
                result: None,
                best_of: 1,
            },
            Fixture {
                id: "fix-002".to_string(),
                matchday: 2,
                date: "2026-08-22".to_string(),
                home_team_id: "team-002".to_string(),
                away_team_id: "team-001".to_string(),
                match_type: MatchType::Friendly,
                status: FixtureStatus::Completed,
                best_of: 1,
                result: Some(MatchResult {
                    away_wins: 0,
                    home_wins: 1,
                    ended_by: crate::domain::league::MatchEndReason::TimeLimit,
                    game_duration_seconds: 3600,
                    report: None,
                }),
            },
        ];
        league
    }

    #[test]
    fn test_upsert_and_load_league() {
        let db = test_db();
        let league = sample_league();

        upsert_league(db.conn(), &league, None).unwrap();
        let loaded = load_league(db.conn()).unwrap().unwrap();

        assert_eq!(loaded.id, "league-1");
        assert_eq!(loaded.name, "Premier Division");
        assert_eq!(loaded.season, 2026);
    }

    #[test]
    fn test_league_fixtures_roundtrip() {
        let db = test_db();
        let league = sample_league();

        upsert_league(db.conn(), &league, None).unwrap();
        let loaded = load_league(db.conn()).unwrap().unwrap();

        assert_eq!(loaded.fixtures.len(), 2);
        assert_eq!(loaded.fixtures[0].status, FixtureStatus::Scheduled);
        assert!(loaded.fixtures[0].result.is_none());
        assert_eq!(loaded.fixtures[1].status, FixtureStatus::Completed);
        assert_eq!(loaded.fixtures[1].match_type, MatchType::Friendly);
        assert!(loaded.fixtures[1].result.is_some());
        let result = loaded.fixtures[1].result.as_ref().unwrap();
        assert_eq!(result.home_wins, 1);
        assert_eq!(result.away_wins, 0);
    }

    #[test]
    fn test_league_standings_roundtrip() {
        let db = test_db();
        let league = sample_league();

        upsert_league(db.conn(), &league, None).unwrap();
        let loaded = load_league(db.conn()).unwrap().unwrap();

        assert_eq!(loaded.standings.len(), 2);
    }

    #[test]
    fn test_load_league_empty() {
        let db = test_db();
        let loaded = load_league(db.conn()).unwrap();
        assert!(loaded.is_none());
    }

    #[test]
    fn test_upsert_league_replaces_fixtures() {
        let db = test_db();
        let mut league = sample_league();
        upsert_league(db.conn(), &league, None).unwrap();

        // Modify and re-upsert — old fixtures for this competition should be replaced
        league.fixtures = vec![Fixture {
            id: "fix-003".to_string(),
            matchday: 3,
            date: "2026-08-29".to_string(),
            home_team_id: "team-001".to_string(),
            away_team_id: "team-002".to_string(),
            match_type: MatchType::League,
            status: FixtureStatus::Scheduled,
            result: None,
            best_of: 1,
        }];
        upsert_league(db.conn(), &league, None).unwrap();

        let loaded = load_league(db.conn()).unwrap().unwrap();
        assert_eq!(loaded.fixtures.len(), 1, "should have exactly 1 fixture for this competition");
        assert_eq!(loaded.fixtures[0].id, "fix-003");
    }

    #[test]
    fn test_upsert_league_replaces_same_competition_data() {
        let db = test_db();
        let league = sample_league();
        upsert_league(db.conn(), &league, None).unwrap();

        // Re-upsert same league with different fixtures — old data for this competition is replaced
        let replacement = League {
            id: "league-1".to_string(),
            name: "Premier Division".to_string(),
            season: 2027,
            competition_id: None,
            league_kind: LeagueKind::Main,
            fixtures: vec![Fixture {
                id: "fix-101".to_string(),
                matchday: 1,
                date: "2027-08-15".to_string(),
                home_team_id: "team-001".to_string(),
                away_team_id: "team-002".to_string(),
                match_type: MatchType::League,
                status: FixtureStatus::Scheduled,
                result: None,
                best_of: 1,
            }],
            standings: vec![
                StandingEntry::new("team-001".to_string()),
                StandingEntry::new("team-002".to_string()),
            ],
        };

        upsert_league(db.conn(), &replacement, None).unwrap();

        let league_count: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM league", [], |row| row.get(0))
            .unwrap();
        let loaded = load_league(db.conn()).unwrap().unwrap();

        // Two markers exist (different IDs), load_league picks the highest season
        assert_eq!(league_count, 2);
        assert_eq!(loaded.id, "league-2");
        assert_eq!(loaded.season, 2027);
        assert_eq!(loaded.fixtures.len(), 1);
        assert_eq!(loaded.fixtures[0].id, "fix-101");
    }

    #[test]
    fn test_load_league_picks_active_from_marker_table() {
        let db = test_db();

        // Write two competitions via the API, then verify load_league picks
        // the one with the highest season from the marker table
        let old_league = League {
            id: "league-old".to_string(),
            name: "Premier Division".to_string(),
            season: 2026,
            competition_id: None,
            league_kind: LeagueKind::Main,
            fixtures: vec![Fixture {
                id: "fix-old".to_string(),
                matchday: 1,
                date: "2026-08-15".to_string(),
                home_team_id: "team-001".to_string(),
                away_team_id: "team-002".to_string(),
                match_type: MatchType::League,
                status: FixtureStatus::Completed,
                result: None,
                best_of: 1,
            }],
            standings: vec![StandingEntry::new("team-001".to_string())],
        };
        upsert_league(db.conn(), &old_league, None).unwrap();

        let new_league = League {
            id: "league-new".to_string(),
            name: "Premier Division".to_string(),
            season: 2027,
            competition_id: None,
            league_kind: LeagueKind::Main,
            fixtures: vec![Fixture {
                id: "fix-new".to_string(),
                matchday: 1,
                date: "2027-08-15".to_string(),
                home_team_id: "team-001".to_string(),
                away_team_id: "team-002".to_string(),
                match_type: MatchType::League,
                status: FixtureStatus::Scheduled,
                result: None,
                best_of: 1,
            }],
            standings: vec![StandingEntry::new("team-001".to_string())],
        };
        upsert_league(db.conn(), &new_league, None).unwrap();

        let loaded = load_league(db.conn()).unwrap().unwrap();

        assert_eq!(loaded.id, "league-new");
        assert_eq!(loaded.season, 2027);
        assert_eq!(loaded.fixtures.len(), 1);
        assert_eq!(loaded.fixtures[0].id, "fix-new");
    }

    #[test]
    fn test_needs_cleanup_detects_multiple_league_rows() {
        let db = test_db();

        db.conn()
            .execute(
                "INSERT INTO league (id, name, season) VALUES (?1, ?2, ?3)",
                params!["league-old", "Premier Division", 2026],
            )
            .unwrap();
        db.conn()
            .execute(
                "INSERT INTO league (id, name, season) VALUES (?1, ?2, ?3)",
                params!["league-new", "Premier Division", 2027],
            )
            .unwrap();

        assert!(needs_cleanup(db.conn(), Some("league-new")).unwrap());
    }
}

