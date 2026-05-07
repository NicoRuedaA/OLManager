/// Academy affiliation management.
///
/// Allows academies to be associated with specific competitions.
/// The affiliation determines which competition the academy's fixtures
/// are generated for and which standings they participate in.
use crate::game::Game;
use domain::team::{AcademyLifecycle, AcademyMetadata, ErlAssignment, ErlAssignmentRule, TeamKind};

/// Error returned when an affiliation operation fails.
#[derive(Debug)]
pub enum AffiliationError {
    NoAcademyTeam,
    TeamNotFound(String),
    CompetitionNotFound(String),
    NotAnAcademy(String),
}

/// Set the competition affiliation for a team's academy.
pub fn set_academy_competition(
    game: &mut Game,
    parent_team_id: &str,
    competition_id: &str,
) -> Result<(), AffiliationError> {
    let parent = game
        .teams
        .iter()
        .find(|t| t.id == parent_team_id)
        .ok_or_else(|| AffiliationError::TeamNotFound(parent_team_id.to_string()))?;

    let academy_id = parent.academy_team_id.clone().ok_or_else(|| {
        AffiliationError::NoAcademyTeam
    })?;

    let academy = game
        .teams
        .iter_mut()
        .find(|t| t.id == academy_id)
        .ok_or_else(|| AffiliationError::TeamNotFound(academy_id.clone()))?;

    if academy.team_kind != TeamKind::Academy {
        return Err(AffiliationError::NotAnAcademy(academy_id));
    }

    let metadata = academy.academy.get_or_insert_with(|| AcademyMetadata {
        lifecycle: AcademyLifecycle::Active,
        erl_assignment: ErlAssignment {
            erl_league_id: competition_id.to_string(),
            competition_id: Some(competition_id.to_string()),
            country_rule: ErlAssignmentRule::Domestic,
            fallback_reason: None,
            reputation: 50,
            acquisition_cost: 0,
            acquired_at: String::new(),
            creation_cost: 0,
            created_at: String::new(),
        },
        source_team_id: String::new(),
        original_name: String::new(),
        original_short_name: String::new(),
        original_logo_url: None,
        current_logo_url: None,
        acquisition_cost: 0,
        acquired_at: String::new(),
    });

    metadata.erl_assignment.competition_id = Some(competition_id.to_string());
    metadata.erl_assignment.erl_league_id = competition_id.to_string();

    log::info!(
        "[academy] set affiliation: academy '{}' -> competition '{}'",
        academy_id,
        competition_id
    );

    Ok(())
}

/// Get the competition affiliation for a team's academy.
pub fn get_academy_competition(game: &Game, parent_team_id: &str) -> Option<String> {
    let parent = game.teams.iter().find(|t| t.id == parent_team_id)?;
    let academy_id = parent.academy_team_id.as_ref()?;
    let academy = game.teams.iter().find(|t| t.id == *academy_id)?;
    let metadata = academy.academy.as_ref()?;
    metadata.erl_assignment.competition_id.clone()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::GameClock;
    use chrono::Utc;
    use domain::manager::Manager;

    fn make_test_game_with_academy() -> Game {
        let clock = GameClock::new(Utc::now());
        let mut game = Game::new(
            clock,
            Manager::new("mgr".into(), "Test".into(), "User".into(), "2000-01-01".into(), "US".into()),
            vec![],
            vec![],
            vec![],
            vec![],
        );
        // We add teams directly via the Game struct
        let team = domain::team::Team {
            id: "main-team".to_string(),
            name: "Main Team".to_string(),
            academy_team_id: Some("academy-team".to_string()),
            ..Default::default()
        };
        game.teams.push(team);

        let academy = domain::team::Team {
            id: "academy-team".to_string(),
            name: "Academy Team".to_string(),
            team_kind: TeamKind::Academy,
            academy: Some(AcademyMetadata {
                lifecycle: AcademyLifecycle::Active,
                erl_assignment: ErlAssignment {
                    erl_league_id: String::new(),
                    competition_id: None,
                    country_rule: ErlAssignmentRule::Domestic,
                    fallback_reason: None,
                    reputation: 50,
                    acquisition_cost: 0,
                    acquired_at: String::new(),
                    creation_cost: 0,
                    created_at: String::new(),
                },
                source_team_id: String::new(),
                original_name: String::new(),
                original_short_name: String::new(),
                original_logo_url: None,
                current_logo_url: None,
                acquisition_cost: 0,
                acquired_at: String::new(),
            }),
            ..Default::default()
        };
        game.teams.push(academy);
        game
    }

    #[test]
    fn set_affiliation_updates_competition_id() {
        let mut game = make_test_game_with_academy();
        set_academy_competition(&mut game, "main-team", "cblol").unwrap();
        let affiliation = get_academy_competition(&game, "main-team");
        assert_eq!(affiliation, Some("cblol".to_string()));
    }

    #[test]
    fn change_affiliation() {
        let mut game = make_test_game_with_academy();
        set_academy_competition(&mut game, "main-team", "lec").unwrap();
        set_academy_competition(&mut game, "main-team", "cblol").unwrap();
        let affiliation = get_academy_competition(&game, "main-team");
        assert_eq!(affiliation, Some("cblol".to_string()));
    }
}
