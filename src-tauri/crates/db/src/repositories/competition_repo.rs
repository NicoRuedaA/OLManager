use domain::league::{Fixture, League, StandingEntry};
use rusqlite::{Connection, params};

use super::league_repo;

/// Upsert a competition and its fixtures + standings.
/// Unlike the legacy `upsert_league`, this operation is SCOPED to the
/// competition_id — it does NOT delete data from other competitions.
pub fn upsert_competition(conn: &Connection, league: &League) -> Result<(), String> {
    let cid = &league.id;

    // Upsert competition metadata
    conn.execute(
        "INSERT OR REPLACE INTO competitions (id, name, region, tier)
         VALUES (?1, ?2, '', 1)",
        params![cid, league.name],
    )
    .map_err(|e| format!("Failed to upsert competition: {}", e))?;

    // Delete only this competition's fixtures (scoped delete)
    conn.execute(
        "DELETE FROM fixtures WHERE competition_id = ?1",
        params![cid],
    )
    .map_err(|e| format!("Failed to clear fixtures for competition {}: {}", cid, e))?;

    // Delete only this competition's standings
    conn.execute(
        "DELETE FROM standings WHERE competition_id = ?1",
        params![cid],
    )
    .map_err(|e| format!("Failed to clear standings for competition {}: {}", cid, e))?;

    // Insert fixtures
    for f in &league.fixtures {
        let competition_str = format!("{:?}", f.match_type);
        let status_str = format!("{:?}", f.status);
        let result_json = f
            .result
            .as_ref()
            .map(|r| serde_json::to_string(r).unwrap_or_default());
        conn.execute(
            "INSERT INTO fixtures (id, league_id, matchday, date, home_team_id, away_team_id, competition, best_of, status, result, competition_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                f.id,
                cid,
                f.matchday,
                f.date,
                f.home_team_id,
                f.away_team_id,
                competition_str,
                f.best_of,
                status_str,
                result_json,
                cid,
            ],
        )
        .map_err(|e| format!("Failed to insert fixture: {}", e))?;
    }

    // Insert standings
    for s in &league.standings {
        conn.execute(
            "INSERT INTO standings (league_id, team_id, played, won, drawn, lost, goals_for, goals_against, points, competition_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                cid,
                s.team_id,
                s.played,
                s.won,
                0_i32,       // drawn: no longer tracked in domain model
                s.lost,
                s.maps_won,
                s.maps_lost,
                s.points,
                cid,
            ],
        )
        .map_err(|e| format!("Failed to insert standing: {}", e))?;
    }

    Ok(())
}

/// Load a single competition by ID.
pub fn load_competition(conn: &Connection, competition_id: &str) -> Result<Option<League>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name FROM competitions WHERE id = ?1")
        .map_err(|e| format!("Failed to prepare competition query: {}", e))?;

    let mut rows = stmt
        .query_map(params![competition_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| format!("Failed to query competition: {}", e))?;

    let (id, name) = match rows.next() {
        Some(Ok(tuple)) => tuple,
        Some(Err(e)) => return Err(format!("Failed to read competition row: {}", e)),
        None => return Ok(None),
    };

    let fixtures = load_fixtures(conn, &id)?;
    let standings = load_standings(conn, &id)?;

    let cid = id.clone();
    Ok(Some(League {
        id,
        name,
        season: 0, // season is stored separately in seasons table
        fixtures,
        standings,
        competition_id: Some(cid),
    }))
}

/// Load all competitions.
pub fn load_competitions(conn: &Connection) -> Result<Vec<League>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name FROM competitions ORDER BY name")
        .map_err(|e| format!("Failed to prepare competitions query: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| format!("Failed to query competitions: {}", e))?;

    let mut leagues = Vec::new();
    for row in rows {
        let (id, name) = row.map_err(|e| format!("Failed to read competition row: {}", e))?;
        let cid = id.clone();
        let fixtures = load_fixtures(conn, &cid)?;
        let standings = load_standings(conn, &cid)?;
        leagues.push(League {
            id,
            name,
            season: 0,
            fixtures,
            standings,
            competition_id: Some(cid),
        });
    }

    Ok(leagues)
}

/// Delete a competition and its fixtures + standings.
pub fn delete_competition(conn: &Connection, competition_id: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM fixtures WHERE competition_id = ?1",
        params![competition_id],
    )
    .map_err(|e| format!("Failed to delete fixtures: {}", e))?;

    conn.execute(
        "DELETE FROM standings WHERE competition_id = ?1",
        params![competition_id],
    )
    .map_err(|e| format!("Failed to delete standings: {}", e))?;

    conn.execute(
        "DELETE FROM competitions WHERE id = ?1",
        params![competition_id],
    )
    .map_err(|e| format!("Failed to delete competition: {}", e))?;

    Ok(())
}

// ─── Helpers ──────────────────────────────────────────────────────────────

fn load_fixtures(conn: &Connection, competition_id: &str) -> Result<Vec<Fixture>, String> {
    let mut fix_stmt = conn
        .prepare(
            "SELECT id, matchday, date, home_team_id, away_team_id, competition, best_of, status, result
             FROM fixtures WHERE competition_id = ?1 ORDER BY matchday, id",
        )
        .map_err(|e| format!("Failed to prepare fixtures query: {}", e))?;

    let fixture_rows = fix_stmt
        .query_map(params![competition_id], |row| {
            let competition_str: String = row.get(5)?;
            let status_str: String = row.get(7)?;
            let result_json: Option<String> = row.get(8)?;
            Ok(Fixture {
                id: row.get(0)?,
                matchday: row.get(1)?,
                date: row.get(2)?,
                home_team_id: row.get(3)?,
                away_team_id: row.get(4)?,
                match_type: league_repo::parse_fixture_competition(&competition_str),
                best_of: row.get(6)?,
                status: league_repo::parse_fixture_status(&status_str),
                result: result_json.and_then(|j| serde_json::from_str(&j).ok()),
            })
        })
        .map_err(|e| format!("Failed to query fixtures: {}", e))?;

    let mut fixtures = Vec::new();
    for row in fixture_rows {
        fixtures.push(row.map_err(|e| format!("Failed to read fixture: {}", e))?);
    }
    Ok(fixtures)
}

fn load_standings(conn: &Connection, competition_id: &str) -> Result<Vec<StandingEntry>, String> {
    let mut stand_stmt = conn
        .prepare(
            "SELECT team_id, played, won, drawn, lost, goals_for, goals_against, points
             FROM standings WHERE competition_id = ?1",
        )
        .map_err(|e| format!("Failed to prepare standings query: {}", e))?;

    let standing_rows = stand_stmt
        .query_map(params![competition_id], |row| {
            Ok(StandingEntry {
                team_id: row.get(0)?,
                played: row.get(1)?,
                won: row.get(2)?,
                lost: row.get(4)?,
                maps_won: row.get(5)?,
                maps_lost: row.get(6)?,
                points: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to query standings: {}", e))?;

    let mut standings = Vec::new();
    for row in standing_rows {
        standings.push(row.map_err(|e| format!("Failed to read standing: {}", e))?);
    }
    Ok(standings)
}

// ─── Tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_database::GameDatabase;
    use domain::league::{FixtureStatus, MatchEndReason, MatchResult, MatchType};

    fn test_db() -> GameDatabase {
        GameDatabase::open_in_memory().unwrap()
    }

    fn sample_league(id: &str, name: &str) -> League {
        let team_ids = vec!["team-001".to_string(), "team-002".to_string()];
        let mut league = League::new(id.to_string(), name.to_string(), 2026, &team_ids, None);
        league.fixtures = vec![
            Fixture {
                id: format!("{}-fix-001", id),
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
                id: format!("{}-fix-002", id),
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
                    ended_by: domain::league::MatchEndReason::TimeLimit,
                    game_duration_seconds: 3600,
                    report: None,
                }),
            },
        ];
        league
    }

    #[test]
    fn test_upsert_and_load_single_competition() {
        let db = test_db();
        let league = sample_league("lec", "LEC");

        upsert_competition(db.conn(), &league).unwrap();
        let loaded = load_competition(db.conn(), "lec")
            .unwrap()
            .expect("should find competition");

        assert_eq!(loaded.id, "lec");
        assert_eq!(loaded.name, "LEC");
        assert_eq!(loaded.fixtures.len(), 2);
        assert_eq!(loaded.standings.len(), 2);
    }

    #[test]
    fn test_multiple_competitions_independent() {
        let db = test_db();
        let lec = sample_league("lec", "LEC");
        let lcs = sample_league("lcs", "LCS");

        upsert_competition(db.conn(), &lec).unwrap();
        upsert_competition(db.conn(), &lcs).unwrap();

        let all = load_competitions(db.conn()).unwrap();
        assert_eq!(all.len(), 2);

        // Verify isolation: updating one does not affect the other
        let mut updated_lec = lec.clone();
        updated_lec.fixtures.push(Fixture {
            id: "lec-fix-003".to_string(),
            matchday: 3,
            date: "2026-08-29".to_string(),
            home_team_id: "team-001".to_string(),
            away_team_id: "team-002".to_string(),
            match_type: MatchType::Playoffs,
            status: FixtureStatus::Scheduled,
            result: None,
            best_of: 3,
        });
        upsert_competition(db.conn(), &updated_lec).unwrap();

        let loaded_lec = load_competition(db.conn(), "lec")
            .unwrap()
            .expect("LEC should exist");
        assert_eq!(loaded_lec.fixtures.len(), 3, "LEC should have 3 fixtures");

        let loaded_lcs = load_competition(db.conn(), "lcs")
            .unwrap()
            .expect("LCS should exist");
        assert_eq!(
            loaded_lcs.fixtures.len(),
            2,
            "LCS should still have 2 fixtures (isolation)"
        );
    }

    #[test]
    fn test_competition_not_found() {
        let db = test_db();
        let result = load_competition(db.conn(), "nonexistent").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_delete_competition() {
        let db = test_db();
        let league = sample_league("lec", "LEC");

        upsert_competition(db.conn(), &league).unwrap();
        assert!(load_competition(db.conn(), "lec")
            .unwrap()
            .is_some());

        delete_competition(db.conn(), "lec").unwrap();
        assert!(load_competition(db.conn(), "lec")
            .unwrap()
            .is_none());

        // Verify no orphan fixtures
        let fixture_count: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM fixtures WHERE competition_id = 'lec'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(fixture_count, 0, "fixtures should be cleaned up");
    }

    #[test]
    fn test_competition_fixtures_roundtrip() {
        let db = test_db();
        let league = sample_league("lec", "LEC");

        upsert_competition(db.conn(), &league).unwrap();
        let loaded = load_competition(db.conn(), "lec")
            .unwrap()
            .expect("should find competition");

        assert_eq!(loaded.fixtures[0].status, FixtureStatus::Scheduled);
        assert!(loaded.fixtures[0].result.is_none());
        assert_eq!(loaded.fixtures[1].status, FixtureStatus::Completed);
        assert_eq!(
            loaded.fixtures[1].match_type,
            MatchType::Friendly
        );
        let result = loaded.fixtures[1].result.as_ref().unwrap();
        assert_eq!(result.home_wins, 1);
        assert_eq!(result.away_wins, 0);
    }

    // ─── Fixture routing isolation tests (#165) ────────────────────────

    /// Two competitions with fixtures on the same date must not collide
    /// when stored and loaded through the competition repo.
    #[test]
    fn test_fixture_routing_cross_competition_isolation() {
        let db = test_db();

        // Competition LEC: fixture on 2025-02-15 matchday 5
        let mut lec = sample_league("lec", "LEC");
        lec.fixtures[0].date = "2025-02-15".to_string();
        lec.fixtures[0].matchday = 5;
        lec.fixtures[0].result = Some(MatchResult {
            home_wins: 2,
            away_wins: 0,
            ended_by: MatchEndReason::NexusDestroyed,
            game_duration_seconds: 1800,
            report: None,
        });
        lec.fixtures[0].status = FixtureStatus::Completed;

        // Competition LCS: fixture on the SAME date but different result
        let mut lcs = sample_league("lcs", "LCS");
        lcs.fixtures[0].date = "2025-02-15".to_string();
        lcs.fixtures[0].matchday = 5;
        lcs.fixtures[0].result = Some(MatchResult {
            home_wins: 1,
            away_wins: 2,
            ended_by: MatchEndReason::TimeLimit,
            game_duration_seconds: 2100,
            report: None,
        });
        lcs.fixtures[0].status = FixtureStatus::Completed;

        upsert_competition(db.conn(), &lec).unwrap();
        upsert_competition(db.conn(), &lcs).unwrap();

        let loaded_lec = load_competition(db.conn(), "lec")
            .unwrap()
            .expect("LEC should exist");
        let loaded_lcs = load_competition(db.conn(), "lcs")
            .unwrap()
            .expect("LCS should exist");

        // Same date, same matchday — but results must be independent
        let lec_fix = loaded_lec.fixtures.iter().find(|f| f.id == "lec-fix-001").unwrap();
        let lcs_fix = loaded_lcs.fixtures.iter().find(|f| f.id == "lcs-fix-001").unwrap();
        assert_eq!(lec_fix.date, "2025-02-15");
        assert_eq!(lcs_fix.date, "2025-02-15");
        assert_eq!(
            lec_fix.result.as_ref().unwrap().home_wins,
            2,
            "LEC result must be preserved"
        );
        assert_eq!(
            lcs_fix.result.as_ref().unwrap().home_wins,
            1,
            "LCS result must be independent"
        );
    }

    /// Applying a result to one competition must not mutate another
    /// competition's fixtures in the database.
    #[test]
    fn test_fixture_result_isolation_across_competitions() {
        let db = test_db();
        let lec = sample_league("lec", "LEC");
        let lcs = sample_league("lcs", "LCS");

        upsert_competition(db.conn(), &lec).unwrap();
        upsert_competition(db.conn(), &lcs).unwrap();

        // Update only LEC's first fixture
        let mut updated_lec = lec.clone();
        updated_lec.fixtures[0].status = FixtureStatus::Completed;
        updated_lec.fixtures[0].result = Some(MatchResult {
            home_wins: 3,
            away_wins: 1,
            ended_by: MatchEndReason::NexusDestroyed,
            game_duration_seconds: 3600,
            report: None,
        });
        upsert_competition(db.conn(), &updated_lec).unwrap();

        // Verify LCS fixture is untouched (still Scheduled, no result)
        let loaded_lcs = load_competition(db.conn(), "lcs")
            .unwrap()
            .expect("LCS should exist");
        assert_eq!(
            loaded_lcs.fixtures[0].status,
            FixtureStatus::Scheduled,
            "LCS fixture must NOT be affected by LEC update"
        );
        assert!(
            loaded_lcs.fixtures[0].result.is_none(),
            "LCS fixture result must NOT leak from LEC"
        );
    }
}
