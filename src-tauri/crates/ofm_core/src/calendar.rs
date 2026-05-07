/// Calendar generation for competitions.
///
/// Generates fixtures and standings from scheduling rules defined in a
/// competition manifest. No external calendar imports required.
use chrono::NaiveDate;
use domain::competition::{
    CompetitionPhase, PhaseStatus, PhaseType,
};
use domain::league::{Fixture, FixtureCompetition, FixtureStatus, StandingEntry};
use log::info;

/// Generated calendar output for a competition.
#[derive(Debug)]
pub struct GeneratedCalendar {
    pub phases: Vec<CompetitionPhase>,
}

/// Generate fixtures for a competition from its scheduling rules.
///
/// # Arguments
/// * `team_ids` - All team IDs participating in the competition.
/// * `phases` - Phase definitions with scheduling rules.
/// * `season_start` - The date the season starts (used as reference).
/// * `competition_id` - Used to generate unique fixture IDs.
///
/// Returns a `GeneratedCalendar` with populated phases containing
/// fixtures and empty standings.
pub fn generate_calendar(
    team_ids: &[String],
    phases: &[PhaseSchedule],
    season_start: NaiveDate,
    competition_id: &str,
) -> GeneratedCalendar {
    let mut result = Vec::new();

    for (pi, phase) in phases.iter().enumerate() {
        let standings: Vec<StandingEntry> = team_ids
            .iter()
            .map(|tid| StandingEntry::new(tid.clone()))
            .collect();

        let fixtures = match phase.phase_type {
            PhaseType::RoundRobin => {
                generate_round_robin_fixtures(team_ids, phase, season_start, competition_id, pi)
            }
            PhaseType::SingleElimination => {
                generate_single_elimination_fixtures(team_ids, phase, season_start, competition_id, pi)
            }
            PhaseType::GroupStage => {
                // Group stage not yet supported — return empty
                Vec::new()
            }
        };

        result.push(CompetitionPhase {
            id: format!("{}-phase-{}", competition_id, pi),
            name: phase.name.clone(),
            phase_type: phase.phase_type,
            status: PhaseStatus::NotStarted,
            standings,
            fixtures,
        });
    }

    GeneratedCalendar { phases: result }
}

/// Scheduling rules for a single phase.
#[derive(Debug, Clone)]
pub struct PhaseSchedule {
    pub name: String,
    pub phase_type: PhaseType,
    pub rounds: Option<u32>,
    pub double_round_robin: bool,
    pub best_of: u8,
    pub teams_count: Option<usize>,
    pub days: Vec<u8>,
    pub matches_per_day: u8,
    pub start_offset_days: u32,
}

impl PhaseSchedule {
    pub fn round_robin(name: &str, rounds: u32, days: Vec<u8>, matches_per_day: u8) -> Self {
        Self {
            name: name.to_string(),
            phase_type: PhaseType::RoundRobin,
            rounds: Some(rounds),
            double_round_robin: rounds > (u32::MAX / 2),
            best_of: 1,
            teams_count: None,
            days,
            matches_per_day,
            start_offset_days: 7,
        }
    }

    pub fn single_elim(name: &str, best_of: u8, teams_count: usize) -> Self {
        Self {
            name: name.to_string(),
            phase_type: PhaseType::SingleElimination,
            rounds: None,
            double_round_robin: false,
            best_of,
            teams_count: Some(teams_count),
            days: vec![6],
            matches_per_day: 1,
            start_offset_days: 0,
        }
    }
}

// ---------------------------------------------------------------------------
// Round-robin fixture generation (standard league format)
// ---------------------------------------------------------------------------

/// Generate a single round of pairings using the circle method.
fn round_robin_round(team_ids: &[String], round_index: u32) -> Vec<(String, String)> {
    let n = team_ids.len();
    if n < 2 {
        return Vec::new();
    }

    // Create a fixed list: first team stays, others rotate
    let mut ids: Vec<Option<String>> = team_ids.iter().cloned().map(Some).collect();
    if n % 2 == 1 {
        ids.push(None); // bye
    }

    let m = ids.len();
    let total_rounds = (m - 1) as u32;
    let effective = round_index % total_rounds;

    // Rotate: keep index 0 fixed, rotate the rest
    for _ in 0..effective {
        let last = ids.pop().unwrap_or(None);
        ids.insert(1, last);
    }

    let mut pairings = Vec::new();
    for i in 0..(m / 2) {
        let home = ids[i].clone();
        let away = ids[m - 1 - i].clone();
        if let (Some(h), Some(a)) = (home, away) {
            pairings.push((h, a));
        }
    }
    pairings
}

fn generate_round_robin_fixtures(
    team_ids: &[String],
    schedule: &PhaseSchedule,
    season_start: NaiveDate,
    competition_id: &str,
    phase_index: usize,
) -> Vec<Fixture> {
    let n = team_ids.len();
    if n < 2 {
        return Vec::new();
    }

    let single_leg_rounds = (n - 1) as u32;
    let legs: u32 = if schedule.double_round_robin { 2 } else { 1 };
    let total_rounds = schedule.rounds.unwrap_or(single_leg_rounds * legs);

    let mut fixtures = Vec::new();
    let mut fixture_counter = 0u32;

    for round in 0..total_rounds {
        let leg = round / single_leg_rounds; // 0 or 1
        let base_round = round % single_leg_rounds;

        // Get pairings for this round
        let mut pairings = round_robin_round(team_ids, base_round);

        // Second leg: swap home/away
        if leg == 1 {
            pairings = pairings.into_iter().map(|(h, a)| (a, h)).collect();
        }

        // Calculate date for this round
        let day_offset = schedule.start_offset_days as i64 + (round as i64 * 7);
        let round_date = season_start + chrono::Duration::days(day_offset);

        // If a specific day-of-week is requested, adjust
        let adjusted_date = if schedule.days.is_empty() {
            round_date
        } else {
            let target_dow = schedule.days[(round as usize) % schedule.days.len()];
            let current_dow = round_date.format("%u").to_string().parse::<u8>().unwrap_or(7) - 1;
            let diff = (target_dow as i64 - current_dow as i64 + 7) % 7;
            round_date + chrono::Duration::days(diff)
        };

        let date_str = adjusted_date.format("%Y-%m-%d").to_string();

        // Split pairings into matchdays
        for chunk in pairings.chunks(schedule.matches_per_day as usize) {
            for (home, away) in chunk {
                fixture_counter += 1;
                fixtures.push(Fixture {
                    id: format!("{}-phase{}-fix{}", competition_id, phase_index, fixture_counter),
                    matchday: round + 1,
                    date: date_str.clone(),
                    home_team_id: home.clone(),
                    away_team_id: away.clone(),
                    competition: FixtureCompetition::League,
                    best_of: schedule.best_of,
                    status: FixtureStatus::Scheduled,
                    result: None,
                });
            }
        }
    }

    info!(
        "[calendar] generated {} fixtures for phase '{}'",
        fixtures.len(),
        schedule.name
    );

    fixtures
}

// ---------------------------------------------------------------------------
// Single-elimination bracket generation
// ---------------------------------------------------------------------------

fn generate_single_elimination_fixtures(
    team_ids: &[String],
    schedule: &PhaseSchedule,
    season_start: NaiveDate,
    competition_id: &str,
    phase_index: usize,
) -> Vec<Fixture> {
    let count = schedule.teams_count.unwrap_or(team_ids.len().min(8));
    if count < 2 {
        return Vec::new();
    }

    let teams: Vec<&String> = team_ids.iter().take(count).collect();
    let next_pow2 = (count as f64).log2().ceil() as u32;
    let byes = 2usize.pow(next_pow2) - count;

    let mut fixtures = Vec::new();
    let mut fixture_idx = 0u32;
    let mut remaining = count;
    let mut round = 0u32;

    while remaining > 1 {
        let matches_this_round = if round == 0 && byes > 0 {
            (remaining - byes) / 2
        } else {
            remaining / 2
        };

        if matches_this_round < 1 {
            break;
        }

        let day_offset = schedule.start_offset_days as i64 + (round as i64 * 7);
        let match_date = season_start + chrono::Duration::days(day_offset);
        let date_str = match_date.format("%Y-%m-%d").to_string();

        for i in 0..matches_this_round {
            fixture_idx += 1;

            let (home, away) = if round == 0 {
                let playing_teams = &teams[byes..];
                (playing_teams[i].clone(), playing_teams[playing_teams.len() - 1 - i].clone())
            } else {
                ("TBD".to_string(), "TBD".to_string())
            };

            fixtures.push(Fixture {
                id: format!("{}-phase{}-elim{}", competition_id, phase_index, fixture_idx),
                matchday: round + 1,
                date: date_str.clone(),
                home_team_id: home,
                away_team_id: away,
                competition: FixtureCompetition::Playoffs,
                best_of: schedule.best_of,
                status: FixtureStatus::Scheduled,
                result: None,
            });
        }

        // Calculate next round's remaining teams
        if round == 0 {
            remaining = matches_this_round + byes;
        } else {
            remaining = matches_this_round;
        }
        round += 1;
    }

    info!(
        "[calendar] generated {} single-elimination fixtures for phase '{}'",
        fixtures.len(),
        schedule.name
    );

    fixtures
}

/// Build a `PhaseSchedule` from a manifest phase definition.
pub fn phase_schedule_from_manifest(
    name: &str,
    phase_type: &str,
    rounds: Option<u32>,
    double_round_robin: Option<bool>,
    best_of: Option<u8>,
    teams_count: Option<usize>,
    days: Option<Vec<u8>>,
    matches_per_day: Option<u8>,
    start_offset_days: Option<u32>,
) -> PhaseSchedule {
    let ptype = match phase_type {
        "RoundRobin" => PhaseType::RoundRobin,
        "SingleElimination" => PhaseType::SingleElimination,
        "GroupStage" => PhaseType::GroupStage,
        _ => PhaseType::RoundRobin,
    };

    PhaseSchedule {
        name: name.to_string(),
        phase_type: ptype,
        rounds,
        double_round_robin: double_round_robin.unwrap_or(false),
        best_of: best_of.unwrap_or(1),
        teams_count,
        days: days.unwrap_or_else(|| vec![6]),
        matches_per_day: matches_per_day.unwrap_or(5),
        start_offset_days: start_offset_days.unwrap_or(7),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
use chrono::NaiveDate;

    #[test]
    fn round_robin_10_teams_double() {
        let team_ids: Vec<String> = (1..=10).map(|i| format!("team-{}", i)).collect();
        let schedule = PhaseSchedule {
            name: "Regular".into(),
            phase_type: PhaseType::RoundRobin,
            rounds: Some(18),
            double_round_robin: true,
            best_of: 1,
            teams_count: None,
            days: vec![6, 0],
            matches_per_day: 5,
            start_offset_days: 7,
        };

        let start = NaiveDate::from_ymd_opt(2026, 1, 12).unwrap();
        let calendar = generate_calendar(
            &team_ids,
            &[schedule],
            start,
            "test-league",
        );

        assert_eq!(calendar.phases.len(), 1);
        let fixtures = &calendar.phases[0].fixtures;
        assert!(!fixtures.is_empty(), "should generate fixtures");

        // 10 teams, double RR = 18 rounds, 5 matches per round = 90 matches
        assert_eq!(fixtures.len(), 90, "10 teams double RR should give 90 fixtures");

        // Verify each fixture has a unique ID
        let mut ids: std::collections::HashSet<&str> = std::collections::HashSet::new();
        for f in fixtures {
            assert!(ids.insert(&f.id), "duplicate fixture id: {}", f.id);
        }

        // Verify standings are initialized
        let standings = &calendar.phases[0].standings;
        assert_eq!(standings.len(), 10);
    }

    #[test]
    fn single_elimination_6_teams() {
        let team_ids: Vec<String> = (1..=10).map(|i| format!("team-{}", i)).collect();
        let schedule = PhaseSchedule {
            name: "Playoffs".into(),
            phase_type: PhaseType::SingleElimination,
            rounds: None,
            double_round_robin: false,
            best_of: 5,
            teams_count: Some(6),
            days: vec![6],
            matches_per_day: 1,
            start_offset_days: 0,
        };

        let start = NaiveDate::from_ymd_opt(2026, 3, 15).unwrap();
        let calendar = generate_calendar(
            &team_ids,
            &[schedule],
            start,
            "test-league",
        );

        let fixtures = &calendar.phases[0].fixtures;
        // 6 teams single elim = 5 matches
        assert_eq!(fixtures.len(), 5, "6-team single elim should give 5 fixtures");

        // First round should have 3 pairings, second round 2 (semis), final 0 (but TBD placeholders)
        for f in fixtures {
            assert_eq!(f.best_of, 5);
        }
    }

    #[test]
    fn cblol_generates_same_fixture_count_as_lec() {
        let team_ids: Vec<String> = (1..=10).map(|i| format!("team-{}", i)).collect();
        let schedule = PhaseSchedule {
            name: "Regular".into(),
            phase_type: PhaseType::RoundRobin,
            rounds: Some(18),
            double_round_robin: true,
            best_of: 1,
            teams_count: None,
            days: vec![6, 0],
            matches_per_day: 5,
            start_offset_days: 7,
        };

        let start = NaiveDate::from_ymd_opt(2026, 1, 12).unwrap();
        let calendar = generate_calendar(&team_ids, &[schedule], start, "cblol");

        assert_eq!(calendar.phases[0].fixtures.len(), 90);
    }

    #[test]
    fn standings_initialized_for_all_teams() {
        let team_ids: Vec<String> = (1..=6).map(|i| format!("team-{}", i)).collect();
        let schedule = PhaseSchedule {
            name: "Regular".into(),
            phase_type: PhaseType::RoundRobin,
            rounds: Some(10),
            double_round_robin: false,
            best_of: 1,
            teams_count: None,
            days: vec![6],
            matches_per_day: 3,
            start_offset_days: 7,
        };

        let start = NaiveDate::from_ymd_opt(2026, 1, 19).unwrap();
        let calendar = generate_calendar(&team_ids, &[schedule], start, "test");

        let standings = &calendar.phases[0].standings;
        assert_eq!(standings.len(), 6);
        for entry in standings {
            assert_eq!(entry.played, 0);
            assert_eq!(entry.points, 0);
        }
    }
}
