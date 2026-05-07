/// Legacy LEC projection adapter.
///
/// Bridges the new `Competition` domain model with the existing `League`-based
/// code paths. The `League` becomes a projection/adapter that reads from
/// `Competition` phases. New code targets `Competition` directly.
///
/// # Strategy
/// - Existing `game.league` remains until all callers migrate.
/// - `game.competitions: Vec<Competition>` is the new source of truth.
/// - This adapter syncs the active competition's active phase into
///   a `League` view that legacy code can consume.
use domain::competition::{
    Competition, CompetitionPhase, CompetitionRuntime, CompetitionStatus, CompetitionTier,
    PhaseType,
};
use domain::league::{Fixture, League};

/// Errors that can occur during adapter operations.
#[derive(Debug)]
pub enum AdapterError {
    NoActiveCompetition,
    NoActivePhase(String),
    PhaseNotFound(String),
}

// ---------------------------------------------------------------------------
// Competition → League projection
// ---------------------------------------------------------------------------

/// Build a `League` view from the active phase of a `Competition`.
///
/// The active phase is determined by `CompetitionRuntime.active_phase_id`.
/// If not set, the first `InProgress` or `NotStarted` phase is used.
pub fn competition_to_league(comp: &Competition) -> Result<League, AdapterError> {
    let phase = resolve_active_phase(comp)?;
    let standings = phase.standings.clone();
    let fixtures = phase.fixtures.clone();

    Ok(League {
        id: comp.id.clone(),
        name: comp.name.clone(),
        season: comp.season,
        fixtures,
        standings,
    })
}

/// Resolve the active phase from a competition.
fn resolve_active_phase<'a>(
    comp: &'a Competition,
) -> Result<&'a CompetitionPhase, AdapterError> {
    // Try explicit active phase
    if let Some(phase_id) = &comp.runtime.active_phase_id {
        return comp
            .phases
            .iter()
            .find(|p| &p.id == phase_id)
            .ok_or_else(|| AdapterError::PhaseNotFound(phase_id.clone()));
    }
    // Fallback: first non-Finished phase
    comp.phases
        .iter()
        .find(|p| !matches!(p.status, domain::competition::PhaseStatus::Finished))
        .ok_or_else(|| AdapterError::NoActivePhase(comp.id.clone()))
}

// ---------------------------------------------------------------------------
// League → Competition sync (apply mutations back)
// ---------------------------------------------------------------------------

/// Apply standings mutations from a `League` back to the corresponding
/// competition phase.
pub fn sync_league_to_competition(comp: &mut Competition, league: &League) {
    let Some(active_id) = &comp.runtime.active_phase_id else {
        // If no active phase set, use the first mutable phase
        if let Some(first) = comp.phases.first_mut() {
            first.standings.clone_from(&league.standings);
            first.fixtures.clone_from(&league.fixtures);
        }
        return;
    };
    if let Some(phase) = comp.phases.iter_mut().find(|p| &p.id == active_id) {
        phase.standings.clone_from(&league.standings);
        phase.fixtures.clone_from(&league.fixtures);
    }
}

/// Sync just the fixtures from a League back to a Competition.
pub fn sync_fixtures_to_competition(comp: &mut Competition, fixtures: &[Fixture]) {
    if let Ok(phase) = resolve_active_phase_mut(comp) {
        phase.fixtures = fixtures.to_vec();
    }
}

fn resolve_active_phase_mut<'a>(
    comp: &'a mut Competition,
) -> Result<&'a mut CompetitionPhase, AdapterError> {
    if comp.runtime.active_phase_id.is_some() {
        let id = comp.runtime.active_phase_id.clone().unwrap();
        return comp
            .phases
            .iter_mut()
            .find(|p| p.id == id)
            .ok_or_else(|| AdapterError::PhaseNotFound(id));
    }
    comp.phases
        .first_mut()
        .ok_or_else(|| AdapterError::NoActivePhase(comp.id.clone()))
}

// ---------------------------------------------------------------------------
// Build helpers
// ---------------------------------------------------------------------------

/// Build a `Competition` from a `League` (for backfill / save upgrade).
pub fn league_to_competition(league: League, region: String, tier: CompetitionTier) -> Competition {
    Competition {
        id: league.id.clone(),
        name: league.name.clone(),
        slug: league.id.clone(),
        season: league.season,
        region,
        tier,
        status: CompetitionStatus::InProgress,
        rules: domain::competition::CompetitionRules::default(),
        phases: vec![domain::competition::CompetitionPhase {
            id: format!("{}-regular", league.id),
            name: "Regular Season".into(),
            phase_type: PhaseType::RoundRobin,
            standings: league.standings,
            fixtures: league.fixtures,
            status: domain::competition::PhaseStatus::InProgress,
        }],
        runtime: CompetitionRuntime {
            has_manual_overrides: false,
            next_matchday: 1,
            is_active: true,
            active_phase_id: Some(format!("{}-regular", league.id)),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::competition::{CompetitionPhase, CompetitionRules};
    use domain::league::{FixtureCompetition, FixtureStatus, StandingEntry};

    fn make_test_competition() -> Competition {
        let team_ids = ["team-1", "team-2", "team-3"];
        let standings: Vec<StandingEntry> = team_ids
            .iter()
            .map(|tid| StandingEntry::new(tid.to_string()))
            .collect();
        let fixtures: Vec<Fixture> = (0..3)
            .map(|i| Fixture {
                id: format!("fix-{}", i),
                matchday: i + 1,
                date: format!("2026-01-{:02}", i + 1),
                home_team_id: format!("team-{}", (i % 3) + 1),
                away_team_id: format!("team-{}", ((i + 1) % 3) + 1),
                competition: FixtureCompetition::League,
                best_of: 1,
                status: FixtureStatus::Scheduled,
                result: None,
            })
            .collect();

        let phase = CompetitionPhase {
            id: "lec-2026-regular".into(),
            name: "Regular Season".into(),
            phase_type: PhaseType::RoundRobin,
            standings: standings.clone(),
            fixtures: fixtures.clone(),
            status: domain::competition::PhaseStatus::InProgress,
        };

        Competition {
            id: "lec-2026".into(),
            name: "LEC 2026".into(),
            slug: "lec-2026".into(),
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
                active_phase_id: Some("lec-2026-regular".into()),
            },
        }
    }

    #[test]
    fn competition_to_league_produces_view() {
        let comp = make_test_competition();
        let league = competition_to_league(&comp).unwrap();

        assert_eq!(league.id, "lec-2026");
        assert_eq!(league.name, "LEC 2026");
        assert_eq!(league.season, 2026);
        assert_eq!(league.standings.len(), 3);
        assert_eq!(league.fixtures.len(), 3);
    }

    #[test]
    fn sync_league_to_competition_applies_mutations() {
        let mut comp = make_test_competition();
        let mut league = competition_to_league(&comp).unwrap();

        // Mutate standings
        league.standings[0].won = 5;
        league.standings[0].points = 15;
        league.fixtures[0].status = FixtureStatus::Completed;

        sync_league_to_competition(&mut comp, &league);

        let phase = comp.phases.iter().find(|p| p.id == "lec-2026-regular").unwrap();
        assert_eq!(phase.standings[0].won, 5);
        assert_eq!(phase.standings[0].points, 15);
        assert_eq!(phase.fixtures[0].status, FixtureStatus::Completed);
    }

    #[test]
    fn league_to_competition_roundtrip() {
        let comp = make_test_competition();
        let league = competition_to_league(&comp).unwrap();
        let converted = league_to_competition(league.clone(), "EMEA".into(), CompetitionTier::Regional);

        assert_eq!(league.id, converted.id);
        assert_eq!(league.name, converted.name);
        assert_eq!(league.season, converted.season);
        assert_eq!(league.standings.len(), converted.phases[0].standings.len());
        assert_eq!(league.fixtures.len(), converted.phases[0].fixtures.len());
    }
}
