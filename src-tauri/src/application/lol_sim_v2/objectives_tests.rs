use std::collections::HashMap;

use super::test_helpers::{test_champion, test_neutral_timer, test_runtime};
use super::*;

#[test]
fn dragon_kind_is_mirrored_into_timer_entity_on_tick() {
    let mut entities = HashMap::new();
    entities.insert(
        "dragon".to_string(),
        test_neutral_timer(
            "dragon",
            Vec2 {
                x: 0.6738,
                y: 0.7031,
            },
            true,
        ),
    );

    let mut neutral = NeutralTimersRuntime {
        dragon_soul_unlocked: false,
        elder_unlocked: false,
        entities,
        extra: HashMap::new(),
    };
    neutral
        .extra
        .insert("dragonCurrentKind".to_string(), Value::from("ocean"));

    let mut runtime = test_runtime(vec![], vec![], vec![], neutral);
    tick_neutral_timers(&mut runtime);

    let decoded = decode_neutral_timers_state(&runtime.neutral_timers)
        .unwrap_or_else(|| panic!("failed to decode neutral timers"));
    let dragon_timer = decoded
        .entities
        .get("dragon")
        .unwrap_or_else(|| panic!("dragon timer missing"));

    assert_eq!(
        dragon_timer
            .extra
            .get("dragonCurrentKind")
            .and_then(Value::as_str),
        Some("ocean")
    );
}

#[test]
fn dragon_soul_unlocks_elder_after_fourth_stack() {
    let mut entities = HashMap::new();
    let mut dragon = test_neutral_timer(
        "dragon",
        Vec2 {
            x: 0.6738,
            y: 0.7031,
        },
        true,
    );
    dragon.next_spawn_at = Some(0.0);
    entities.insert("dragon".to_string(), dragon);

    let mut elder = test_neutral_timer(
        "elder",
        Vec2 {
            x: 0.6738,
            y: 0.7031,
        },
        false,
    );
    elder.unlocked = false;
    elder.next_spawn_at = None;
    entities.insert("elder".to_string(), elder);

    let mut neutral = NeutralTimersRuntime {
        dragon_soul_unlocked: false,
        elder_unlocked: false,
        entities,
        extra: HashMap::new(),
    };
    neutral
        .extra
        .insert("dragonCurrentKind".to_string(), Value::from("infernal"));
    neutral
        .extra
        .insert("dragonSoulRiftKind".to_string(), Value::from("infernal"));

    let killer = test_champion("jgl-blue", "blue", "JGL", "bot", Vec2 { x: 0.67, y: 0.70 });
    let mut runtime = test_runtime(vec![killer], vec![], vec![], neutral);

    let buffs = RuntimeBuffState {
        blue: RuntimeTeamBuffState {
            dragon_stacks: 3,
            ..RuntimeTeamBuffState::default()
        },
        red: RuntimeTeamBuffState::default(),
    };
    set_runtime_buffs(&mut runtime, &buffs);

    let mut timers = decode_neutral_timers_state(&runtime.neutral_timers)
        .unwrap_or_else(|| panic!("failed to decode neutral timers"));
    let dragon_kind = process_dragon_capture(&mut runtime, &mut timers, "blue");

    assert_eq!(dragon_kind, "infernal");
    assert!(timers.dragon_soul_unlocked);
    assert!(timers.elder_unlocked);

    let elder_timer = timers
        .entities
        .get("elder")
        .unwrap_or_else(|| panic!("elder timer missing"));
    assert!(elder_timer.unlocked);
    assert!(elder_timer.next_spawn_at.is_some());

    let blue_buffs = team_buffs_for_runtime(runtime.extra.get("teamBuffs"), "blue");
    assert_eq!(blue_buffs.dragon_stacks, 4);
    assert_eq!(blue_buffs.soul_kind.as_deref(), Some("infernal"));
}

#[test]
fn dragon_cycle_progresses_a_b_then_soul_rift_c_repeats() {
    let mut entities = HashMap::new();
    let mut dragon = test_neutral_timer(
        "dragon",
        Vec2 {
            x: 0.6738,
            y: 0.7031,
        },
        true,
    );
    dragon.next_spawn_at = Some(0.0);
    entities.insert("dragon".to_string(), dragon);

    let mut elder = test_neutral_timer(
        "elder",
        Vec2 {
            x: 0.6738,
            y: 0.7031,
        },
        false,
    );
    elder.unlocked = false;
    elder.next_spawn_at = None;
    entities.insert("elder".to_string(), elder);

    let neutral = NeutralTimersRuntime {
        dragon_soul_unlocked: false,
        elder_unlocked: false,
        entities,
        extra: HashMap::new(),
    };

    let killer_blue = test_champion("jgl-blue", "blue", "JGL", "bot", Vec2 { x: 0.67, y: 0.70 });
    let killer_red = test_champion("jgl-red", "red", "JGL", "bot", Vec2 { x: 0.67, y: 0.70 });
    let mut runtime = test_runtime(vec![killer_blue, killer_red], vec![], vec![], neutral);

    let mut timers = decode_neutral_timers_state(&runtime.neutral_timers)
        .unwrap_or_else(|| panic!("failed to decode neutral timers"));

    runtime.time_sec = 600.0;
    let first_kind = process_dragon_capture(&mut runtime, &mut timers, "blue");
    runtime.time_sec += 5.0;
    let second_kind = process_dragon_capture(&mut runtime, &mut timers, "red");
    runtime.time_sec += 5.0;
    let third_kind = process_dragon_capture(&mut runtime, &mut timers, "blue");
    runtime.time_sec += 5.0;
    let fourth_kind = process_dragon_capture(&mut runtime, &mut timers, "red");

    assert_ne!(first_kind, second_kind);
    assert_ne!(third_kind, first_kind);
    assert_ne!(third_kind, second_kind);
    assert_eq!(fourth_kind, third_kind);

    assert_eq!(
        timers.extra.get("dragonFirstKind").and_then(Value::as_str),
        Some(first_kind.as_str())
    );
    assert_eq!(
        timers.extra.get("dragonSecondKind").and_then(Value::as_str),
        Some(second_kind.as_str())
    );
    assert_eq!(
        timers
            .extra
            .get("dragonSoulRiftKind")
            .and_then(Value::as_str),
        Some(third_kind.as_str())
    );
    assert_eq!(
        timers
            .extra
            .get("dragonCurrentKind")
            .and_then(Value::as_str),
        Some(third_kind.as_str())
    );
}
