use std::cmp::Ordering;

use super::{
    base_position_for, clamp, closest_lane_path_index, dist, lane_path_for, normalize,
    normalized_lane, normalized_team, ChampionRuntime, LanePressure, LaneRoleProfile,
    MinionRuntime, StructureRuntime, Vec2, FIRST_WAVE_CONTEST_UNTIL,
    LANE_EMPTY_ANCHOR_PROGRESS_MAX_INDEX, MINION_FIRST_WAVE_AT,
};

pub(super) fn lane_role_profile(champion: &ChampionRuntime) -> Option<LaneRoleProfile> {
    if champion.role == "JGL" {
        return None;
    }
    match champion.role.as_str() {
        "TOP" => Some(LaneRoleProfile {
            chase_leash: 0.11,
            approach_leash: 0.062,
            retreat_hp: 0.34,
            outnumber_tolerance: 0.25,
        }),
        "MID" => Some(LaneRoleProfile {
            chase_leash: 0.10,
            approach_leash: 0.058,
            retreat_hp: 0.36,
            outnumber_tolerance: 0.20,
        }),
        "ADC" => Some(LaneRoleProfile {
            chase_leash: 0.095,
            approach_leash: 0.058,
            retreat_hp: 0.44,
            outnumber_tolerance: 0.08,
        }),
        _ => Some(LaneRoleProfile {
            chase_leash: 0.09,
            approach_leash: 0.055,
            retreat_hp: 0.41,
            outnumber_tolerance: 0.08,
        }),
    }
}

pub(super) fn is_first_wave_contest_active(champion: &ChampionRuntime, now: f64) -> bool {
    if champion.role == "JGL" {
        return false;
    }
    now >= MINION_FIRST_WAVE_AT && now <= FIRST_WAVE_CONTEST_UNTIL
}

pub(super) fn choose_lane_anchor_index(
    champion: &ChampionRuntime,
    minions: &[MinionRuntime],
    structures: &[StructureRuntime],
) -> usize {
    let lane_path = lane_path_for(&champion.team, &champion.lane);
    if lane_path.is_empty() {
        return 0;
    }
    let lane_last_idx = lane_path.len().saturating_sub(1);
    if lane_last_idx == 0 {
        return 0;
    }

    let allied_front = minions
        .iter()
        .filter(|m| {
            m.alive
                && normalized_team(&m.team) == normalized_team(&champion.team)
                && normalized_lane(&m.lane) == normalized_lane(&champion.lane)
        })
        .max_by(|a, b| a.path_index.cmp(&b.path_index));

    if let Some(front) = allied_front {
        return front.path_index.saturating_sub(1).clamp(1, lane_last_idx);
    }

    let nearest_enemy_lane_minion = minions
        .iter()
        .filter(|m| {
            m.alive
                && normalized_team(&m.team) != normalized_team(&champion.team)
                && normalized_lane(&m.lane) == normalized_lane(&champion.lane)
        })
        .min_by(|a, b| {
            dist(a.pos, champion.pos)
                .partial_cmp(&dist(b.pos, champion.pos))
                .unwrap_or(Ordering::Equal)
        });

    if let Some(enemy_unit) = nearest_enemy_lane_minion {
        let enemy_idx = closest_lane_path_index(enemy_unit.pos, &lane_path);
        let allied_lane_tower = structures
            .iter()
            .filter(|s| {
                s.alive
                    && s.kind == "tower"
                    && normalized_team(&s.team) == normalized_team(&champion.team)
                    && normalized_lane(&s.lane) == normalized_lane(&champion.lane)
            })
            .min_by(|a, b| {
                dist(a.pos, champion.pos)
                    .partial_cmp(&dist(b.pos, champion.pos))
                    .unwrap_or(Ordering::Equal)
            });
        let wave_at_own_tower = allied_lane_tower
            .map(|tower| dist(enemy_unit.pos, tower.pos) <= 0.11)
            .unwrap_or(false);
        let offset = if wave_at_own_tower { 0 } else { 1 };
        return enemy_idx.saturating_sub(offset).clamp(1, lane_last_idx);
    }

    let current_index = closest_lane_path_index(champion.pos, &lane_path);
    let capped_current = current_index.min(LANE_EMPTY_ANCHOR_PROGRESS_MAX_INDEX);
    capped_current.clamp(1, lane_last_idx)
}

pub(super) fn lane_anchor_pos(
    champion: &ChampionRuntime,
    minions: &[MinionRuntime],
    structures: &[StructureRuntime],
) -> super::Vec2 {
    let lane_path = lane_path_for(&champion.team, &champion.lane);
    let idx = choose_lane_anchor_index(champion, minions, structures);
    lane_path
        .get(idx)
        .copied()
        .unwrap_or(base_position_for(&champion.team))
}

pub(super) fn lane_fallback_pos_from_tower(
    champion: &ChampionRuntime,
    tower_pos: Vec2,
    toward_base: bool,
) -> Vec2 {
    let lane_path = lane_path_for(&champion.team, &champion.lane);
    let tower_idx = closest_lane_path_index(tower_pos, &lane_path);
    let lane_target = if toward_base {
        lane_path
            .get(tower_idx.saturating_sub(1))
            .copied()
            .unwrap_or(base_position_for(&champion.team))
    } else {
        lane_path
            .get((tower_idx + 1).min(lane_path.len().saturating_sub(1)))
            .copied()
            .unwrap_or(tower_pos)
    };

    let dir = normalize(Vec2 {
        x: lane_target.x - tower_pos.x,
        y: lane_target.y - tower_pos.y,
    });
    let offset = if toward_base { 0.019 } else { 0.024 };
    Vec2 {
        x: clamp(tower_pos.x + dir.x * offset, 0.01, 0.99),
        y: clamp(tower_pos.y + dir.y * offset, 0.01, 0.99),
    }
}

pub(super) fn lane_pre_wave_hold_pos(champion: &ChampionRuntime, structures: &[StructureRuntime]) -> Vec2 {
    let lane_path = lane_path_for(&champion.team, &champion.lane);
    let allied_lane_tower = structures
        .iter()
        .filter(|s| {
            s.alive
                && s.kind == "tower"
                && normalized_team(&s.team) == normalized_team(&champion.team)
                && normalized_lane(&s.lane) == normalized_lane(&champion.lane)
        })
        .max_by(|a, b| {
            let idx_a = closest_lane_path_index(a.pos, &lane_path);
            let idx_b = closest_lane_path_index(b.pos, &lane_path);
            idx_a.cmp(&idx_b)
        });

    if let Some(tower) = allied_lane_tower {
        return lane_fallback_pos_from_tower(champion, tower.pos, false);
    }

    lane_path
        .get(2.min(lane_path.len().saturating_sub(1)))
        .copied()
        .unwrap_or(base_position_for(&champion.team))
}


pub(super) fn lane_wave_front_pos(
    champion: &ChampionRuntime,
    minions: &[MinionRuntime],
    structures: &[StructureRuntime],
) -> super::Vec2 {
    let mut allied: Vec<&MinionRuntime> = minions
        .iter()
        .filter(|m| {
            m.alive
                && normalized_team(&m.team) == normalized_team(&champion.team)
                && normalized_lane(&m.lane) == normalized_lane(&champion.lane)
        })
        .collect();
    allied.sort_by(|a, b| b.path_index.cmp(&a.path_index));
    allied.truncate(3);

    let mut enemy: Vec<&MinionRuntime> = minions
        .iter()
        .filter(|m| {
            m.alive
                && normalized_team(&m.team) != normalized_team(&champion.team)
                && normalized_lane(&m.lane) == normalized_lane(&champion.lane)
        })
        .collect();
    enemy.sort_by(|a, b| b.path_index.cmp(&a.path_index));
    enemy.truncate(3);

    let allied_wave = if allied.is_empty() {
        None
    } else {
        let sum = allied.iter().fold(super::Vec2 { x: 0.0, y: 0.0 }, |acc, m| super::Vec2 {
            x: acc.x + m.pos.x,
            y: acc.y + m.pos.y,
        });
        Some(super::Vec2 {
            x: sum.x / allied.len() as f64,
            y: sum.y / allied.len() as f64,
        })
    };

    let enemy_wave = if enemy.is_empty() {
        None
    } else {
        let sum = enemy.iter().fold(super::Vec2 { x: 0.0, y: 0.0 }, |acc, m| super::Vec2 {
            x: acc.x + m.pos.x,
            y: acc.y + m.pos.y,
        });
        Some(super::Vec2 {
            x: sum.x / enemy.len() as f64,
            y: sum.y / enemy.len() as f64,
        })
    };

    match (allied_wave, enemy_wave) {
        (Some(a), Some(e)) => super::Vec2 {
            x: (a.x + e.x) * 0.5,
            y: (a.y + e.y) * 0.5,
        },
        (Some(a), None) => a,
        (None, Some(e)) => e,
        (None, None) => lane_anchor_pos(champion, minions, structures),
    }
}

pub(super) fn lane_pressure_at(
    champion: &ChampionRuntime,
    pos: super::Vec2,
    champions: &[ChampionRuntime],
    minions: &[MinionRuntime],
    radius: f64,
) -> LanePressure {
    let ally_champions = champions
        .iter()
        .filter(|u| {
            u.alive
                && normalized_team(&u.team) == normalized_team(&champion.team)
                && dist(u.pos, pos) <= radius
        })
        .count();
    let enemy_champions = champions
        .iter()
        .filter(|u| {
            u.alive
                && normalized_team(&u.team) != normalized_team(&champion.team)
                && dist(u.pos, pos) <= radius
        })
        .count();
    let ally_lane_minions = minions
        .iter()
        .filter(|m| {
            m.alive
                && normalized_team(&m.team) == normalized_team(&champion.team)
                && normalized_lane(&m.lane) == normalized_lane(&champion.lane)
                && dist(m.pos, pos) <= radius
        })
        .count();
    let enemy_lane_minions = minions
        .iter()
        .filter(|m| {
            m.alive
                && normalized_team(&m.team) != normalized_team(&champion.team)
                && normalized_lane(&m.lane) == normalized_lane(&champion.lane)
                && dist(m.pos, pos) <= radius
        })
        .count();

    let ally_score = ally_champions as f64 * 1.25 + ally_lane_minions as f64 * 0.48;
    let enemy_score = enemy_champions as f64 * 1.25 + enemy_lane_minions as f64 * 0.48;

    LanePressure {
        ally_champions,
        enemy_champions,
        ally_lane_minions,
        enemy_lane_minions,
        ally_score,
        enemy_score,
    }
}

pub(super) fn lane_minion_context_distance(
    champion: &ChampionRuntime,
    pos: super::Vec2,
    minions: &[MinionRuntime],
) -> f64 {
    minions
        .iter()
        .filter(|m| m.alive && normalized_lane(&m.lane) == normalized_lane(&champion.lane))
        .map(|m| dist(pos, m.pos))
        .min_by(|a, b| a.partial_cmp(b).unwrap_or(Ordering::Equal))
        .unwrap_or(f64::INFINITY)
}
