use super::*;
use std::cmp::Ordering;

pub(super) enum ChampionObjectiveAssistPlan {
    None,
    HardAssist {
        objective_key: String,
        objective_pos: Vec2,
    },
    ObjectiveAssist {
        objective_key: String,
        objective_pos: Vec2,
    },
}

pub(super) fn champion_can_resolve_combat(champion: &ChampionRuntime, now: f64) -> bool {
    champion.alive
        && !champion_is_banished(champion)
        && champion.state != "recall"
        && now >= champion.attack_cd_until
}

pub(super) fn classify_objective_assist_plan(
    runtime: &RuntimeState,
    champion_idx: usize,
    neutral_timers: &NeutralTimersRuntime,
) -> ChampionObjectiveAssistPlan {
    if champion_idx >= runtime.champions.len() {
        return ChampionObjectiveAssistPlan::None;
    }
    let champion = &runtime.champions[champion_idx];
    let team = normalized_team(&champion.team).to_string();

    let is_hard_assist = {
        let contested =
            contested_dragon_attempt_for_team(&team, &runtime.champions, neutral_timers);
        should_hard_assist_contested_dragon(champion, contested)
    };

    if is_hard_assist {
        if let Some(dragon) =
            contested_dragon_attempt_for_team(&team, &runtime.champions, neutral_timers)
        {
            return ChampionObjectiveAssistPlan::HardAssist {
                objective_key: dragon.key.clone(),
                objective_pos: dragon.pos,
            };
        }
        return ChampionObjectiveAssistPlan::None;
    }

    let is_objective_assist =
        should_assist_objective_attempt(champion, &runtime.champions, neutral_timers);
    if is_objective_assist && champion.state == "objective" {
        if let Some(attempt) =
            active_objective_attempt_for_team(&team, &runtime.champions, neutral_timers)
        {
            return ChampionObjectiveAssistPlan::ObjectiveAssist {
                objective_key: attempt.key.clone(),
                objective_pos: attempt.pos,
            };
        }
    }

    ChampionObjectiveAssistPlan::None
}

#[derive(Clone)]
pub(super) struct FallbackCandidate {
    pub(super) target: CombatTarget,
    pub(super) score: f64,
    pub(super) distance: f64,
    pub(super) kind_rank: u8,
    pub(super) stable_key: String,
}

fn is_backline_champion(champion: &ChampionRuntime) -> bool {
    champion.attack_range >= 0.05
}

pub(super) fn compare_enemy_priority_distance(
    champion_pos: Vec2,
    fight_plan: &str,
    idx_a: usize,
    a: &ChampionRuntime,
    idx_b: usize,
    b: &ChampionRuntime,
) -> Ordering {
    target_priority_rank_for_fight_plan(fight_plan, a)
        .cmp(&target_priority_rank_for_fight_plan(fight_plan, b))
        .then_with(|| {
            dist(champion_pos, a.pos)
                .partial_cmp(&dist(champion_pos, b.pos))
                .unwrap_or(Ordering::Equal)
        })
        .then_with(|| idx_a.cmp(&idx_b))
}

pub(super) fn compare_enemy_priority_hp_distance(
    champion_pos: Vec2,
    fight_plan: &str,
    idx_a: usize,
    a: &ChampionRuntime,
    idx_b: usize,
    b: &ChampionRuntime,
) -> Ordering {
    target_priority_rank_for_fight_plan(fight_plan, a)
        .cmp(&target_priority_rank_for_fight_plan(fight_plan, b))
        .then_with(|| a.hp.partial_cmp(&b.hp).unwrap_or(Ordering::Equal))
        .then_with(|| {
            dist(champion_pos, a.pos)
                .partial_cmp(&dist(champion_pos, b.pos))
                .unwrap_or(Ordering::Equal)
        })
        .then_with(|| idx_a.cmp(&idx_b))
}

pub(super) fn compare_by_hp_distance_stable(
    origin_pos: Vec2,
    idx_a: usize,
    hp_a: f64,
    pos_a: Vec2,
    idx_b: usize,
    hp_b: f64,
    pos_b: Vec2,
) -> Ordering {
    hp_a.partial_cmp(&hp_b)
        .unwrap_or(Ordering::Equal)
        .then_with(|| {
            dist(origin_pos, pos_a)
                .partial_cmp(&dist(origin_pos, pos_b))
                .unwrap_or(Ordering::Equal)
        })
        .then_with(|| idx_a.cmp(&idx_b))
}

pub(super) fn compare_by_distance_stable(
    origin_pos: Vec2,
    idx_a: usize,
    pos_a: Vec2,
    idx_b: usize,
    pos_b: Vec2,
) -> Ordering {
    dist(origin_pos, pos_a)
        .partial_cmp(&dist(origin_pos, pos_b))
        .unwrap_or(Ordering::Equal)
        .then_with(|| idx_a.cmp(&idx_b))
}

pub(super) fn compare_minion_wave_front_stable(
    wave_front: Vec2,
    champion_pos: Vec2,
    idx_a: usize,
    pos_a: Vec2,
    idx_b: usize,
    pos_b: Vec2,
) -> Ordering {
    dist(wave_front, pos_a)
        .partial_cmp(&dist(wave_front, pos_b))
        .unwrap_or(Ordering::Equal)
        .then_with(|| {
            dist(champion_pos, pos_a)
                .partial_cmp(&dist(champion_pos, pos_b))
                .unwrap_or(Ordering::Equal)
        })
        .then_with(|| idx_a.cmp(&idx_b))
}

pub(super) fn compare_fallback_candidate(a: &FallbackCandidate, b: &FallbackCandidate) -> Ordering {
    a.score
        .partial_cmp(&b.score)
        .unwrap_or(Ordering::Equal)
        .then_with(|| {
            a.distance
                .partial_cmp(&b.distance)
                .unwrap_or(Ordering::Equal)
        })
        .then_with(|| a.kind_rank.cmp(&b.kind_rank))
        .then_with(|| a.stable_key.cmp(&b.stable_key))
}

pub(super) fn neutral_fallback_score(distance: f64) -> f64 {
    distance + 0.03
}

pub(super) fn minion_fallback_score(
    champion: &ChampionRuntime,
    distance_to_champion: f64,
    distance_to_wave: f64,
) -> f64 {
    let mut score = distance_to_champion * 0.88 + distance_to_wave * 0.12;
    if distance_to_champion <= champion.attack_range.max(0.04) + 0.008 {
        score -= 0.004;
    }
    score
}

pub(super) fn structure_fallback_score(champion: &ChampionRuntime, distance: f64) -> f64 {
    let mut score = distance;
    if distance <= champion.attack_range.max(0.04) + 0.008 {
        score -= 0.004;
    }
    score
}

pub(super) fn target_priority_rank_for_fight_plan(fight_plan: &str, enemy: &ChampionRuntime) -> u8 {
    let enemy_is_backline = is_backline_champion(enemy);
    match fight_plan {
        "FrontToBack" => {
            if enemy_is_backline {
                1
            } else {
                0
            }
        }
        "Dive" | "Pick" => {
            if enemy_is_backline {
                0
            } else {
                1
            }
        }
        _ => 0,
    }
}

pub(super) fn combat_target_pos(runtime: &RuntimeState, target: &CombatTarget) -> Option<Vec2> {
    match target {
        CombatTarget::Champion(idx) => runtime.champions.get(*idx).map(|c| c.pos),
        CombatTarget::Minion(idx) => runtime.minions.get(*idx).map(|m| m.pos),
        CombatTarget::Structure(idx) => runtime.structures.get(*idx).map(|s| s.pos),
        CombatTarget::Neutral(key) => decode_neutral_timers_state(&runtime.neutral_timers)
            .and_then(|timers| timers.entities.get(key).cloned())
            .map(|timer| timer.pos),
    }
}

pub(super) fn is_local_combat_target(
    runtime: &RuntimeState,
    champion_idx: usize,
    target: &CombatTarget,
) -> bool {
    if champion_idx >= runtime.champions.len() {
        return false;
    }
    let champion = &runtime.champions[champion_idx];
    let Some(target_pos) = combat_target_pos(runtime, target) else {
        return false;
    };

    let target_distance = dist(champion.pos, target_pos);
    if target_distance > LOCAL_COMBAT_ENGAGE_RADIUS {
        return false;
    }
    if matches!(target, CombatTarget::Structure(_))
        && target_distance > LOCAL_STRUCTURE_ENGAGE_RADIUS
    {
        return false;
    }
    if let CombatTarget::Neutral(key) = target {
        let max_range = if is_objective_neutral_key(key) {
            OBJECTIVE_ATTEMPT_RADIUS
        } else {
            JUNGLE_CAMP_ENGAGE_RADIUS
        };
        if target_distance > max_range {
            return false;
        }
    }

    true
}

pub(super) fn is_visible_enemy_champion(
    runtime: &RuntimeState,
    champion_team: &str,
    enemy_team: &str,
    enemy: &ChampionRuntime,
) -> bool {
    enemy.alive
        && normalized_team(&enemy.team) == enemy_team
        && team_has_vision_at(runtime, champion_team, enemy.pos)
}

pub(super) fn is_lane_enemy_minion(
    champion_lane: &str,
    enemy_team: &str,
    minion: &MinionRuntime,
) -> bool {
    minion.alive
        && normalized_team(&minion.team) == enemy_team
        && normalized_lane(&minion.lane) == champion_lane
}

pub(super) fn is_visible_lane_enemy_minion(
    runtime: &RuntimeState,
    champion_team: &str,
    champion_lane: &str,
    enemy_team: &str,
    minion: &MinionRuntime,
) -> bool {
    is_lane_enemy_minion(champion_lane, enemy_team, minion)
        && team_has_vision_at(runtime, champion_team, minion.pos)
}

pub(super) fn has_credible_kill_chance(
    runtime: &RuntimeState,
    champion_idx: usize,
    enemy_idx: usize,
    now: f64,
) -> bool {
    if champion_idx >= runtime.champions.len() || enemy_idx >= runtime.champions.len() {
        return false;
    }
    let champion = &runtime.champions[champion_idx];
    let enemy = &runtime.champions[enemy_idx];
    if !enemy.alive || normalized_team(&enemy.team) == normalized_team(&champion.team) {
        return false;
    }

    let range_gate = if champion.role == "JGL" {
        0.11
    } else {
        LANE_CHAMPION_TRADE_RADIUS
    };
    if dist(champion.pos, enemy.pos) > range_gate {
        return false;
    }

    let hp_ratio = if champion.max_hp <= 0.0 {
        1.0
    } else {
        champion.hp / champion.max_hp
    };
    if hp_ratio <= 0.24 {
        return false;
    }

    if champion.role != "JGL"
        && !can_open_trade_window(
            champion,
            enemy,
            now,
            &runtime.champions,
            &runtime.minions,
            &runtime.structures,
            &runtime.lane_combat_state_by_champion,
            runtime.ai_mode,
            &runtime.policy,
        )
    {
        return false;
    }

    let ally_pressure = runtime
        .champions
        .iter()
        .filter(|u| {
            u.alive
                && normalized_team(&u.team) == normalized_team(&champion.team)
                && dist(u.pos, enemy.pos) <= 0.12
        })
        .count() as f64;
    let enemy_pressure = runtime
        .champions
        .iter()
        .filter(|u| {
            u.alive
                && normalized_team(&u.team) == normalized_team(&enemy.team)
                && dist(u.pos, enemy.pos) <= 0.12
        })
        .count() as f64;

    let ttk_enemy = enemy.hp / champion.attack_damage.max(1.0);
    let ttk_self = champion.hp / enemy.attack_damage.max(1.0);
    let enemy_hp_ratio = if enemy.max_hp <= 0.0 {
        1.0
    } else {
        enemy.hp / enemy.max_hp
    };
    let low_enemy = enemy_hp_ratio <= 0.48;

    (ttk_enemy <= ttk_self * 0.95 || low_enemy) && ally_pressure + 0.5 >= enemy_pressure
}

pub(super) fn pick_combat_target(
    runtime: &RuntimeState,
    champion_idx: usize,
    now: f64,
    neutral_timers: &NeutralTimersRuntime,
) -> Option<CombatTarget> {
    if champion_idx >= runtime.champions.len() {
        return None;
    }
    let champion = &runtime.champions[champion_idx];
    let team_tactics = team_tactics_for_runtime(runtime.extra.get("teamTactics"), &champion.team);
    let fight_plan = team_tactics.fight_plan.as_str();
    let champion_team = normalized_team(&champion.team);
    let champion_lane = normalized_lane(&champion.lane);
    let enemy_team = if normalized_team(&champion.team) == "blue" {
        "red"
    } else {
        "blue"
    };

    let kill_window_enemy = runtime
        .champions
        .iter()
        .enumerate()
        .filter(|(idx, enemy)| {
            *idx != champion_idx
                && is_visible_enemy_champion(runtime, champion_team, enemy_team, enemy)
                && has_credible_kill_chance(runtime, champion_idx, *idx, now)
        })
        .min_by(|(idx_a, a), (idx_b, b)| {
            compare_enemy_priority_hp_distance(champion.pos, fight_plan, *idx_a, a, *idx_b, b)
        })
        .map(|(idx, _)| idx);
    if let Some(enemy_idx) = kill_window_enemy {
        return Some(CombatTarget::Champion(enemy_idx));
    }

    if champion.role == "JGL" {
        let nearby_enemy = runtime
            .champions
            .iter()
            .enumerate()
            .filter(|(_, enemy)| {
                is_visible_enemy_champion(runtime, champion_team, enemy_team, enemy)
                    && dist(champion.pos, enemy.pos) <= 0.13
            })
            .min_by(|(idx_a, a), (idx_b, b)| {
                compare_enemy_priority_distance(champion.pos, fight_plan, *idx_a, a, *idx_b, b)
            })
            .map(|(idx, _)| idx);
        if let Some(enemy_idx) = nearby_enemy {
            return Some(CombatTarget::Champion(enemy_idx));
        }

        if let Some(neutral_key) = nearest_attackable_neutral_key(
            champion,
            neutral_timers,
            JUNGLE_CAMP_ENGAGE_RADIUS,
            OBJECTIVE_ATTEMPT_RADIUS,
        ) {
            return Some(CombatTarget::Neutral(neutral_key));
        }
        return None;
    }

    if now < LANE_COMBAT_UNLOCK_AT {
        let early_lane_minion = runtime
            .minions
            .iter()
            .enumerate()
            .filter(|(_, m)| {
                is_visible_lane_enemy_minion(runtime, champion_team, champion_lane, enemy_team, m)
                    && dist(champion.pos, m.pos) <= 0.12
            })
            .min_by(|(idx_a, a), (idx_b, b)| {
                compare_by_hp_distance_stable(
                    champion.pos,
                    *idx_a,
                    a.hp,
                    a.pos,
                    *idx_b,
                    b.hp,
                    b.pos,
                )
            })
            .map(|(idx, _)| idx);
        return early_lane_minion.map(CombatTarget::Minion);
    }

    let recalling_enemy = runtime
        .champions
        .iter()
        .enumerate()
        .filter(|(_, enemy)| {
            is_visible_enemy_champion(runtime, champion_team, enemy_team, enemy)
                && enemy.state == "recall"
                && dist(champion.pos, enemy.pos) <= LOCAL_COMBAT_ENGAGE_RADIUS
                && in_lane_trade_context(
                    champion,
                    enemy.pos,
                    true,
                    &runtime.champions,
                    &runtime.minions,
                    &runtime.structures,
                )
        })
        .min_by(|(idx_a, a), (idx_b, b)| {
            compare_enemy_priority_distance(champion.pos, fight_plan, *idx_a, a, *idx_b, b)
        })
        .map(|(idx, _)| idx);
    if let Some(enemy_idx) = recalling_enemy {
        return Some(CombatTarget::Champion(enemy_idx));
    }

    let threatening_enemy = runtime
        .champions
        .iter()
        .enumerate()
        .filter(|(_, enemy)| {
            is_visible_enemy_champion(runtime, champion_team, enemy_team, enemy)
                && dist(champion.pos, enemy.pos) <= 0.12
                && runtime.champions.iter().any(|ally| {
                    ally.alive
                        && normalized_team(&ally.team) == normalized_team(&champion.team)
                        && (dist(ally.pos, champion.pos) <= ALLY_HELP_RADIUS
                            || dist(ally.pos, enemy.pos) <= ALLY_HELP_RADIUS)
                        && ally
                            .last_damaged_by_champion_id
                            .as_ref()
                            .map(|id| id == &enemy.id)
                            .unwrap_or(false)
                        && now - ally.last_damaged_at <= ALLY_HELP_DAMAGE_RECENT_SEC
                })
                && (can_open_trade_window(
                    champion,
                    enemy,
                    now,
                    &runtime.champions,
                    &runtime.minions,
                    &runtime.structures,
                    &runtime.lane_combat_state_by_champion,
                    runtime.ai_mode,
                    &runtime.policy,
                ) || has_local_numbers_advantage(champion, enemy.pos, &runtime.champions, 0.12))
        })
        .min_by(|(idx_a, a), (idx_b, b)| {
            compare_enemy_priority_distance(champion.pos, fight_plan, *idx_a, a, *idx_b, b)
        })
        .map(|(idx, _)| idx);
    if let Some(enemy_idx) = threatening_enemy {
        return Some(CombatTarget::Champion(enemy_idx));
    }

    if let Some(enemy_idx) =
        enemy_pressuring_allied_tower_idx(champion, &runtime.champions, &runtime.structures)
    {
        return Some(CombatTarget::Champion(enemy_idx));
    }

    let numbers_advantage_enemy = runtime
        .champions
        .iter()
        .enumerate()
        .filter(|(_, enemy)| {
            is_visible_enemy_champion(runtime, champion_team, enemy_team, enemy)
                && normalized_lane(&enemy.lane) == champion_lane
                && dist(champion.pos, enemy.pos) <= LANE_CHAMPION_TRADE_RADIUS
                && has_local_numbers_advantage(champion, enemy.pos, &runtime.champions, 0.11)
                && can_open_trade_window(
                    champion,
                    enemy,
                    now,
                    &runtime.champions,
                    &runtime.minions,
                    &runtime.structures,
                    &runtime.lane_combat_state_by_champion,
                    runtime.ai_mode,
                    &runtime.policy,
                )
        })
        .min_by(|(idx_a, a), (idx_b, b)| {
            compare_enemy_priority_hp_distance(champion.pos, fight_plan, *idx_a, a, *idx_b, b)
        })
        .map(|(idx, _)| idx);
    if let Some(enemy_idx) = numbers_advantage_enemy {
        return Some(CombatTarget::Champion(enemy_idx));
    }

    let objective_assist_active =
        should_assist_objective_attempt(champion, &runtime.champions, neutral_timers);
    if objective_assist_active {
        if let Some(neutral_key) = nearby_neutral_objective_key(champion, neutral_timers) {
            return Some(CombatTarget::Neutral(neutral_key));
        }
    }

    let last_hit_minion = runtime
        .minions
        .iter()
        .enumerate()
        .filter(|(_, m)| {
            if objective_assist_active {
                return false;
            }
            is_visible_lane_enemy_minion(runtime, champion_team, champion_lane, enemy_team, m)
                && dist(champion.pos, m.pos) <= laner_farm_search_radius(champion)
                && m.hp <= champion.attack_damage * CHAMPION_DAMAGE_TO_MINION_MULTIPLIER * 1.4
        })
        .min_by(|(idx_a, a), (idx_b, b)| {
            compare_by_hp_distance_stable(champion.pos, *idx_a, a.hp, a.pos, *idx_b, b.hp, b.pos)
        })
        .map(|(idx, _)| idx);
    if let Some(minion_idx) = last_hit_minion {
        return Some(CombatTarget::Minion(minion_idx));
    }

    let lane_skirmish_enemy = runtime
        .champions
        .iter()
        .enumerate()
        .filter(|(_, enemy)| {
            is_visible_enemy_champion(runtime, champion_team, enemy_team, enemy)
                && normalized_lane(&enemy.lane) == champion_lane
                && dist(champion.pos, enemy.pos) <= LANE_CHAMPION_TRADE_RADIUS
                && can_open_trade_window(
                    champion,
                    enemy,
                    now,
                    &runtime.champions,
                    &runtime.minions,
                    &runtime.structures,
                    &runtime.lane_combat_state_by_champion,
                    runtime.ai_mode,
                    &runtime.policy,
                )
        })
        .min_by(|(idx_a, a), (idx_b, b)| {
            compare_enemy_priority_distance(champion.pos, fight_plan, *idx_a, a, *idx_b, b)
        })
        .map(|(idx, _)| idx);
    if let Some(enemy_idx) = lane_skirmish_enemy {
        return Some(CombatTarget::Champion(enemy_idx));
    }

    let wave_front = lane_wave_front_pos(champion, &runtime.minions, &runtime.structures);
    let farming_minion = runtime
        .minions
        .iter()
        .enumerate()
        .filter(|(_, m)| {
            if objective_assist_active {
                return false;
            }
            is_visible_lane_enemy_minion(runtime, champion_team, champion_lane, enemy_team, m)
                && dist(champion.pos, m.pos) <= laner_farm_search_radius(champion)
        })
        .min_by(|(idx_a, a), (idx_b, b)| {
            compare_minion_wave_front_stable(wave_front, champion.pos, *idx_a, a.pos, *idx_b, b.pos)
        })
        .map(|(idx, _)| idx);
    if let Some(minion_idx) = farming_minion {
        return Some(CombatTarget::Minion(minion_idx));
    }

    let pressure_structure = runtime
        .structures
        .iter()
        .enumerate()
        .filter(|(_, s)| {
            if !(s.alive
                && normalized_team(&s.team) == enemy_team
                && (normalized_lane(&s.lane) == normalized_lane(&champion.lane)
                    || s.kind == "nexus")
                && dist(champion.pos, s.pos) <= LANE_STRUCTURE_PRESSURE_RADIUS
                && is_structure_targetable(&runtime.structures, &champion.team, s))
            {
                return false;
            }

            let has_allied_wave_at_structure = runtime.minions.iter().any(|m| {
                m.alive
                    && normalized_team(&m.team) == normalized_team(&champion.team)
                    && normalized_lane(&m.lane) == champion_lane
                    && dist(m.pos, s.pos) <= 0.1
            });
            if !has_allied_wave_at_structure {
                return false;
            }

            let allied_wave_count = runtime
                .minions
                .iter()
                .filter(|m| {
                    m.alive
                        && normalized_team(&m.team) == normalized_team(&champion.team)
                        && normalized_lane(&m.lane) == champion_lane
                        && dist(m.pos, s.pos) <= 0.1
                })
                .count();
            if team_has_active_baron_buff(runtime, &champion.team) && allied_wave_count < 3 {
                return false;
            }

            let enemy_wave_at_structure = runtime
                .minions
                .iter()
                .filter(|m| {
                    m.alive
                        && normalized_team(&m.team) != normalized_team(&champion.team)
                        && normalized_lane(&m.lane) == champion_lane
                        && dist(m.pos, s.pos) <= 0.08
                })
                .count();
            if enemy_wave_at_structure >= 2 {
                return false;
            }

            if team_has_active_baron_buff(runtime, &champion.team) {
                let allied_champions_near = runtime
                    .champions
                    .iter()
                    .filter(|ally| {
                        ally.alive
                            && normalized_team(&ally.team) == normalized_team(&champion.team)
                            && dist(ally.pos, s.pos) <= 0.12
                    })
                    .count();
                let enemy_champions_near = runtime
                    .champions
                    .iter()
                    .filter(|enemy| {
                        enemy.alive
                            && normalized_team(&enemy.team) != normalized_team(&champion.team)
                            && dist(enemy.pos, s.pos) <= 0.12
                    })
                    .count();
                if allied_champions_near < enemy_champions_near {
                    return false;
                }
            }

            true
        })
        .min_by(|(idx_a, a), (idx_b, b)| {
            compare_by_distance_stable(champion.pos, *idx_a, a.pos, *idx_b, b.pos)
        })
        .map(|(idx, _)| idx);

    if let Some(structure_idx) = pressure_structure {
        return Some(CombatTarget::Structure(structure_idx));
    }

    let nearest_structure = runtime
        .structures
        .iter()
        .enumerate()
        .filter(|(_, s)| {
            if !s.alive
                || normalized_team(&s.team) != enemy_team
                || !(normalized_lane(&s.lane) == normalized_lane(&champion.lane)
                    || s.kind == "nexus")
                || !is_structure_targetable(&runtime.structures, &champion.team, s)
            {
                return false;
            }
            if dist(champion.pos, s.pos) > LANE_STRUCTURE_PRESSURE_RADIUS {
                return false;
            }
            let allied_wave_count = runtime
                .minions
                .iter()
                .filter(|m| {
                    m.alive
                        && normalized_team(&m.team) == normalized_team(&champion.team)
                        && normalized_lane(&m.lane) == champion_lane
                        && dist(m.pos, s.pos) <= 0.09
                })
                .count();
            if allied_wave_count == 0 {
                return false;
            }
            if team_has_active_baron_buff(runtime, &champion.team) && allied_wave_count < 3 {
                return false;
            }
            let enemy_wave_at_structure = runtime
                .minions
                .iter()
                .filter(|m| {
                    m.alive
                        && normalized_team(&m.team) != normalized_team(&champion.team)
                        && normalized_lane(&m.lane) == champion_lane
                        && dist(m.pos, s.pos) <= 0.08
                })
                .count();
            if enemy_wave_at_structure >= 2 {
                return false;
            }
            true
        })
        .min_by(|(idx_a, a), (idx_b, b)| {
            compare_by_distance_stable(champion.pos, *idx_a, a.pos, *idx_b, b.pos)
        })
        .map(|(idx, _)| idx);

    let nearest_minion = runtime
        .minions
        .iter()
        .enumerate()
        .filter(|(_, m)| is_lane_enemy_minion(champion_lane, enemy_team, m))
        .min_by(|(idx_a, a), (idx_b, b)| {
            compare_by_distance_stable(champion.pos, *idx_a, a.pos, *idx_b, b.pos)
        })
        .map(|(idx, _)| idx);

    let nearest_enemy_champion = runtime
        .champions
        .iter()
        .enumerate()
        .filter(|(idx, enemy)| {
            *idx != champion_idx
                && is_visible_enemy_champion(runtime, champion_team, enemy_team, enemy)
                && normalized_lane(&enemy.lane) == champion_lane
                && can_open_trade_window(
                    champion,
                    enemy,
                    now,
                    &runtime.champions,
                    &runtime.minions,
                    &runtime.structures,
                    &runtime.lane_combat_state_by_champion,
                    runtime.ai_mode,
                    &runtime.policy,
                )
        })
        .min_by(|(idx_a, a), (idx_b, b)| {
            dist(champion.pos, a.pos)
                .partial_cmp(&dist(champion.pos, b.pos))
                .unwrap_or(Ordering::Equal)
                .then_with(|| idx_a.cmp(idx_b))
        })
        .map(|(idx, _)| idx);

    let nearby_neutral =
        nearest_attackable_neutral_key(champion, neutral_timers, JUNGLE_CAMP_ENGAGE_RADIUS, 0.0)
            .filter(|key| is_jungle_camp_key(key));

    let mut fallback_candidates: Vec<FallbackCandidate> = Vec::new();

    if let Some(key) = nearby_neutral {
        if let Some(timer) = neutral_timers.entities.get(&key) {
            let d = dist(champion.pos, timer.pos);
            fallback_candidates.push(FallbackCandidate {
                target: CombatTarget::Neutral(key.clone()),
                score: neutral_fallback_score(d),
                distance: d,
                kind_rank: 4,
                stable_key: key,
            });
        }
    }

    if let Some(enemy_idx) = nearest_enemy_champion {
        let enemy = &runtime.champions[enemy_idx];
        let d = dist(champion.pos, enemy.pos);
        fallback_candidates.push(FallbackCandidate {
            target: CombatTarget::Champion(enemy_idx),
            score: d,
            distance: d,
            kind_rank: 1,
            stable_key: enemy.id.clone(),
        });
    }

    if let Some(minion_idx) = nearest_minion {
        let minion = &runtime.minions[minion_idx];
        let distance_to_champion = dist(champion.pos, minion.pos);
        let distance_to_wave = dist(wave_front, minion.pos);
        let score = minion_fallback_score(champion, distance_to_champion, distance_to_wave);
        fallback_candidates.push(FallbackCandidate {
            target: CombatTarget::Minion(minion_idx),
            score,
            distance: distance_to_champion,
            kind_rank: 2,
            stable_key: minion.id.clone(),
        });
    }

    if let Some(structure_idx) = nearest_structure {
        let structure = &runtime.structures[structure_idx];
        let d = dist(champion.pos, structure.pos);
        let score = structure_fallback_score(champion, d);
        fallback_candidates.push(FallbackCandidate {
            target: CombatTarget::Structure(structure_idx),
            score,
            distance: d,
            kind_rank: 3,
            stable_key: structure.id.clone(),
        });
    }

    fallback_candidates.sort_by(compare_fallback_candidate);

    fallback_candidates
        .first()
        .map(|candidate| candidate.target.clone())
}

pub(super) fn resolve_champion_combat(runtime: &mut RuntimeState) {
    let now = runtime.time_sec;
    let mut neutral_timers = decode_neutral_timers_state(&runtime.neutral_timers)
        .unwrap_or_else(neutral_timers_default_runtime_state);

    tick_ignite_dot_effects(runtime, now);

    for idx in 0..runtime.champions.len() {
        if !champion_can_resolve_combat(&runtime.champions[idx], now) {
            continue;
        }

        let team = normalized_team(&runtime.champions[idx].team).to_string();
        let attack_range = runtime.champions[idx].attack_range.max(0.04);

        if try_cast_ultimate(runtime, idx, now) {
            continue;
        }

        if try_cast_summoner_spells(runtime, &mut neutral_timers, idx, now) {
            continue;
        }

        match classify_objective_assist_plan(runtime, idx, &neutral_timers) {
            ChampionObjectiveAssistPlan::HardAssist {
                objective_key,
                objective_pos,
            } => {
                if let Some(champion_idx) = nearest_enemy_champion_contesting_objective(
                    &runtime.champions,
                    &runtime.champions[idx],
                    objective_pos,
                    attack_range,
                ) {
                    if should_engage_enemy_champion(runtime, idx, champion_idx) {
                        attack_enemy_champion(runtime, idx, champion_idx);
                        continue;
                    }
                }

                if attack_neutral_if_in_range(runtime, &mut neutral_timers, idx, &objective_key) {
                    continue;
                }

                continue;
            }
            ChampionObjectiveAssistPlan::ObjectiveAssist {
                objective_key,
                objective_pos,
            } => {
                if let Some(champion_idx) = nearest_enemy_champion_contesting_objective(
                    &runtime.champions,
                    &runtime.champions[idx],
                    objective_pos,
                    attack_range,
                ) {
                    if should_engage_enemy_champion(runtime, idx, champion_idx) {
                        attack_enemy_champion(runtime, idx, champion_idx);
                        continue;
                    }
                }

                if attack_neutral_if_in_range(runtime, &mut neutral_timers, idx, &objective_key) {
                    continue;
                }

                continue;
            }
            ChampionObjectiveAssistPlan::None => {}
        }

        let Some(target) = pick_combat_target(runtime, idx, now, &neutral_timers) else {
            continue;
        };
        if !is_local_combat_target(runtime, idx, &target) {
            continue;
        }

        let attacker_snapshot = runtime.champions[idx].clone();
        let Some(target_pos) = combat_target_pos(runtime, &target) else {
            continue;
        };

        if dist(attacker_snapshot.pos, target_pos) > attack_range {
            if let CombatTarget::Champion(enemy_idx) = &target {
                let target_snapshot = runtime.champions[*enemy_idx].clone();
                if attacker_snapshot.role != "JGL" {
                    if should_force_laner_disengage(
                        &attacker_snapshot,
                        target_snapshot.pos,
                        Some(&target_snapshot),
                        &runtime.champions,
                        &runtime.minions,
                        &runtime.structures,
                    ) || !in_lane_trade_context(
                        &attacker_snapshot,
                        target_snapshot.pos,
                        true,
                        &runtime.champions,
                        &runtime.minions,
                        &runtime.structures,
                    ) {
                        issue_lane_disengage(runtime, idx, target_snapshot.pos);
                        continue;
                    }

                    let approach = lane_trade_approach_pos(
                        &attacker_snapshot,
                        &target_snapshot,
                        now,
                        &runtime.champions,
                        &runtime.minions,
                        &runtime.structures,
                    );
                    set_champion_direct_path(&mut runtime.champions[idx], approach);
                    continue;
                }
            }

            if runtime.champions[idx].state == "objective" {
                set_champion_direct_path_hysteresis(
                    &mut runtime.champions[idx],
                    target_pos,
                    OBJECTIVE_PATH_MIN_TARGET_DELTA,
                );
            } else {
                set_champion_direct_path(&mut runtime.champions[idx], target_pos);
            }
            continue;
        }

        match target {
            CombatTarget::Champion(champion_idx) => {
                let target_snapshot = runtime.champions[champion_idx].clone();

                if attacker_snapshot.role != "JGL" {
                    let open_eval = evaluate_open_trade_window(
                        &attacker_snapshot,
                        &target_snapshot,
                        now,
                        &runtime.champions,
                        &runtime.minions,
                        &runtime.structures,
                        &runtime.lane_combat_state_by_champion,
                        runtime.ai_mode,
                        &runtime.policy,
                    );
                    if open_eval.flipped_by_hybrid {
                        maybe_log_hybrid_trade_flip(
                            runtime,
                            &attacker_snapshot,
                            "open-trade",
                            open_eval.confidence,
                            open_eval.rule_decision,
                            open_eval.decision,
                        );
                    }
                    if !open_eval.decision {
                        issue_lane_disengage(runtime, idx, target_snapshot.pos);
                        continue;
                    }
                }

                let disengage_eval = evaluate_disengage_champion_trade(
                    &attacker_snapshot,
                    &target_snapshot,
                    now,
                    &runtime.champions,
                    &runtime.minions,
                    &runtime.structures,
                    runtime.ai_mode,
                    &runtime.policy,
                );
                if disengage_eval.flipped_by_hybrid {
                    maybe_log_hybrid_trade_flip(
                        runtime,
                        &attacker_snapshot,
                        "disengage",
                        disengage_eval.confidence,
                        disengage_eval.rule_decision,
                        disengage_eval.decision,
                    );
                }
                if disengage_eval.decision {
                    issue_lane_disengage(runtime, idx, target_snapshot.pos);
                    continue;
                }

                if !should_engage_enemy_champion(runtime, idx, champion_idx) {
                    if attacker_snapshot.role != "JGL" {
                        issue_lane_disengage(runtime, idx, target_snapshot.pos);
                    }
                    continue;
                }

                attack_enemy_champion(runtime, idx, champion_idx);

                let attacker_after = runtime.champions[idx].clone();
                if attacker_after.role != "JGL"
                    && champion_idx < runtime.champions.len()
                    && runtime.champions[champion_idx].alive
                    && !should_commit_all_in_trade(
                        &attacker_after,
                        &runtime.champions[champion_idx],
                        &runtime.champions,
                        &runtime.minions,
                    )
                {
                    let enemy_pos = runtime.champions[champion_idx].pos;
                    issue_lane_disengage(runtime, idx, enemy_pos);
                }
                continue;
            }
            CombatTarget::Minion(minion_idx) => {
                if minion_idx >= runtime.minions.len() || !runtime.minions[minion_idx].alive {
                    continue;
                }
                let lane_mult = champion_lane_damage_multiplier(&runtime.champions[idx]);
                let damage = runtime.champions[idx].attack_damage
                    * CHAMPION_DAMAGE_TO_MINION_MULTIPLIER
                    * lane_mult;
                runtime.minions[minion_idx].hp -= damage;
                runtime.minions[minion_idx].last_hit_by_champion_id =
                    Some(runtime.champions[idx].id.clone());
                runtime.champions[idx].attack_cd_until = now + 0.75;
                if runtime.minions[minion_idx].hp <= 0.0 {
                    register_minion_death(runtime, minion_idx);
                }
                continue;
            }
            CombatTarget::Structure(structure_idx) => {
                if structure_idx >= runtime.structures.len()
                    || !runtime.structures[structure_idx].alive
                    || !is_structure_targetable(
                        &runtime.structures,
                        &team,
                        &runtime.structures[structure_idx],
                    )
                {
                    continue;
                }
                let structure_mult = champion_structure_focus_multiplier(&runtime.champions[idx]);
                apply_damage_to_structure(
                    runtime,
                    structure_idx,
                    runtime.champions[idx].attack_damage * structure_mult,
                    &team,
                );
                runtime.champions[idx].attack_cd_until = now + 0.9;
            }
            CombatTarget::Neutral(neutral_key) => {
                if attack_neutral_if_in_range(runtime, &mut neutral_timers, idx, &neutral_key) {
                    continue;
                }
            }
        }
    }

    if let Ok(value) = serde_json::to_value(&neutral_timers) {
        runtime.neutral_timers = value;
    }
    sync_objectives_from_neutral_timers(runtime, &neutral_timers);
}
