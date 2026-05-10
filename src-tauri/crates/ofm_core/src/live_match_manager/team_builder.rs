use crate::game::Game;
use crate::potential::calculate_lol_ovr;
use domain::player::LolRole as DomainLolRole;
use engine::{DraftStrategy, LolRole, PlayerData, TeamData};

// ---------------------------------------------------------------------------
// Domain → Engine conversion (LoL: 5 titulares + banca)
// ---------------------------------------------------------------------------

/// Convert domain::player::LolRole to engine::LolRole
fn to_engine_role(role: DomainLolRole) -> LolRole {
    match role {
        DomainLolRole::Top => LolRole::Top,
        DomainLolRole::Jungle => LolRole::Jungle,
        DomainLolRole::Mid => LolRole::Mid,
        DomainLolRole::Adc => LolRole::Adc,
        DomainLolRole::Support => LolRole::Support,
        DomainLolRole::Unknown => LolRole::Top,
    }
}

pub(super) fn build_team_with_bench(game: &Game, team_id: &str) -> (TeamData, Vec<PlayerData>) {
    let team = game.teams.iter().find(|t| t.id == team_id);
    let (name, draft_strategy) = match team {
        Some(t) => (
            t.name.clone(),
            match t.draft_strategy {
                domain::team::DraftStrategy::Aggressive => DraftStrategy::Aggressive,
                domain::team::DraftStrategy::Passive => DraftStrategy::Passive,
                domain::team::DraftStrategy::Scaling => DraftStrategy::Scaling,
                domain::team::DraftStrategy::CounterPick => DraftStrategy::CounterPick,
                domain::team::DraftStrategy::PriorityBans => DraftStrategy::PriorityBans,
                _ => DraftStrategy::Balanced,
            },
        ),
        None => ("Unknown".into(), DraftStrategy::Balanced),
    };

    // Collect all players for this team.
    // NOTE: Do not apply legacy injury filtering — rosters must not drop below 5
    // otherwise UI shows empty player slots.
    let available_players: Vec<&domain::player::Player> = game
        .players
        .iter()
        .filter(|p| p.team_id.as_deref() == Some(team_id))
        .collect();
    let mut ordered_players = available_players;
    ordered_players.sort_by(|left, right| {
        calculate_lol_ovr(right)
            .cmp(&calculate_lol_ovr(left))
            .then_with(|| right.condition.cmp(&left.condition))
    });

    let mut starters = ordered_players;
    let bench_domain = if starters.len() > 5 {
        starters.split_off(5)
    } else {
        Vec::new()
    };

    // Ensure unique roles: if the top 5 by OVR don't cover all 5 roles,
    // replace duplicates with the best available player of the missing role.
    let mut seen_roles = std::collections::HashSet::new();
    let mut uniq = Vec::with_capacity(5);
    let mut dup = Vec::new();
    let old_starters = std::mem::take(&mut starters);
    for player in old_starters {
        if seen_roles.insert(player.natural_position) {
            uniq.push(player);
        } else {
            dup.push(player);
        }
    }
    if uniq.len() < 5 {
        for player in bench_domain.iter() {
            if seen_roles.insert(player.natural_position) {
                uniq.push(player.clone());
            }
            if uniq.len() == 5 {
                break;
            }
        }
    }
    uniq.extend(dup);
    starters = uniq.into_iter().take(5).collect();

    // Keep LoL lane order stable for draft/pre-match UIs.
    // Selection stays top-5 by OVR+condition; this only reorders those five.
    starters.sort_by(|left, right| {
        lol_role_rank(&left.natural_position)
            .cmp(&lol_role_rank(&right.natural_position))
            .then_with(|| calculate_lol_ovr(right).cmp(&calculate_lol_ovr(left)))
            .then_with(|| right.condition.cmp(&left.condition))
    });

    let starting_xi = starters
        .into_iter()
        .map(to_engine_player)
        .collect::<Vec<_>>();
    let bench = bench_domain
        .into_iter()
        .map(to_engine_player)
        .collect::<Vec<_>>();

    let team_data = TeamData {
        id: team_id.to_string(),
        name,
        draft_strategy,
        players: starting_xi,
    };

    (team_data, bench)
}

fn to_engine_player(p: &domain::player::Player) -> PlayerData {
    PlayerData {
        id: p.id.clone(),
        name: p.match_name.clone(),
        role: to_engine_role(p.natural_position),
        condition: p.condition,
        fitness: p.fitness,
        // Map domain attributes to LoL-native engine structure
        mechanics: p.attributes.mechanics,
        laning: p.attributes.laning,
        teamfighting: p.attributes.teamfighting,
        macro_play: p.attributes.macro_play,
        consistency: p.attributes.consistency,
        shotcalling: p.attributes.shotcalling,
        champion_pool: p.attributes.champion_pool,
        discipline: p.attributes.discipline,
        mental_resilience: p.attributes.mental_resilience,
        traits: p.traits.iter().map(|t| format!("{:?}", t)).collect(),
    }
}

fn lol_role_rank(role: &DomainLolRole) -> u8 {
    match role {
        DomainLolRole::Top => 0,
        DomainLolRole::Jungle => 1,
        DomainLolRole::Mid => 2,
        DomainLolRole::Adc => 3,
        DomainLolRole::Support => 4,
        DomainLolRole::Unknown => 5,
    }
}

/// Auto-select team roles from a set of player IDs.
/// Returns (captain_id, shotcaller_id).
pub fn auto_select_team_roles(
    game: &Game,
    player_ids: &[String],
) -> (Option<String>, Option<String>) {
    let players: Vec<&domain::player::Player> = player_ids
        .iter()
        .filter_map(|id| game.players.iter().find(|p| &p.id == id))
        .collect();

    if players.is_empty() {
        return (None, None);
    }

    // Captain: highest leadership + teamwork
    let captain = players
        .iter()
        .max_by_key(|p| (p.attributes.shotcalling as u16) + (p.attributes.teamfighting as u16))
        .map(|p| p.id.clone());

    // Shotcaller: highest laning + macro_play + coordination (exclude Support)
    let shotcaller = players
        .iter()
        .filter(|p| p.position != DomainLolRole::Support)
        .max_by_key(|p| {
            (p.attributes.laning as u16)
                + (p.attributes.macro_play as u16)
                + (p.attributes.teamfighting as u16)
        })
        .map(|p| p.id.clone());

    (captain, shotcaller)
}
