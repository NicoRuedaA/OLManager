use super::*;
use std::cmp::Ordering;

pub(super) enum ChampionObjectiveAssistPlan {
    None,
    HardAssist { objective_key: String, objective_pos: Vec2 },
    ObjectiveAssist { objective_key: String, objective_pos: Vec2 },
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
        let contested = contested_dragon_attempt_for_team(&team, &runtime.champions, neutral_timers);
        should_hard_assist_contested_dragon(champion, contested)
    };

    if is_hard_assist {
        if let Some(dragon) = contested_dragon_attempt_for_team(&team, &runtime.champions, neutral_timers)
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

pub(super) fn target_priority_rank_for_fight_plan(
    fight_plan: &str,
    enemy: &ChampionRuntime,
) -> u8 {
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
                compare_by_hp_distance_stable(champion.pos, *idx_a, a.hp, a.pos, *idx_b, b.hp, b.pos)
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
                && (normalized_lane(&s.lane) == normalized_lane(&champion.lane) || s.kind == "nexus")
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
                || !(normalized_lane(&s.lane) == normalized_lane(&champion.lane) || s.kind == "nexus")
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
