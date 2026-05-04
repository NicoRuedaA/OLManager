use domain::player::{LolRole, Player};

/// Returns the 5 starting positions for a team in LoL format.
/// In LoL, the formation is always 5 players: Top, Jungle, Mid, ADC, Support
pub fn formation_slots(_formation: &str) -> Vec<LolRole> {
    // LoL always uses 5 roles - ignore formation string for now
    // TODO: Implement proper LoL team composition
    vec![
        LolRole::Top,     // Top lane
        LolRole::Jungle,  // Jungle
        LolRole::Mid,     // Mid lane
        LolRole::Adc,     // ADC (Bot lane carry)
        LolRole::Support, // Support
    ]
}

fn formation_slot_rows(formation: &str) -> Vec<Vec<LolRole>> {
    let slots = formation_slots(formation);
    vec![slots]
}

/// Calculate overall rating for a player at a specific LolRole
pub fn ovr_for_position(player: &Player, _role: &LolRole) -> f64 {
    natural_ovr(player)
}

pub fn effective_rating_for_assignment(player: &Player, slot_role: &LolRole) -> f64 {
    let base = ovr_for_position(player, slot_role);
    let compat = compatibility_penalty(player, slot_role);
    let foot = footedness_penalty(player, slot_role);
    base - compat - foot
}

fn defender_line(count: usize) -> Vec<LolRole> {
    match count {
        1 => vec![LolRole::Top],
        2 => vec![LolRole::Top, LolRole::Top],
        3 => vec![LolRole::Top, LolRole::Top, LolRole::Top],
        4 => vec![LolRole::Top, LolRole::Top, LolRole::Top, LolRole::Top],
        _ => vec![LolRole::Top; count],
    }
}

fn midfield_line(count: usize) -> Vec<LolRole> {
    match count {
        1 => vec![LolRole::Jungle],
        2 => vec![LolRole::Jungle, LolRole::Mid],
        3 => vec![LolRole::Jungle, LolRole::Mid, LolRole::Adc],
        4 => vec![
            LolRole::Jungle,
            LolRole::Mid,
            LolRole::Adc,
            LolRole::Support,
        ],
        _ => vec![LolRole::Jungle; count],
    }
}

fn forward_line(count: usize) -> Vec<LolRole> {
    match count {
        1 => vec![LolRole::Adc],
        2 => vec![LolRole::Adc, LolRole::Support],
        _ => vec![LolRole::Adc; count],
    }
}

pub fn natural_ovr(player: &Player) -> f64 {
    let attrs = &player.attributes;
    // Simplified OVR calculation for LoL
    // Weighted average of key attributes
    weighted_average(&[
        (attrs.passing, 0.10),
        (attrs.shooting, 0.15),
        (attrs.dribbling, 0.15),
        (attrs.vision, 0.10),
        (attrs.decisions, 0.15),
        (attrs.composure, 0.10),
        (attrs.teamwork, 0.10),
        (attrs.positioning, 0.15),
    ])
}

fn primary_position(player: &Player) -> LolRole {
    player.natural_position
}

fn canonical_position(position: &LolRole) -> LolRole {
    // LolRole is already canonical - no conversion needed
    *position
}

fn compatibility_penalty(player: &Player, slot_role: &LolRole) -> f64 {
    let primary = primary_position(player);
    if &primary == slot_role {
        return 0.0;
    }

    let alternates: Vec<LolRole> = player.alternate_positions.clone();

    if alternates.iter().any(|role| role == slot_role) {
        4.0
    } else if role_compatibility(&primary, slot_role) {
        8.0
    } else {
        14.0
    }
}

fn role_compatibility(primary: &LolRole, slot: &LolRole) -> bool {
    // Define role compatibility groups
    match (primary, slot) {
        // Top can flex to Jungle, Mid
        (LolRole::Top, LolRole::Top | LolRole::Jungle | LolRole::Mid) => true,
        // Jungle can flex to Top, Mid
        (LolRole::Jungle, LolRole::Jungle | LolRole::Top | LolRole::Mid) => true,
        // Mid can flex to Top, Jungle, ADC
        (LolRole::Mid, LolRole::Mid | LolRole::Top | LolRole::Jungle | LolRole::Adc) => true,
        // ADC can flex to Mid
        (LolRole::Adc, LolRole::Adc | LolRole::Mid) => true,
        // Support is most flexible (can play any role)
        (LolRole::Support, _) => true,
        // Unknown can't play anywhere
        (LolRole::Unknown, _) => false,
        // Exact match handled earlier
        _ => false,
    }
}

fn footedness_penalty(_player: &Player, _slot_role: &LolRole) -> f64 {
    // Footedness doesn't apply to LoL - return 0
    // TODO: Consider lane preference (top/mid prefer right side, bot prefer left)
    0.0
}

fn weighted_score(player: &Player, _role: &LolRole) -> f64 {
    natural_ovr(player)
}

fn weighted_average(scores: &[(u8, f64)]) -> f64 {
    let total_weight: f64 = scores.iter().map(|(_, w)| w).sum();
    let weighted_sum: f64 = scores.iter().map(|(s, w)| (*s as f64) * w).sum();
    weighted_sum / total_weight
}

fn weighted_sum(weights: &[(u8, i32)]) -> i32 {
    weights.iter().map(|(v, w)| (*v as i32) * w).sum()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Side {
    Left,
    Right,
}

fn slot_side(_role: &LolRole) -> Option<Side> {
    // In LoL, there's no left/right distinction like football
    None
}

fn critical_penalty(player: &Player, _role: &LolRole) -> f64 {
    let _attrs = &player.attributes;
    // No critical position penalty in LoL
    0.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::player::{PlayerAttributes, Position};

    fn make_player(role: LolRole) -> Player {
        let attrs = PlayerAttributes {
            pace: 70,
            stamina: 75,
            strength: 65,
            agility: 72,
            passing: 80,
            shooting: 60,
            tackling: 55,
            dribbling: 68,
            defending: 50,
            positioning: 65,
            vision: 78,
            decisions: 70,
            composure: 60,
            aggression: 55,
            teamwork: 80,
            leadership: 45,
            handling: 20,
            reflexes: 25,
            aerial: 40,
        };
        Player::new(
            "test-1".to_string(),
            "Test Player".to_string(),
            "Test Player Full".to_string(),
            "2000-01-15".to_string(),
            "US".to_string(),
            role,
            attrs,
        )
    }

    #[test]
    fn formation_slots_returns_five_roles() {
        let slots = formation_slots("any-formation");
        assert_eq!(slots.len(), 5);
        assert_eq!(
            slots,
            vec![
                LolRole::Top,
                LolRole::Jungle,
                LolRole::Mid,
                LolRole::Adc,
                LolRole::Support,
            ]
        );
    }

    #[test]
    fn ovr_for_position_returns_natural_ovr() {
        let player = make_player(LolRole::Mid);
        let ovr = ovr_for_position(&player, &LolRole::Mid);
        let natural = natural_ovr(&player);
        assert!((ovr - natural).abs() < 0.001);
    }

    #[test]
    fn compatibility_penalty_exact_match() {
        let player = make_player(LolRole::Mid);
        let penalty = compatibility_penalty(&player, &LolRole::Mid);
        assert_eq!(penalty, 0.0);
    }

    #[test]
    fn effective_rating_for_assignment() {
        let player = make_player(LolRole::Mid);
        let rating = super::effective_rating_for_assignment(&player, &LolRole::Mid);
        assert!(rating > 0.0);
    }
}
