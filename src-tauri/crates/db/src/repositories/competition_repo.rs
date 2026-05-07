/// Repository for reading/writing `Competition` domain entities.
///
/// Competitions are stored as JSON blobs in the `competitions` table,
/// mirroring the `game_meta.game_data` pattern used by the legacy
/// league projection.
use domain::competition::Competition;
use rusqlite::{Connection, params};

/// Load all competitions for a save.
pub fn load_all(conn: &Connection) -> Result<Vec<Competition>, String> {
    let mut stmt = conn
        .prepare("SELECT id, data_json FROM competitions ORDER BY id")
        .map_err(|e| format!("[comp_repo] failed to prepare select: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let json: String = row.get(1)?;
            Ok((id, json))
        })
        .map_err(|e| format!("[comp_repo] failed to query: {e}"))?;

    let mut competitions = Vec::new();
    for row in rows {
        let (_id, json) = row.map_err(|e| format!("[comp_repo] row error: {e}"))?;
        match serde_json::from_str::<Competition>(&json) {
            Ok(comp) => competitions.push(comp),
            Err(e) => {
                log::warn!("[comp_repo] skipping deserialization error: {e}");
            }
        }
    }
    Ok(competitions)
}

/// Load a single competition by ID.
pub fn load_by_id(conn: &Connection, id: &str) -> Result<Option<Competition>, String> {
    let mut stmt = conn
        .prepare("SELECT data_json FROM competitions WHERE id = ?1")
        .map_err(|e| format!("[comp_repo] failed to prepare select: {e}"))?;

    let json: Option<String> = stmt
        .query_row(params![id], |row| row.get(0))
        .ok();

    match json {
        Some(raw) => serde_json::from_str(&raw)
            .map(Some)
            .map_err(|e| format!("[comp_repo] deserialization error: {e}")),
        None => Ok(None),
    }
}

/// Save (upsert) a competition.
pub fn save(conn: &Connection, competition: &Competition) -> Result<(), String> {
    let json = serde_json::to_string(competition)
        .map_err(|e| format!("[comp_repo] serialization error: {e}"))?;

    conn.execute(
        "INSERT INTO competitions (id, data_json) VALUES (?1, ?2)
         ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json",
        params![competition.id, json],
    )
    .map_err(|e| format!("[comp_repo] upsert error: {e}"))?;

    Ok(())
}

/// Save multiple competitions.
pub fn save_all(conn: &Connection, competitions: &[Competition]) -> Result<(), String> {
    for comp in competitions {
        let json = serde_json::to_string(comp)
            .map_err(|e| format!("[comp_repo] serialization error: {e}"))?;
        conn.execute(
            "INSERT INTO competitions (id, data_json) VALUES (?1, ?2)
             ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json",
            params![comp.id, json],
        )
        .map_err(|e| format!("[comp_repo] upsert error: {e}"))?;
    }
    Ok(())
}

/// Delete a competition by ID.
pub fn delete(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM competitions WHERE id = ?1", params![id])
        .map_err(|e| format!("[comp_repo] delete error: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::competition::{
        Competition, CompetitionPhase, CompetitionRules, CompetitionRuntime, CompetitionStatus,
        CompetitionTier, PhaseType, PhaseStatus,
    };
    use domain::league::{Fixture, FixtureCompetition, FixtureStatus, StandingEntry};
    use rusqlite::Connection;

    fn make_test_comp(id: &str, name: &str) -> Competition {
        let standings: Vec<StandingEntry> = (0..3)
            .map(|i| StandingEntry::new(format!("team-{i}")))
            .collect();
        let fixtures: Vec<Fixture> = (0..3)
            .map(|i| Fixture {
                id: format!("fix-{i}"),
                matchday: i + 1,
                date: format!("2026-01-{:02}", i + 1),
                home_team_id: format!("team-{}", (i % 3)),
                away_team_id: format!("team-{}", ((i + 1) % 3)),
                competition: FixtureCompetition::League,
                best_of: 1,
                status: FixtureStatus::Scheduled,
                result: None,
            })
            .collect();
        let phase = CompetitionPhase {
            id: format!("{id}-regular"),
            name: "Regular Season".into(),
            phase_type: PhaseType::RoundRobin,
            status: PhaseStatus::InProgress,
            standings,
            fixtures,
        };

        Competition {
            id: id.into(),
            name: name.into(),
            slug: id.into(),
            season: 2026,
            region: "EMEA".into(),
            tier: CompetitionTier::Regional,
            status: CompetitionStatus::InProgress,
            rules: CompetitionRules::default(),
            phases: vec![phase],
            runtime: CompetitionRuntime {
                has_manual_overrides: false,
                next_matchday: 1,
                is_active: true,
                active_phase_id: Some(format!("{id}-regular")),
            },
        }
    }

    fn setup_db() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE IF NOT EXISTS competitions (id TEXT PRIMARY KEY, data_json TEXT NOT NULL DEFAULT '{}')").unwrap();
        conn
    }

    #[test]
    fn roundtrip_single_competition() {
        let conn = setup_db();
        let comp = make_test_comp("lec-2026", "LEC 2026");

        save(&conn, &comp).unwrap();
        let loaded = load_by_id(&conn, "lec-2026").unwrap().unwrap();

        assert_eq!(loaded.id, "lec-2026");
        assert_eq!(loaded.name, "LEC 2026");
        assert_eq!(loaded.phases.len(), 1);
        assert_eq!(loaded.phases[0].fixtures.len(), 3);
        assert_eq!(loaded.phases[0].standings.len(), 3);
    }

    #[test]
    fn load_nonexistent_returns_none() {
        let conn = setup_db();
        let loaded = load_by_id(&conn, "nonexistent").unwrap();
        assert!(loaded.is_none());
    }

    #[test]
    fn multiple_competitions() {
        let conn = setup_db();
        let lec = make_test_comp("lec-2026", "LEC 2026");
        let cblol = make_test_comp("cblol-2026", "CBLOL 2026");

        save_all(&conn, &[lec, cblol]).unwrap();
        let all = load_all(&conn).unwrap();

        assert_eq!(all.len(), 2);
    }

    #[test]
    fn upsert_updates_existing() {
        let conn = setup_db();
        let mut comp = make_test_comp("test", "Original");

        save(&conn, &comp).unwrap();
        comp.name = "Updated".into();
        save(&conn, &comp).unwrap();

        let loaded = load_by_id(&conn, "test").unwrap().unwrap();
        assert_eq!(loaded.name, "Updated");
    }

    #[test]
    fn delete_removes_competition() {
        let conn = setup_db();
        let comp = make_test_comp("temp", "Temp");

        save(&conn, &comp).unwrap();
        delete(&conn, "temp").unwrap();

        let loaded = load_by_id(&conn, "temp").unwrap();
        assert!(loaded.is_none());
    }
}
