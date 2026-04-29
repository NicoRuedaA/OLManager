use std::cmp::Ordering;

use super::{
    base_position_for, clamp, dist, is_first_wave_contest_active, lane_fallback_pos_from_tower,
    lane_farm_anchor_pos_v2, lane_path_for, lane_pressure_at, lane_role_profile,
    lane_wave_front_pos, normalize, normalized_lane, normalized_team, ChampionRuntime,
    MinionRuntime, StructureRuntime, Vec2, LANE_HEALTHY_RETREAT_HP_RATIO,
    LANE_LOCAL_PRESSURE_RADIUS, LANE_STRONG_UNFAVORABLE_PRESSURE_DELTA, RECALL_CHANNEL_SEC,
    RECALL_REACH_BUFFER_SEC, RECALL_SAFE_ENEMY_RADIUS,
};

pub(super) fn nearest_enemy_champion_snapshot<'a>(
    champion: &ChampionRuntime,
    champions: &'a [ChampionRuntime],
    radius: f64,
) -> Option<&'a ChampionRuntime> {
    champions
        .iter()
        .filter(|enemy| {
            enemy.alive
                && enemy.id != champion.id
                && normalized_team(&enemy.team) != normalized_team(&champion.team)
                && dist(enemy.pos, champion.pos) <= radius
        })
        .min_by(|a, b| {
            dist(a.pos, champion.pos)
                .partial_cmp(&dist(b.pos, champion.pos))
                .unwrap_or(Ordering::Equal)
                .then_with(|| a.id.cmp(&b.id))
        })
}

pub(super) fn should_recall_in_place(champion: &ChampionRuntime, champions: &[ChampionRuntime]) -> bool {
    let nearest = nearest_enemy_champion_snapshot(champion, champions, RECALL_SAFE_ENEMY_RADIUS);
    let Some(enemy) = nearest else {
        return true;
    };
    let d = dist(champion.pos, enemy.pos);
    let enemy_reach_time = d / enemy.move_speed.max(0.01);
    enemy_reach_time > RECALL_CHANNEL_SEC + RECALL_REACH_BUFFER_SEC
}

pub(super) fn recall_fallback_toward_base(
    champion: &ChampionRuntime,
    threat: Option<&ChampionRuntime>,
) -> Vec2 {
    let base = base_position_for(&champion.team);

    let direction = if let Some(enemy) = threat {
        let away = normalize(Vec2 {
            x: champion.pos.x - enemy.pos.x,
            y: champion.pos.y - enemy.pos.y,
        });
        let toward_base = normalize(Vec2 {
            x: base.x - champion.pos.x,
            y: base.y - champion.pos.y,
        });
        normalize(Vec2 {
            x: away.x * 0.8 + toward_base.x * 0.2,
            y: away.y * 0.8 + toward_base.y * 0.2,
        })
    } else {
        normalize(Vec2 {
            x: base.x - champion.pos.x,
            y: base.y - champion.pos.y,
        })
    };

    let step = if champion.role == "JGL" { 0.05 } else { 0.04 };
    Vec2 {
        x: clamp(champion.pos.x + direction.x * step, 0.01, 0.99),
        y: clamp(champion.pos.y + direction.y * step, 0.01, 0.99),
    }
}

pub(super) fn weakest_enemy_lane_for_team(
    structures: &[StructureRuntime],
    team: &str,
) -> Option<&'static str> {
    let enemy = if normalized_team(team) == "blue" {
        "red"
    } else {
        "blue"
    };
    let lane_count = |lane: &str| -> usize {
        structures
            .iter()
            .filter(|structure| {
                structure.alive
                    && structure.kind == "tower"
                    && normalized_team(&structure.team) == enemy
                    && normalized_lane(&structure.lane) == lane
            })
            .count()
    };

    let top = lane_count("top");
    let mid = lane_count("mid");
    let bot = lane_count("bot");

    if top <= mid && top <= bot {
        Some("top")
    } else if mid <= top && mid <= bot {
        Some("mid")
    } else {
        Some("bot")
    }
}

pub(super) fn baron_push_target_for_lane(
    structures: &[StructureRuntime],
    team: &str,
    lane: &str,
    is_targetable: impl Fn(&[StructureRuntime], &str, &StructureRuntime) -> bool,
) -> Option<Vec2> {
    let enemy = if normalized_team(team) == "blue" {
        "red"
    } else {
        "blue"
    };
    let lane_tower = structures
        .iter()
        .filter(|structure| {
            structure.alive
                && structure.kind == "tower"
                && normalized_team(&structure.team) == enemy
                && normalized_lane(&structure.lane) == lane
        })
        .min_by(|a, b| a.id.cmp(&b.id));

    if let Some(tower) = lane_tower {
        return Some(tower.pos);
    }

    let lane_inhib = structures.iter().find(|structure| {
        structure.alive
            && normalized_team(&structure.team) == enemy
            && structure.kind == "inhib"
            && structure.id.contains(lane)
            && is_targetable(structures, team, structure)
    });

    if let Some(inhib) = lane_inhib {
        return Some(inhib.pos);
    }

    let nexus_tower = structures.iter().find(|structure| {
        structure.alive
            && normalized_team(&structure.team) == enemy
            && structure.kind == "tower"
            && structure.lane == "base"
            && structure.id.contains("nexus")
            && is_targetable(structures, team, structure)
    });

    if let Some(tower) = nexus_tower {
        return Some(tower.pos);
    }

    structures
        .iter()
        .find(|structure| {
            structure.alive
                && normalized_team(&structure.team) == enemy
                && structure.kind == "nexus"
                && is_targetable(structures, team, structure)
        })
        .map(|nexus| nexus.pos)
}

pub(super) fn allied_wave_ready_for_baron_siege(
    minions: &[MinionRuntime],
    team: &str,
    lane: &str,
    target_pos: Vec2,
) -> bool {
    minions
        .iter()
        .filter(|minion| {
            minion.alive
                && normalized_team(&minion.team) == normalized_team(team)
                && normalized_lane(&minion.lane) == normalized_lane(lane)
                && dist(minion.pos, target_pos) <= 0.095
        })
        .count()
        >= 2
}

pub(super) fn baron_push_rally_target(
    champion: &ChampionRuntime,
    minions: &[MinionRuntime],
    structures: &[StructureRuntime],
    team: &str,
    lane: &str,
    is_targetable: impl Fn(&[StructureRuntime], &str, &StructureRuntime) -> bool,
) -> Option<Vec2> {
    let siege_target = baron_push_target_for_lane(structures, team, lane, &is_targetable)?;
    if allied_wave_ready_for_baron_siege(minions, team, lane, siege_target) {
        return Some(siege_target);
    }

    let allied_wave_anchor = minions
        .iter()
        .filter(|minion| {
            minion.alive
                && normalized_team(&minion.team) == normalized_team(team)
                && normalized_lane(&minion.lane) == normalized_lane(lane)
        })
        .min_by(|a, b| {
            dist(a.pos, siege_target)
                .partial_cmp(&dist(b.pos, siege_target))
                .unwrap_or(Ordering::Equal)
        });

    if let Some(anchor) = allied_wave_anchor {
        let dir = normalize(Vec2 {
            x: anchor.pos.x - siege_target.x,
            y: anchor.pos.y - siege_target.y,
        });
        return Some(Vec2 {
            x: clamp(anchor.pos.x + dir.x * 0.012, 0.01, 0.99),
            y: clamp(anchor.pos.y + dir.y * 0.012, 0.01, 0.99),
        });
    }

    let wave_front = lane_wave_front_pos(champion, minions, structures);
    let dir = normalize(Vec2 {
        x: wave_front.x - siege_target.x,
        y: wave_front.y - siege_target.y,
    });
    Some(Vec2 {
        x: clamp(wave_front.x + dir.x * 0.018, 0.01, 0.99),
        y: clamp(wave_front.y + dir.y * 0.018, 0.01, 0.99),
    })
}

fn closest_lane_path_index(pos: Vec2, path: &[Vec2]) -> usize {
    path.iter()
        .enumerate()
        .min_by(|(idx_a, a), (idx_b, b)| {
            dist(**a, pos)
                .partial_cmp(&dist(**b, pos))
                .unwrap_or(Ordering::Equal)
                .then_with(|| idx_a.cmp(idx_b))
        })
        .map(|(idx, _)| idx)
        .unwrap_or(0)
}

pub(super) fn pick_allied_lane_fallback_tower(
    champion: &ChampionRuntime,
    threat_pos: Vec2,
    allow_emergency_retreat: bool,
    structures: &[StructureRuntime],
    lane_path: &[Vec2],
) -> Option<usize> {
    let mut towers: Vec<(usize, usize)> = structures
        .iter()
        .enumerate()
        .filter(|(_, s)| {
            s.alive
                && s.kind == "tower"
                && normalized_team(&s.team) == normalized_team(&champion.team)
                && normalized_lane(&s.lane) == normalized_lane(&champion.lane)
        })
        .map(|(idx, tower)| (idx, closest_lane_path_index(tower.pos, lane_path)))
        .collect();

    towers.sort_by(|(idx_a, path_a), (idx_b, path_b)| {
        path_a.cmp(path_b).then_with(|| idx_a.cmp(idx_b))
    });
    if towers.is_empty() {
        return None;
    }

    let threat_index = closest_lane_path_index(threat_pos, lane_path);
    let mut selected = towers
        .iter()
        .filter(|(_, path_index)| *path_index <= threat_index + 1)
        .max_by(|(idx_a, path_a), (idx_b, path_b)| {
            path_a.cmp(path_b).then_with(|| idx_a.cmp(idx_b))
        })
        .copied();

    if selected.is_none() {
        selected = towers
            .iter()
            .min_by(|(idx_a, path_a), (idx_b, path_b)| {
                dist(threat_pos, structures[*idx_a].pos)
                    .partial_cmp(&dist(threat_pos, structures[*idx_b].pos))
                    .unwrap_or(Ordering::Equal)
                    .then_with(|| path_b.cmp(path_a))
                    .then_with(|| idx_a.cmp(idx_b))
            })
            .copied();
    }

    let Some(selected_entry) = selected else {
        return None;
    };
    if allow_emergency_retreat || towers.len() < 2 {
        return Some(selected_entry.0);
    }

    let mut lane_defense_band = towers.clone();
    lane_defense_band.sort_by(|(idx_a, path_a), (idx_b, path_b)| {
        path_b.cmp(path_a).then_with(|| idx_a.cmp(idx_b))
    });
    lane_defense_band.truncate(2);
    let min_safe_band_index = lane_defense_band
        .iter()
        .map(|(_, path_index)| *path_index)
        .min()
        .unwrap_or(selected_entry.1);

    if selected_entry.1 >= min_safe_band_index {
        return Some(selected_entry.0);
    }

    towers
        .iter()
        .filter(|(_, path_index)| *path_index >= min_safe_band_index)
        .min_by(|(idx_a, path_a), (idx_b, path_b)| {
            path_a
                .abs_diff(min_safe_band_index)
                .cmp(&path_b.abs_diff(min_safe_band_index))
                .then_with(|| path_b.cmp(path_a))
                .then_with(|| idx_a.cmp(idx_b))
        })
        .map(|(idx, _)| *idx)
        .or(Some(selected_entry.0))
}

pub(super) fn should_allow_emergency_retreat(
    champion: &ChampionRuntime,
    threat_pos: Vec2,
    champions: &[ChampionRuntime],
    minions: &[MinionRuntime],
) -> bool {
    if champion.role == "JGL" {
        return false;
    }
    let Some(profile) = lane_role_profile(champion) else {
        return false;
    };

    let hp_ratio = if champion.max_hp <= 0.0 {
        1.0
    } else {
        champion.hp / champion.max_hp
    };
    if hp_ratio <= profile.retreat_hp {
        return true;
    }

    let pressure = lane_pressure_at(
        champion,
        threat_pos,
        champions,
        minions,
        LANE_LOCAL_PRESSURE_RADIUS,
    );
    let strongly_unfavorable = pressure.enemy_score
        >= pressure.ally_score
            + profile.outnumber_tolerance
            + LANE_STRONG_UNFAVORABLE_PRESSURE_DELTA
        || pressure.enemy_champions >= pressure.ally_champions + 1;
    if !strongly_unfavorable {
        return false;
    }

    hp_ratio < LANE_HEALTHY_RETREAT_HP_RATIO || pressure.enemy_champions >= pressure.ally_champions + 2
}

pub(super) fn lane_retreat_anchor_pos(
    champion: &ChampionRuntime,
    threat_pos: Vec2,
    now: f64,
    champions: &[ChampionRuntime],
    minions: &[MinionRuntime],
    structures: &[StructureRuntime],
) -> Vec2 {
    if champion.role == "JGL" {
        return base_position_for(&champion.team);
    }

    let hp_ratio = if champion.max_hp <= 0.0 {
        1.0
    } else {
        champion.hp / champion.max_hp
    };
    if is_first_wave_contest_active(champion, now) && hp_ratio >= 0.45 {
        return lane_farm_anchor_pos_v2(champion, now, champions, minions, structures);
    }

    let farm_anchor = lane_farm_anchor_pos_v2(champion, now, champions, minions, structures);
    let emergency = should_allow_emergency_retreat(champion, threat_pos, champions, minions);
    let Some(tower_idx) =
        pick_allied_lane_fallback_tower(champion, threat_pos, emergency, structures, &lane_path_for(&champion.team, &champion.lane))
    else {
        return farm_anchor;
    };
    let tower = &structures[tower_idx];

    let tower_fallback = lane_fallback_pos_from_tower(champion, tower.pos, emergency);
    if emergency {
        return tower_fallback;
    }

    let lane_path = lane_path_for(&champion.team, &champion.lane);

    let farm_idx = closest_lane_path_index(farm_anchor, &lane_path);
    let tower_idx = closest_lane_path_index(tower_fallback, &lane_path);
    if tower_idx < farm_idx {
        farm_anchor
    } else {
        tower_fallback
    }
}
