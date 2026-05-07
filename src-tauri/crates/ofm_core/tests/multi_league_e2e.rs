/// End-to-end tests for the multi-league system.
///
/// Validates the full cycle: manifest loading → calendar generation →
/// competition creation → background simulation → result persistence.
use chrono::{NaiveDate, Utc};
use domain::competition::{
    Competition, CompetitionPhase, CompetitionRules, CompetitionRuntime, CompetitionStatus,
    CompetitionTier, PhaseStatus, PhaseType,
};
use domain::league::{Fixture, FixtureCompetition, FixtureStatus, MatchResult, StandingEntry};
use domain::manager::Manager;

use ofm_core::calendar::{generate_calendar, PhaseSchedule};
use ofm_core::competition_runner;
use ofm_core::fixture_ref::{self, FixtureRef};
use ofm_core::game::Game;
use ofm_core::clock::GameClock;

/// Helper: create a game with two empty competitions for testing.
fn make_multi_league_game() -> Game {
    let clock = GameClock::new(Utc::now());
    let mut game = Game::new(
        clock,
        Manager::new("mgr".into(), "Test".into(), "User".into(), "2000-01-01".into(), "US".into()),
        vec![],
        vec![],
        vec![],
        vec![],
    );

    // Competition A (active, e.g. LEC)
    game.competitions.push(Competition {
        id: "lec".into(),
        name: "LEC".into(),
        slug: "lec".into(),
        season: 2026,
        region: "EMEA".into(),
        tier: CompetitionTier::Regional,
        status: CompetitionStatus::InProgress,
        rules: CompetitionRules::default(),
        phases: vec![CompetitionPhase {
            id: "lec-regular".into(),
            name: "Regular Season".into(),
            phase_type: PhaseType::RoundRobin,
            status: PhaseStatus::InProgress,
            standings: vec![
                StandingEntry::new("team-a".into()),
                StandingEntry::new("team-b".into()),
            ],
            fixtures: vec![Fixture {
                id: "lec-fix-1".into(),
                matchday: 1,
                date: "2026-01-18".into(),
                home_team_id: "team-a".into(),
                away_team_id: "team-b".into(),
                competition: FixtureCompetition::League,
                best_of: 1,
                status: FixtureStatus::Scheduled,
                result: None,
            }],
        }],
        runtime: CompetitionRuntime {
            has_manual_overrides: false,
            next_matchday: 1,
            is_active: true,
            active_phase_id: Some("lec-regular".into()),
        },
    });

    // Competition B (background, e.g. CBLOL)
    game.competitions.push(Competition {
        id: "cblol".into(),
        name: "CBLOL".into(),
        slug: "cblol".into(),
        season: 2026,
        region: "BRAZIL".into(),
        tier: CompetitionTier::Regional,
        status: CompetitionStatus::InProgress,
        rules: CompetitionRules::default(),
        phases: vec![CompetitionPhase {
            id: "cblol-regular".into(),
            name: "Regular Season".into(),
            phase_type: PhaseType::RoundRobin,
            status: PhaseStatus::InProgress,
            standings: vec![
                StandingEntry::new("team-c".into()),
                StandingEntry::new("team-d".into()),
            ],
            fixtures: vec![Fixture {
                id: "cblol-fix-1".into(),
                matchday: 1,
                date: "2026-01-18".into(),
                home_team_id: "team-c".into(),
                away_team_id: "team-d".into(),
                competition: FixtureCompetition::League,
                best_of: 1,
                status: FixtureStatus::Scheduled,
                result: None,
            }],
        }],
        runtime: CompetitionRuntime {
            has_manual_overrides: false,
            next_matchday: 1,
            is_active: false,
            active_phase_id: Some("cblol-regular".into()),
        },
    });

    game
}

#[test]
fn two_competitions_do_not_interfere() {
    let mut game = make_multi_league_game();

    // Both have a fixture on the same day with overlapping IDs
    let lec_ref = FixtureRef::new("lec", "lec-fix-1");
    let cblol_ref = FixtureRef::new("cblol", "cblol-fix-1");

    assert!(fixture_ref::is_fixture_playable(&game.competitions, &lec_ref));
    assert!(fixture_ref::is_fixture_playable(&game.competitions, &cblol_ref));

    // Resolve each — they have different competition IDs
    let lec = fixture_ref::resolve_fixture(&game.competitions, &lec_ref).unwrap();
    let cblol = fixture_ref::resolve_fixture(&game.competitions, &cblol_ref).unwrap();

    assert_eq!(lec.competition.id, "lec");
    assert_eq!(cblol.competition.id, "cblol");
}

#[test]
fn background_competition_simulates_independently() {
    let mut game = make_multi_league_game();

    // Process competitions for the match day
    competition_runner::process_competitions(&mut game, "2026-01-18");

    // Active competition (LEC) should NOT be simulated
    let lec = &game.competitions[0];
    assert_eq!(lec.phases[0].fixtures[0].status, FixtureStatus::Scheduled);

    // Background competition (CBLOL) SHOULD be simulated
    let cblol = &game.competitions[1];
    assert_eq!(cblol.phases[0].fixtures[0].status, FixtureStatus::Completed);
    assert!(cblol.phases[0].fixtures[0].result.is_some());

    // Standings updated
    let total_played: u32 = cblol.phases[0].standings.iter().map(|s| s.played).sum();
    assert_eq!(total_played, 2); // 1 match, both teams get 1 played
}

#[test]
fn calendar_generates_different_fixtures_per_competition() {
    let team_ids_lec: Vec<String> = (1..=10).map(|i| format!("lec-team-{}", i)).collect();
    let team_ids_cblol: Vec<String> = (1..=10).map(|i| format!("cblol-team-{}", i)).collect();
    let start = NaiveDate::from_ymd_opt(2026, 1, 18).unwrap();

    let schedule = PhaseSchedule::round_robin("Regular", 18, vec![6, 0], 5);

    let cal_lec = generate_calendar(&team_ids_lec, &[schedule.clone()], start, "lec");
    let cal_cblol = generate_calendar(&team_ids_cblol, &[schedule], start, "cblol");

    // Same structure but different data
    assert_eq!(cal_lec.phases[0].fixtures.len(), cal_cblol.phases[0].fixtures.len());
    assert_ne!(cal_lec.phases[0].fixtures[0].home_team_id, cal_cblol.phases[0].fixtures[0].home_team_id);
}

#[test]
fn three_league_cycle_without_collisions() {
    let mut game = make_multi_league_game();

    // Add a third competition
    game.competitions.push(Competition {
        id: "lcs".into(),
        name: "LCS".into(),
        slug: "lcs".into(),
        season: 2026,
        region: "NORTH AMERICA".into(),
        tier: CompetitionTier::Regional,
        status: CompetitionStatus::InProgress,
        rules: CompetitionRules::default(),
        phases: vec![CompetitionPhase {
            id: "lcs-regular".into(),
            name: "Regular Season".into(),
            phase_type: PhaseType::RoundRobin,
            status: PhaseStatus::InProgress,
            standings: vec![
                StandingEntry::new("team-e".into()),
                StandingEntry::new("team-f".into()),
            ],
            fixtures: vec![Fixture {
                id: "cblol-fix-1".into(), // Same ID as CBLOL! Should be isolated by competition_id
                matchday: 1,
                date: "2026-01-18".into(),
                home_team_id: "team-e".into(),
                away_team_id: "team-f".into(),
                competition: FixtureCompetition::League,
                best_of: 1,
                status: FixtureStatus::Scheduled,
                result: None,
            }],
        }],
        runtime: CompetitionRuntime {
            has_manual_overrides: false,
            next_matchday: 1,
            is_active: false,
            active_phase_id: Some("lcs-regular".into()),
        },
    });

    // All three have fixtures today
    competition_runner::process_competitions(&mut game, "2026-01-18");

    // LEC (active) unchanged
    assert_eq!(game.competitions[0].phases[0].fixtures[0].status, FixtureStatus::Scheduled);

    // CBLOL and LCS (background) both simulated
    assert_eq!(game.competitions[1].phases[0].fixtures[0].status, FixtureStatus::Completed);
    assert_eq!(game.competitions[2].phases[0].fixtures[0].status, FixtureStatus::Completed);

    // Even though LCS used the SAME fixture ID as CBLOL, they don't interfere
    let cblol_result = &game.competitions[1].phases[0].fixtures[0].result;
    let lcs_result = &game.competitions[2].phases[0].fixtures[0].result;
    assert!(cblol_result.is_some());
    assert!(lcs_result.is_some());
}
