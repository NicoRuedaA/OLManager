use rand::Rng;

use crate::live_match::LiveMatchState;
use crate::report::MatchReport;
use crate::types::MatchConfig;
use crate::types::TeamData;

/// Simulate a LoL match to completion with the given RNG and return the match report.
pub fn simulate_lol<R: Rng>(
    home: &TeamData,
    away: &TeamData,
    config: &MatchConfig,
    rng: &mut R,
) -> MatchReport {
    let state = LiveMatchState::new(
        home.clone(),
        away.clone(),
        config.clone(),
        vec![],
        vec![],
        false,
    );
    state.run_to_completion(rng)
}
