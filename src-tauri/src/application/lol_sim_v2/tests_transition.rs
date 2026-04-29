use super::*;

#[allow(dead_code)]
pub(super) fn decode_neutral_for_transition(runtime: &RuntimeState) -> NeutralTimersRuntime {
    decode_neutral_timers_state(&runtime.neutral_timers)
        .unwrap_or_else(neutral_timers_default_runtime_state)
}

fn test_champion(id: &str, team: &str, role: &str, lane: &str, pos: Vec2) -> ChampionRuntime {
    ChampionRuntime {
        id: id.to_string(),
        name: id.to_string(),
        champion_id: String::new(),
        team: team.to_string(),
        role: role.to_string(),
        lane: lane.to_string(),
        pos,
        hp: 100.0,
        max_hp: 100.0,
        alive: true,
        respawn_at: 0.0,
        attack_cd_until: 0.0,
        move_speed: 0.07,
        attack_range: 0.055,
        attack_type: "ranged".to_string(),
        attack_damage: 10.0,
        target_path: Vec::new(),
        target_path_index: 0,
        next_decision_at: 0.0,
        kills: 0,
        deaths: 0,
        assists: 0,
        gold: 0,
        spent_gold: 0,
        xp: 0,
        level: 1,
        cs: 0,
        has_left_base_once: false,
        last_support_cs_at: -999.0,
        items: Vec::new(),
        gameplay_score: 70.0,
        iq_score: 70.0,
        competitive_score: 70.0,
        staff_execution: 1.0,
        summoner_spells: vec![],
        ultimate: None,
        ignite_dot_until: 0.0,
        ignite_source_id: None,
        last_damaged_by_champion_id: None,
        last_damaged_by_champion_at: -999.0,
        last_damaged_at: -999.0,
        state: "lane".to_string(),
        recall_anchor: None,
        recall_channel_until: 0.0,
        realm_banished_until: 0.0,
        realm_return_pos: None,
        ward_cd_until: 0.0,
        sweeper_cd_until: 0.0,
        sweeper_active_until: 0.0,
        trinket_key: TRINKET_WARDING_TOTEM.to_string(),
        trinket_swapped: false,
        support_roam_uses: 0,
        support_roam_cd_until: 0.0,
        support_last_roam_role: String::new(),
    }
}

fn test_minion(id: &str, team: &str, lane: &str, pos: Vec2) -> MinionRuntime {
    MinionRuntime {
        id: id.to_string(),
        team: team.to_string(),
        lane: lane.to_string(),
        pos,
        hp: 20.0,
        max_hp: 20.0,
        alive: true,
        kind: "melee".to_string(),
        last_hit_by_champion_id: None,
        owner_champion_id: None,
        summon_kind: None,
        summon_expires_at: 0.0,
        attack_cd_until: 0.0,
        move_speed: 0.06,
        attack_range: 0.04,
        attack_damage: 6.0,
        path: vec![pos],
        path_index: 0,
    }
}

fn test_structure(id: &str, team: &str, lane: &str, pos: Vec2) -> StructureRuntime {
    StructureRuntime {
        id: id.to_string(),
        team: team.to_string(),
        lane: lane.to_string(),
        kind: "tower".to_string(),
        pos,
        hp: 1000.0,
        max_hp: 1000.0,
        alive: true,
        attack_cd_until: 0.0,
        forced_target_champion_id: None,
        forced_target_until: 0.0,
    }
}

fn test_runtime(
    champions: Vec<ChampionRuntime>,
    minions: Vec<MinionRuntime>,
    structures: Vec<StructureRuntime>,
    neutral_timers: NeutralTimersRuntime,
) -> RuntimeState {
    RuntimeState {
        time_sec: LANE_COMBAT_UNLOCK_AT + 1.0,
        running: true,
        speed: 1.0,
        ai_mode: SimulatorAiMode::Rules,
        policy: SimulatorPolicyConfig::default(),
        winner: None,
        show_walls: false,
        champions,
        minions,
        structures,
        wards: Vec::new(),
        objectives: json!({}),
        neutral_timers: serde_json::to_value(neutral_timers).unwrap_or(json!({})),
        stats: RuntimeStats::default(),
        events: Vec::new(),
        lane_combat_state_by_champion: HashMap::new(),
        extra: HashMap::new(),
    }
}

fn test_neutral_timer(key: &str, pos: Vec2, alive: bool) -> NeutralTimerRuntime {
    NeutralTimerRuntime {
        key: key.to_string(),
        label: key.to_string(),
        alive,
        hp: 1000.0,
        max_hp: 1000.0,
        next_spawn_at: None,
        first_spawn_at: 0.0,
        respawn_delay_sec: Some(120.0),
        one_shot: false,
        window_close_at: None,
        combat_grace_until: None,
        unlocked: true,
        last_spawn_at: Some(0.0),
        last_taken_at: None,
        times_spawned: 1,
        times_taken: 0,
        pos,
        extra: HashMap::new(),
    }
}

#[test]
fn transition_bridge_pick_combat_target_wrapper_keeps_signature() {
    let runtime = RuntimeState::default();
    let neutral = decode_neutral_for_transition(&runtime);
    let selected = pick_combat_target(&runtime, 0, runtime.time_sec, &neutral);
    assert!(selected.is_none());
}

#[test]
fn transition_objective_assist_prioritizes_objective_over_farm_lock() {
    let adc = test_champion("adc-blue", "blue", "ADC", "bot", Vec2 { x: 0.62, y: 0.73 });
    let jungler = test_champion("jgl-blue", "blue", "JGL", "bot", Vec2 { x: 0.64, y: 0.71 });
    let mut enemy = test_champion("mid-red", "red", "MID", "mid", Vec2 { x: 0.82, y: 0.70 });
    enemy.attack_damage = 1.0;

    let minion = test_minion("m-red-1", "red", "bot", Vec2 { x: 0.625, y: 0.735 });

    let mut entities = HashMap::new();
    entities.insert(
        "dragon".to_string(),
        test_neutral_timer("dragon", Vec2 { x: 0.67, y: 0.70 }, true),
    );
    let neutral = NeutralTimersRuntime {
        dragon_soul_unlocked: false,
        elder_unlocked: false,
        entities,
        extra: HashMap::new(),
    };

    let runtime = test_runtime(vec![adc, jungler, enemy], vec![minion], vec![], neutral.clone());

    let target = pick_combat_target(&runtime, 0, runtime.time_sec, &neutral);
    assert!(matches!(target, Some(CombatTarget::Neutral(ref key)) if key == "dragon"));
}

#[test]
fn transition_structure_pressure_blocked_with_two_enemy_minions_near_tower() {
    let laner = test_champion("top-blue", "blue", "TOP", "top", Vec2 { x: 0.28, y: 0.09 });
    let tower = test_structure(
        "red-top-outer",
        "red",
        "top",
        Vec2 {
            x: 0.275390625,
            y: 0.07161458333333333,
        },
    );

    let allied_wave = test_minion("m-blue-1", "blue", "top", Vec2 { x: 0.29, y: 0.08 });
    let enemy_wave_1 = test_minion("m-red-1", "red", "top", Vec2 { x: 0.27, y: 0.074 });
    let enemy_wave_2 = test_minion("m-red-2", "red", "top", Vec2 { x: 0.271, y: 0.073 });

    let neutral = NeutralTimersRuntime {
        dragon_soul_unlocked: false,
        elder_unlocked: false,
        entities: HashMap::new(),
        extra: HashMap::new(),
    };

    let runtime = test_runtime(
        vec![laner],
        vec![allied_wave, enemy_wave_1, enemy_wave_2],
        vec![tower],
        neutral.clone(),
    );

    let target = pick_combat_target(&runtime, 0, runtime.time_sec, &neutral);
    assert!(!matches!(target, Some(CombatTarget::Structure(_))));
}
