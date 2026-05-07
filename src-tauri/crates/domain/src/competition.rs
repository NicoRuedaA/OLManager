use crate::league::{Fixture, StandingEntry};
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// CompetitionId
// ---------------------------------------------------------------------------

pub type CompetitionId = String;

// ---------------------------------------------------------------------------
// Competition
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Competition {
    pub id: CompetitionId,
    pub name: String,
    pub slug: String,
    pub season: u32,
    pub region: String,
    pub tier: CompetitionTier,
    pub status: CompetitionStatus,
    pub rules: CompetitionRules,
    pub phases: Vec<CompetitionPhase>,
    pub runtime: CompetitionRuntime,
}

impl Competition {
    /// Create a new competition with the given parameters.
    pub fn new(
        id: CompetitionId,
        name: String,
        slug: String,
        season: u32,
        region: String,
        tier: CompetitionTier,
        rules: CompetitionRules,
        phases: Vec<CompetitionPhase>,
    ) -> Self {
        Self {
            id,
            name,
            slug,
            season,
            region,
            tier,
            status: CompetitionStatus::NotStarted,
            rules,
            phases,
            runtime: CompetitionRuntime::default(),
        }
    }
}

// ---------------------------------------------------------------------------
// CompetitionTier
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CompetitionTier {
    Regional,
    Academy,
    International,
    Cup,
}

// ---------------------------------------------------------------------------
// CompetitionStatus
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CompetitionStatus {
    NotStarted,
    InProgress,
    Finished,
    Cancelled,
}

// ---------------------------------------------------------------------------
// CompetitionRules
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompetitionRules {
    pub points_for_win: u8,
    pub points_for_draw: u8,
    pub best_of_default: u8,
    pub has_playoffs: bool,
    pub playoff_best_of: u8,
    pub teams_count: usize,
}

impl CompetitionRules {
    pub fn lec() -> Self {
        Self {
            points_for_win: 3,
            points_for_draw: 1,
            best_of_default: 1,
            has_playoffs: true,
            playoff_best_of: 5,
            teams_count: 10,
        }
    }
}

impl Default for CompetitionRules {
    fn default() -> Self {
        Self {
            points_for_win: 3,
            points_for_draw: 1,
            best_of_default: 1,
            has_playoffs: true,
            playoff_best_of: 5,
            teams_count: 10,
        }
    }
}

// ---------------------------------------------------------------------------
// CompetitionPhase
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompetitionPhase {
    pub id: String,
    pub name: String,
    pub phase_type: PhaseType,
    pub status: PhaseStatus,
    pub standings: Vec<StandingEntry>,
    pub fixtures: Vec<Fixture>,
}

impl CompetitionPhase {
    pub fn new(id: String, name: String, phase_type: PhaseType) -> Self {
        Self {
            id,
            name,
            phase_type,
            status: PhaseStatus::NotStarted,
            standings: Vec::new(),
            fixtures: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PhaseStatus {
    NotStarted,
    InProgress,
    Finished,
}

// ---------------------------------------------------------------------------
// PhaseType
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PhaseType {
    RoundRobin,
    SingleElimination,
    GroupStage,
}

// ---------------------------------------------------------------------------
// CompetitionRuntime
// ---------------------------------------------------------------------------

/// Tracks runtime state and manual overrides for a competition.
/// This is separate from the persisted competition metadata to keep
/// projection concerns isolated from the competition definition.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CompetitionRuntime {
    /// Whether the user has manually overridden any fixture dates.
    pub has_manual_overrides: bool,
    /// Index of the next matchday to process.
    pub next_matchday: u32,
    /// Whether this competition is currently the player's active managed league.
    pub is_active: bool,
    /// Which phase id is currently active (for projection).
    pub active_phase_id: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::league::{FixtureCompetition, FixtureStatus};

    fn make_phase_fixtures(count: usize, offset: u32) -> Vec<Fixture> {
        (0..count)
            .map(|i| {
                let idx = offset + i as u32;
                Fixture {
                    id: format!("fixture-{}", idx),
                    matchday: idx + 1,
                    date: format!("2026-01-{:02}", (idx % 31) + 1),
                    home_team_id: format!("team-{}", (idx % 10)),
                    away_team_id: format!("team-{}", ((idx + 5) % 10)),
                    competition: FixtureCompetition::League,
                    best_of: 1,
                    status: FixtureStatus::Scheduled,
                    result: None,
                }
            })
            .collect()
    }

    fn make_standings(team_ids: &[&str]) -> Vec<StandingEntry> {
        team_ids
            .iter()
            .map(|tid| StandingEntry::new(tid.to_string()))
            .collect()
    }

    /// Two competitions with overlapping fixture IDs must not interfere.
    #[test]
    fn two_competitions_with_overlapping_fixture_ids() {
        let team_ids = ["team-1", "team-2", "team-3"];

        // Phase for LEC
        let mut lec_regular = CompetitionPhase::new(
            "lec-2026-regular".into(),
            "Regular Season".into(),
            PhaseType::RoundRobin,
        );
        lec_regular.fixtures = make_phase_fixtures(3, 0);
        lec_regular.standings = make_standings(&team_ids);

        let lec = Competition::new(
            "lec-2026".into(),
            "LEC 2026".into(),
            "lec-2026".into(),
            2026,
            "EMEA".into(),
            CompetitionTier::Regional,
            CompetitionRules::lec(),
            vec![lec_regular],
        );

        // Phase for CBLOL
        let mut cblol_regular = CompetitionPhase::new(
            "cblol-2026-regular".into(),
            "Regular Season".into(),
            PhaseType::RoundRobin,
        );
        cblol_regular.fixtures = make_phase_fixtures(3, 0); // same offset!
        cblol_regular.standings = make_standings(&team_ids);

        let cblol = Competition::new(
            "cblol-2026".into(),
            "CBLOL 2026".into(),
            "cblol-2026".into(),
            2026,
            "BRAZIL".into(),
            CompetitionTier::Regional,
            CompetitionRules::lec(),
            vec![cblol_regular],
        );

        // Verify independence: both have 3 fixtures with overlapping IDs
        assert_eq!(lec.phases[0].fixtures.len(), 3);
        assert_eq!(cblol.phases[0].fixtures.len(), 3);

        // They have the same fixture IDs (same offset) but different competition IDs
        assert_eq!(
            lec.phases[0].fixtures[0].id,
            cblol.phases[0].fixtures[0].id
        );
        assert_ne!(lec.id, cblol.id); // competition IDs are different

        // Standings are independent
        assert_eq!(lec.phases[0].standings.len(), 3);
        assert_eq!(cblol.phases[0].standings.len(), 3);

        // Different tiers
        assert_eq!(lec.tier, CompetitionTier::Regional);
        assert_eq!(cblol.tier, CompetitionTier::Regional);

        // Status is independent
        assert_eq!(lec.status, CompetitionStatus::NotStarted);
        assert_eq!(cblol.status, CompetitionStatus::NotStarted);
    }

    /// Standings and rules are independent per competition.
    #[test]
    fn independent_standings_and_rules() {
        let team_ids_a = ["team-a1", "team-a2"];
        let team_ids_b = ["team-b1", "team-b2", "team-b3"];

        let mut phase_a = CompetitionPhase::new("a-reg".into(), "Regular".into(), PhaseType::RoundRobin);
        phase_a.standings = make_standings(&team_ids_a);
        let mut phase_b = CompetitionPhase::new("b-reg".into(), "Regular".into(), PhaseType::RoundRobin);
        phase_b.standings = make_standings(&team_ids_b);

        let rules_a = CompetitionRules {
            teams_count: 2,
            ..CompetitionRules::default()
        };
        let rules_b = CompetitionRules {
            points_for_win: 2,
            teams_count: 3,
            ..CompetitionRules::default()
        };

        let comp_a = Competition::new(
            "comp-a".into(),
            "Comp A".into(),
            "comp-a".into(),
            2026,
            "REGION-A".into(),
            CompetitionTier::Regional,
            rules_a,
            vec![phase_a],
        );
        let comp_b = Competition::new(
            "comp-b".into(),
            "Comp B".into(),
            "comp-b".into(),
            2026,
            "REGION-B".into(),
            CompetitionTier::Cup,
            rules_b,
            vec![phase_b],
        );

        assert_eq!(comp_a.rules.teams_count, 2);
        assert_eq!(comp_a.rules.points_for_win, 3);

        assert_eq!(comp_b.rules.teams_count, 3);
        assert_eq!(comp_b.rules.points_for_win, 2);

        assert_eq!(comp_a.tier, CompetitionTier::Regional);
        assert_eq!(comp_b.tier, CompetitionTier::Cup);

        // 2 standings in comp_a, 3 in comp_b
        assert_eq!(comp_a.phases[0].standings.len(), 2);
        assert_eq!(comp_b.phases[0].standings.len(), 3);
    }

    /// Competition status lifecycle.
    #[test]
    fn status_lifecycle() {
        let mut comp = Competition::new(
            "test-cup".into(),
            "Test Cup".into(),
            "test-cup".into(),
            2026,
            "TEST".into(),
            CompetitionTier::Cup,
            CompetitionRules::default(),
            vec![],
        );

        assert_eq!(comp.status, CompetitionStatus::NotStarted);

        comp.status = CompetitionStatus::InProgress;
        assert_eq!(comp.status, CompetitionStatus::InProgress);

        comp.status = CompetitionStatus::Finished;
        assert_eq!(comp.status, CompetitionStatus::Finished);
    }
}
