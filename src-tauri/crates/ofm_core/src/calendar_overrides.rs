/// Calendar override support.
///
/// Allows modifying fixture dates within a competition. Each override
/// is tracked via `CompetitionRuntime.has_manual_overrides` so the
/// calendar generator knows not to regenerate overridden fixtures.
use crate::fixture_ref::FixtureRef;
use crate::game::Game;

/// Error returned when a reschedule operation fails.
#[derive(Debug)]
pub enum RescheduleError {
    CompetitionNotFound(String),
    FixtureNotFound(String),
    PastDate(String),
}

/// Reschedule a fixture to a new date.
///
/// Updates both the competition fixture and the legacy league projection
/// (if the competition is the active one). Marks the competition as
/// having manual overrides.
pub fn reschedule_fixture(
    game: &mut Game,
    competition_id: &str,
    fixture_id: &str,
    new_date: &str,
) -> Result<(), RescheduleError> {
    let fixture_ref = FixtureRef::new(competition_id, fixture_id);

    let (pi, fi) = {
        let resolved = crate::fixture_ref::resolve_fixture_mut(
            &mut game.competitions,
            &fixture_ref,
        )
        .ok_or_else(|| RescheduleError::FixtureNotFound(format!(
            "fixture '{}' not found in competition '{}'",
            fixture_id, competition_id
        )))?;
        (resolved.phase_index, resolved.fixture_index)
    };

    // Update the fixture date and mark overrides
    if let Some(comp) = game.competitions.iter_mut().find(|c| c.id == competition_id) {
        if let Some(phase) = comp.phases.get_mut(pi) {
            if let Some(fixture) = phase.fixtures.get_mut(fi) {
                fixture.date = new_date.to_string();
            }
        }
        comp.runtime.has_manual_overrides = true;
    }

    log::info!(
        "[calendar] rescheduled fixture '{}' in '{}' to {}",
        fixture_id,
        competition_id,
        new_date
    );

    Ok(())
}

/// Check if a competition has any manual overrides.
pub fn has_manual_overrides(game: &Game, competition_id: &str) -> bool {
    game.competitions
        .iter()
        .find(|c| c.id == competition_id)
        .map(|c| c.runtime.has_manual_overrides)
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::GameClock;
    use chrono::Utc;
    use domain::competition::{
        Competition, CompetitionPhase, CompetitionRules, CompetitionRuntime, CompetitionStatus,
        CompetitionTier, PhaseStatus, PhaseType,
    };
    use domain::league::{Fixture, FixtureCompetition, FixtureStatus, StandingEntry};
    use domain::manager::Manager;

    fn make_test_game() -> Game {
        let clock = GameClock::new(Utc::now());
        Game::new(
            clock,
            Manager::new("mgr".into(), "Test".into(), "User".into(), "2000-01-01".into(), "US".into()),
            vec![],
            vec![],
            vec![],
            vec![],
        )
    }

    fn add_test_competition(game: &mut Game) {
        let standings: Vec<StandingEntry> = (0..3)
            .map(|i| StandingEntry::new(format!("team-{i}")))
            .collect();
        let fixtures: Vec<Fixture> = (0..3)
            .map(|i| Fixture {
                id: format!("fix-{i}"),
                matchday: 1,
                date: "2026-01-01".into(),
                home_team_id: format!("team-{i}"),
                away_team_id: format!("team-{}", (i + 1) % 3),
                competition: FixtureCompetition::League,
                best_of: 1,
                status: FixtureStatus::Scheduled,
                result: None,
            })
            .collect();

        game.competitions.push(Competition {
            id: "test-league".into(),
            name: "Test League".into(),
            slug: "test-league".into(),
            season: 2026,
            region: "TEST".into(),
            tier: CompetitionTier::Regional,
            status: CompetitionStatus::InProgress,
            rules: CompetitionRules::default(),
            phases: vec![CompetitionPhase {
                id: "test-regular".into(),
                name: "Regular".into(),
                phase_type: PhaseType::RoundRobin,
                status: PhaseStatus::InProgress,
                standings,
                fixtures,
            }],
            runtime: CompetitionRuntime {
                has_manual_overrides: false,
                next_matchday: 1,
                is_active: true,
                active_phase_id: Some("test-regular".into()),
            },
        });
    }

    #[test]
    fn reschedule_updates_fixture_date() {
        let mut game = make_test_game();
        add_test_competition(&mut game);

        reschedule_fixture(&mut game, "test-league", "fix-0", "2026-02-01").unwrap();

        let comp = &game.competitions[0];
        assert_eq!(comp.phases[0].fixtures[0].date, "2026-02-01");
        assert!(comp.runtime.has_manual_overrides);
    }

    #[test]
    fn reschedule_nonexistent_fixture_fails() {
        let mut game = make_test_game();
        add_test_competition(&mut game);

        let result = reschedule_fixture(&mut game, "test-league", "nonexistent", "2026-02-01");
        assert!(result.is_err());
    }

    #[test]
    fn reschedule_nonexistent_competition_fails() {
        let mut game = make_test_game();
        add_test_competition(&mut game);

        let result = reschedule_fixture(&mut game, "wrong-league", "fix-0", "2026-02-01");
        assert!(result.is_err());
    }

    #[test]
    fn tracks_manual_overrides_flag() {
        let mut game = make_test_game();
        add_test_competition(&mut game);

        assert!(!has_manual_overrides(&game, "test-league"));

        reschedule_fixture(&mut game, "test-league", "fix-1", "2026-03-01").unwrap();

        assert!(has_manual_overrides(&game, "test-league"));
    }
}
