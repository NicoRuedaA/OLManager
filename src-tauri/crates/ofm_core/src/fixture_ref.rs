/// FixtureRef — unique identifier for a fixture across all competitions.
///
/// Replaces bare `fixture_index` with a compound key
/// `(competition_id, fixture_id)` so that match results can be routed to the
/// correct competition even when multiple competitions have overlapping
/// fixture indices.
use domain::competition::Competition;
use domain::league::{Fixture, FixtureStatus};

/// A cross-competition fixture reference.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct FixtureRef {
    pub competition_id: String,
    pub fixture_id: String,
}

impl FixtureRef {
    pub fn new(competition_id: &str, fixture_id: &str) -> Self {
        Self {
            competition_id: competition_id.to_string(),
            fixture_id: fixture_id.to_string(),
        }
    }
}

/// Result of a fixture lookup.
#[derive(Debug)]
pub struct ResolvedFixture<'a> {
    pub competition: &'a Competition,
    pub fixture: &'a Fixture,
    pub phase_index: usize,
    pub fixture_index: usize,
}

/// Resolve a FixtureRef to a specific fixture within the competitions vec.
/// Returns the competition reference, fixture reference, and indices.
pub fn resolve_fixture<'a>(
    competitions: &'a [Competition],
    fixture_ref: &FixtureRef,
) -> Option<ResolvedFixture<'a>> {
    let competition = competitions.iter().find(|c| c.id == fixture_ref.competition_id)?;
    for (pi, phase) in competition.phases.iter().enumerate() {
        for (fi, fixture) in phase.fixtures.iter().enumerate() {
            if fixture.id == fixture_ref.fixture_id {
                return Some(ResolvedFixture {
                    competition,
                    fixture,
                    phase_index: pi,
                    fixture_index: fi,
                });
            }
        }
    }
    None
}

/// Mutable variant for applying results.
#[derive(Debug)]
pub struct ResolvedFixtureMut<'a> {
    pub competition: &'a mut Competition,
    pub phase_index: usize,
    pub fixture_index: usize,
}

/// Resolve a FixtureRef to mutable references.
pub fn resolve_fixture_mut<'a>(
    competitions: &'a mut [Competition],
    fixture_ref: &FixtureRef,
) -> Option<ResolvedFixtureMut<'a>> {
    let competition = competitions.iter_mut().find(|c| c.id == fixture_ref.competition_id)?;
    let pos = {
        let mut found = None;
        for (pi, phase) in competition.phases.iter().enumerate() {
            for (fi, fixture) in phase.fixtures.iter().enumerate() {
                if fixture.id == fixture_ref.fixture_id {
                    found = Some((pi, fi));
                    break;
                }
            }
            if found.is_some() {
                break;
            }
        }
        found
    };
    pos.map(|(phase_index, fixture_index)| ResolvedFixtureMut {
        competition,
        phase_index,
        fixture_index,
    })
}

/// Check if a fixture can be played (is still scheduled in the given competition).
pub fn is_fixture_playable(
    competitions: &[Competition],
    fixture_ref: &FixtureRef,
) -> bool {
    resolve_fixture(competitions, fixture_ref)
        .map(|rf| rf.fixture.status == FixtureStatus::Scheduled)
        .unwrap_or(false)
}

/// Ensure that a FixtureRef targets the correct competition.
/// Returns an error if the competition_id doesn't match or the fixture
/// doesn't belong to that competition.
pub fn validate_fixture_ref(
    competitions: &[Competition],
    fixture_ref: &FixtureRef,
) -> Result<(), String> {
    if !competitions.iter().any(|c| c.id == fixture_ref.competition_id) {
        return Err(format!(
            "Competition '{}' not found",
            fixture_ref.competition_id
        ));
    }
    if resolve_fixture(competitions, fixture_ref).is_none() {
        return Err(format!(
            "Fixture '{}' not found in competition '{}'",
            fixture_ref.fixture_id, fixture_ref.competition_id
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::competition::{
        Competition, CompetitionPhase, CompetitionRules, CompetitionRuntime, CompetitionStatus,
        CompetitionTier, PhaseStatus, PhaseType,
    };
    use domain::league::{FixtureCompetition, StandingEntry};

    fn make_test_competition(id: &str) -> Competition {
        let standings: Vec<StandingEntry> = (0..3)
            .map(|i| StandingEntry::new(format!("team-{i}")))
            .collect();
        let fixtures: Vec<Fixture> = (0..3)
            .map(|i| Fixture {
                id: format!("fix-{i}"),
                matchday: 1,
                date: "2026-01-01".into(),
                home_team_id: format!("team-{}", i),
                away_team_id: format!("team-{}", (i + 1) % 3),
                competition: FixtureCompetition::League,
                best_of: 1,
                status: FixtureStatus::Scheduled,
                result: None,
            })
            .collect();

        Competition {
            id: id.into(),
            name: format!("Comp {id}"),
            slug: id.into(),
            season: 2026,
            region: "TEST".into(),
            tier: CompetitionTier::Regional,
            status: CompetitionStatus::InProgress,
            rules: CompetitionRules::default(),
            phases: vec![CompetitionPhase {
                id: format!("{id}-regular"),
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
                active_phase_id: Some(format!("{id}-regular")),
            },
        }
    }

    #[test]
    fn resolve_fixture_by_competition_and_fixture_id() {
        let comp_a = make_test_competition("lec");
        let comp_b = make_test_competition("cblol");
        let competitions = vec![comp_a, comp_b];

        // Same fixture ID in different competitions
        let ref_a = FixtureRef::new("lec", "fix-0");
        let ref_b = FixtureRef::new("cblol", "fix-0");

        let resolved_a = resolve_fixture(&competitions, &ref_a).unwrap();
        let resolved_b = resolve_fixture(&competitions, &ref_b).unwrap();

        assert_eq!(resolved_a.competition.id, "lec");
        assert_eq!(resolved_b.competition.id, "cblol");
        assert_eq!(resolved_a.fixture.id, "fix-0");
        assert_eq!(resolved_b.fixture.id, "fix-0");
    }

    #[test]
    fn wrong_competition_returns_none() {
        let comp = make_test_competition("lec");
        let competitions = vec![comp];

        let result = resolve_fixture(&competitions, &FixtureRef::new("cblol", "fix-0"));
        assert!(result.is_none());
    }

    #[test]
    fn wrong_fixture_id_returns_none() {
        let comp = make_test_competition("lec");
        let competitions = vec![comp];

        let result = resolve_fixture(&competitions, &FixtureRef::new("lec", "nonexistent"));
        assert!(result.is_none());
    }

    #[test]
    fn validate_correct_ref_passes() {
        let comp = make_test_competition("lec");
        let competitions = vec![comp];

        let result = validate_fixture_ref(&competitions, &FixtureRef::new("lec", "fix-0"));
        assert!(result.is_ok());
    }

    #[test]
    fn validate_wrong_competition_fails() {
        let comp = make_test_competition("lec");
        let competitions = vec![comp];

        let result = validate_fixture_ref(&competitions, &FixtureRef::new("cblol", "fix-0"));
        assert!(result.is_err());
    }

    #[test]
    fn fixture_playable_when_scheduled() {
        let comp = make_test_competition("lec");
        let competitions = vec![comp];

        assert!(is_fixture_playable(&competitions, &FixtureRef::new("lec", "fix-0")));
    }
}
