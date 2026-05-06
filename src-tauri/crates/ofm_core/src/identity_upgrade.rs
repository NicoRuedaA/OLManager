use crate::game::Game;
use domain::identity::derive_birth_country_code;
use domain::player::Player;
use domain::staff::Staff;

/// Upgrade football identity fields.
/// With the LoL migration complete, `football_nation` is removed from domain types.
/// Only `birth_country` normalization remains active.
pub fn upgrade_game_football_identities(game: &mut Game) -> bool {
    let mut changed = false;

    // Also upgrade manager birth_country
    if let Some(bc) = normalize_birth_country(Some(game.manager.nationality.clone())) {
        if game.manager.birth_country != Some(bc.clone()) {
            game.manager.birth_country = Some(bc);
            changed = true;
        }
    }

    for player in game.players.iter_mut() {
        if let Some(bc) = normalize_birth_country(Some(player.nationality.clone())) {
            if player.birth_country != Some(bc.clone()) {
                player.birth_country = Some(bc);
                changed = true;
            }
        }
    }

    for staff in game.staff.iter_mut() {
        if let Some(bc) = normalize_birth_country(Some(staff.nationality.clone())) {
            if staff.birth_country != Some(bc.clone()) {
                staff.birth_country = Some(bc);
                changed = true;
            }
        }
    }

    changed
}

/// Upgrade world football identities (used by world export).
pub fn upgrade_world_football_identities(
    _teams: &mut [domain::team::Team],
    players: &mut [Player],
    staff: &mut [Staff],
) -> bool {
    let mut changed = false;

    for player in players.iter_mut() {
        if let Some(bc) = normalize_birth_country(Some(player.nationality.clone())) {
            if player.birth_country != Some(bc.clone()) {
                player.birth_country = Some(bc);
                changed = true;
            }
        }
    }

    for staff_member in staff.iter_mut() {
        if let Some(bc) = normalize_birth_country(Some(staff_member.nationality.clone())) {
            if staff_member.birth_country != Some(bc.clone()) {
                staff_member.birth_country = Some(bc);
                changed = true;
            }
        }
    }

    changed
}

/// Normalize birth country from a nationality string.
/// Uses derive_birth_country_code to map known nationalities.
/// If the function returns None (e.g., "GB" maps to None), returns None.
fn normalize_birth_country(value: Option<String>) -> Option<String> {
    match value {
        Some(v) if !v.trim().is_empty() => derive_birth_country_code(&v),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::GameClock;
    use crate::game::Game;
    use chrono::{TimeZone, Utc};
    use domain::manager::Manager;
    use domain::player::{LolRole, Player, PlayerAttributes};
    use domain::team::Team;

    fn sample_attrs() -> PlayerAttributes {
        PlayerAttributes {
            pace: 70,
            stamina: 70,
            strength: 70,
            agility: 70,
            passing: 70,
            shooting: 70,
            tackling: 70,
            dribbling: 70,
            defending: 70,
            positioning: 70,
            vision: 70,
            decisions: 70,
            composure: 70,
            aggression: 70,
            teamwork: 70,
            leadership: 70,
            handling: 20,
            reflexes: 20,
            aerial: 60,
        }
    }

    #[test]
    fn upgrade_game_football_identities_populates_birth_country() {
        let clock = GameClock::new(Utc.with_ymd_and_hms(2026, 7, 1, 0, 0, 0).unwrap());
        let mut manager = Manager::new(
            "mgr".to_string(),
            "Ada".to_string(),
            "Lovelace".to_string(),
            "1980-01-01".to_string(),
            "British".to_string(),
        );
        manager.hire("t1".to_string());

        let mut player = Player::new(
            "p1".to_string(),
            "J. Smith".to_string(),
            "John Smith".to_string(),
            "2000-01-01".to_string(),
            "English".to_string(),
            LolRole::Mid,
            sample_attrs(),
        );
        player.birth_country = None;
        player.team_id = Some("t1".to_string());

        let team = Team::new(
            "t1".to_string(),
            "London FC".to_string(),
            "LON".to_string(),
            "GB".to_string(),
            "London".to_string(),
            "Arena".to_string(),
            50000,
        );

        let mut game = Game::new(clock, manager, vec![team], vec![player], vec![], vec![]);
        game.players[0].birth_country = None;

        let changed = upgrade_game_football_identities(&mut game);

        assert!(changed);
        assert_eq!(game.players[0].birth_country, Some("ENG".to_string()));
    }
}
