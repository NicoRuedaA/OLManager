/// Competition Runner
///
/// Processes due fixtures for all competitions in a save.
/// The player's active competition is handled separately (via `game.league`).
/// Background competitions are auto-simulated.
use crate::game::Game;
use domain::league::{FixtureStatus, MatchResult};
use engine::{MatchConfig, TeamData};
use log::{debug, info};

/// Process all competitions for the current day.
///
/// For the active competition (the one the user manages), this is a no-op —
/// the existing `game.league` flow handles it.
///
/// For background competitions, all fixtures scheduled for `today` that are
/// not yet completed are simulated and their results applied.
pub fn process_competitions(game: &mut Game, today: &str) {
    let active_id = game
        .competitions
        .iter()
        .find(|c| c.runtime.is_active)
        .map(|c| c.id.clone());

    // Collect due fixture metadata from all background competitions
    let mut all_due: Vec<(usize, usize, usize, String, String)> = Vec::new();
    for (ci, competition) in game.competitions.iter().enumerate() {
        if Some(&competition.id) == active_id.as_ref() {
            continue; // skip active — handled by game.league flow
        }
        for (pi, phase) in competition.phases.iter().enumerate() {
            for (fi, fixture) in phase.fixtures.iter().enumerate() {
                if fixture.date == today && fixture.status == FixtureStatus::Scheduled {
                    all_due.push((ci, pi, fi, fixture.home_team_id.clone(), fixture.away_team_id.clone()));
                }
            }
        }
    }

    if all_due.is_empty() {
        return;
    }

    info!("[comp_runner] {} background fixture(s) to simulate", all_due.len());

    // Build engine teams and simulate (immutable borrow of game)
    let results: Vec<(usize, usize, usize, engine::MatchReport)> = all_due
        .iter()
        .map(|(ci, pi, fi, home_id, away_id)| {
            let home_data = build_engine_team_for_competition(game, home_id);
            let away_data = build_engine_team_for_competition(game, away_id);
            let mut rng = rand::rng();
            let report = engine::simulate_lol(&home_data, &away_data, &MatchConfig::default(), &mut rng);
            (*ci, *pi, *fi, report)
        })
        .collect();

    // Apply results back to competitions (mutable borrow of game.competitions)
    for (ci, pi, fi, report) in results {
        let Some(competition) = game.competitions.get_mut(ci) else { continue };
        let Some(phase) = competition.phases.get_mut(pi) else { continue };
        let Some(fixture) = phase.fixtures.get_mut(fi) else { continue };

        let home_id = fixture.home_team_id.clone();
        let away_id = fixture.away_team_id.clone();

        fixture.status = FixtureStatus::Completed;
        fixture.result = Some(MatchResult {
            home_wins: report.home_wins,
            away_wins: report.away_wins,
            ..MatchResult::default()
        });

        // Update standings
        for entry in phase.standings.iter_mut() {
            if entry.team_id == home_id {
                entry.record_result(report.home_wins, report.away_wins);
            } else if entry.team_id == away_id {
                entry.record_result(report.away_wins, report.home_wins);
            }
        }

        debug!(
            "[comp_runner] {}: {} {} - {} {}",
            competition.name,
            home_id,
            report.home_wins,
            report.away_wins,
            away_id,
        );
    }
}

/// Build an engine TeamData from the game's team + player data.
fn build_engine_team_for_competition(game: &Game, team_id: &str) -> TeamData {
    let team = game.teams.iter().find(|t| t.id == team_id);
    let (name, formation, play_style) = match team {
        Some(t) => (
            t.name.clone(),
            t.formation.clone(),
            match t.play_style {
                domain::team::PlayStyle::Attacking => engine::PlayStyle::Attacking,
                domain::team::PlayStyle::Defensive => engine::PlayStyle::Defensive,
                domain::team::PlayStyle::Possession => engine::PlayStyle::Possession,
                domain::team::PlayStyle::Counter => engine::PlayStyle::Counter,
                domain::team::PlayStyle::HighPress => engine::PlayStyle::HighPress,
                _ => engine::PlayStyle::Balanced,
            },
        ),
        None => ("Unknown".into(), "4-4-2".into(), engine::PlayStyle::Balanced),
    };

    let players: Vec<engine::PlayerData> = game
        .players
        .iter()
        .filter(|p| p.team_id.as_deref() == Some(team_id))
        .map(|p| {
            // Map domain attributes to engine PlayerData
            use crate::turn::to_engine_role;
            engine::PlayerData {
                id: p.id.clone(),
                name: p.match_name.clone(),
                role: to_engine_role(p.natural_position),
                condition: p.condition,
                fitness: p.fitness,
                pace: p.attributes.pace,
                stamina: p.attributes.stamina,
                strength: p.attributes.strength,
                agility: p.attributes.agility,
                passing: p.attributes.passing,
                shooting: p.attributes.shooting,
                tackling: p.attributes.tackling,
                dribbling: p.attributes.dribbling,
                defending: p.attributes.defending,
                positioning: p.attributes.positioning,
                vision: p.attributes.vision,
                decisions: p.attributes.decisions,
                composure: p.attributes.composure,
                aggression: p.attributes.aggression,
                teamwork: p.attributes.teamwork,
                leadership: p.attributes.leadership,
                handling: p.attributes.handling,
                reflexes: p.attributes.reflexes,
                aerial: p.attributes.aerial,
                traits: p.traits.iter().map(|t| format!("{:?}", t)).collect(),
            }
        })
        .collect();

    TeamData {
        id: team_id.to_string(),
        name,
        formation,
        play_style,
        players,
    }
}

/// Check if the active competition has at least one fixture scheduled for today.
pub fn active_competition_has_match_today(game: &Game, today: &str) -> bool {
    game.competitions
        .iter()
        .filter(|c| c.runtime.is_active)
        .any(|c| {
            c.phases.iter().any(|phase| {
                phase
                    .fixtures
                    .iter()
                    .any(|f| f.date == today && f.status == FixtureStatus::Scheduled)
            })
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::competition::{
        Competition, CompetitionPhase, CompetitionRules, CompetitionRuntime, CompetitionStatus,
        CompetitionTier, PhaseStatus, PhaseType,
    };
    use domain::league::{Fixture, FixtureCompetition, League, StandingEntry};

    fn make_background_comp(id: &str, team_ids: &[&str], today: &str) -> Competition {
        let standings: Vec<StandingEntry> = team_ids
            .iter()
            .map(|tid| StandingEntry::new(tid.to_string()))
            .collect();
        let fixtures: Vec<Fixture> = team_ids
            .chunks(2)
            .filter_map(|pair| {
                if pair.len() < 2 {
                    return None;
                }
                Some(Fixture {
                    id: format!("{}-fix", id),
                    matchday: 1,
                    date: today.into(),
                    home_team_id: pair[0].to_string(),
                    away_team_id: pair[1].to_string(),
                    competition: FixtureCompetition::League,
                    best_of: 1,
                    status: FixtureStatus::Scheduled,
                    result: None,
                })
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
            name: format!("Cmp {id}"),
            slug: id.into(),
            season: 2026,
            region: "TEST".into(),
            tier: CompetitionTier::Regional,
            status: CompetitionStatus::InProgress,
            rules: CompetitionRules::default(),
            phases: vec![phase],
            runtime: CompetitionRuntime {
                has_manual_overrides: false,
                next_matchday: 1,
                is_active: false,
                active_phase_id: Some(format!("{id}-regular")),
            },
        }
    }

    /// Fixtures scheduled for today are completed after processing.
    #[test]
    fn background_fixtures_get_simulated() {
        use crate::clock::GameClock;
        use chrono::Utc;
        use domain::manager::Manager;
        use domain::player::{LolRole, Player, PlayerAttributes};

        let clock = GameClock::new(Utc::now());
        let today = clock.current_date.format("%Y-%m-%d").to_string();

        let mut game = Game::new(
            clock,
            Manager::new("mgr-1".into(), "Test".into(), "Manager".into(), "2000-01-01".into(), "US".into()),
            vec![],
            vec![],
            vec![],
            vec![],
        );

        let comp = make_background_comp("bg-test", &["team-a", "team-b"], &today);
        game.competitions.push(comp);

        process_competitions(&mut game, &today);

        let comp = &game.competitions[0];
        let fixture = &comp.phases[0].fixtures[0];
        assert_eq!(fixture.status, FixtureStatus::Completed);
        assert!(fixture.result.is_some());

        let result = fixture.result.as_ref().unwrap();
        // Either team won or it was a tie
        assert!(result.home_wins > 0 || result.away_wins > 0);
    }

    /// Active competition is skipped by the runner.
    #[test]
    fn active_competition_is_not_processed() {
        use crate::clock::GameClock;
        use chrono::Utc;
        use domain::manager::Manager;

        let clock = GameClock::new(Utc::now());
        let today = clock.current_date.format("%Y-%m-%d").to_string();

        let mut game = Game::new(
            clock,
            Manager::new("mgr-1".into(), "Test".into(), "Manager".into(), "2000-01-01".into(), "US".into()),
            vec![],
            vec![],
            vec![],
            vec![],
        );

        let mut active = make_background_comp("active", &["team-a", "team-b"], &today);
        active.runtime.is_active = true;
        game.competitions.push(active);

        process_competitions(&mut game, &today);

        let comp = &game.competitions[0];
        let fixture = &comp.phases[0].fixtures[0];
        // Active competition fixture should NOT be simulated
        assert_eq!(fixture.status, FixtureStatus::Scheduled);
    }
}
