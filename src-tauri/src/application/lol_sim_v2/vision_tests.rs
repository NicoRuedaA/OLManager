use std::collections::HashMap;

use super::test_helpers::{test_champion, test_runtime};
use super::*;

#[test]
fn sweeper_is_jgl_sup_only_and_clears_enemy_wards() {
    let neutral = NeutralTimersRuntime {
        dragon_soul_unlocked: false,
        elder_unlocked: false,
        entities: HashMap::new(),
        extra: HashMap::new(),
    };

    let mut jgl = test_champion("jgl-blue", "blue", "JGL", "mid", Vec2 { x: 0.50, y: 0.50 });
    jgl.sweeper_cd_until = 0.0;
    jgl.trinket_key = TRINKET_ORACLE_LENS.to_string();
    let mut top = test_champion("top-blue", "blue", "TOP", "top", Vec2 { x: 0.50, y: 0.50 });
    top.sweeper_cd_until = 0.0;

    let mut runtime = test_runtime(vec![jgl, top], vec![], vec![], neutral);
    runtime.wards.push(WardRuntime {
        id: "w-red".to_string(),
        team: "red".to_string(),
        owner_champion_id: "mid-red".to_string(),
        pos: Vec2 { x: 0.51, y: 0.50 },
        expires_at: runtime.time_sec + 60.0,
    });

    process_sweepers(&mut runtime);

    assert!(runtime.wards.is_empty());
    assert!(runtime.champions[0].sweeper_active_until > runtime.time_sec);
    assert_eq!(runtime.champions[1].sweeper_active_until, 0.0);
}

#[test]
fn jgl_swaps_to_oracle_on_first_recall_after_minute_six() {
    let neutral = NeutralTimersRuntime {
        dragon_soul_unlocked: false,
        elder_unlocked: false,
        entities: HashMap::new(),
        extra: HashMap::new(),
    };

    let mut jgl = test_champion("jgl-blue", "blue", "JGL", "mid", Vec2 { x: 0.50, y: 0.50 });
    jgl.state = "recall".to_string();
    jgl.recall_channel_until = TRINKET_SWAP_UNLOCK_AT_SEC + 1.0;

    let mut runtime = test_runtime(vec![jgl], vec![], vec![], neutral);
    runtime.time_sec = TRINKET_SWAP_UNLOCK_AT_SEC + 1.0;

    move_champions(&mut runtime, 0.1);

    assert_eq!(runtime.champions[0].trinket_key, TRINKET_ORACLE_LENS);
    assert!(runtime.champions[0].trinket_swapped);
}

#[test]
fn jgl_no_longer_places_wards_after_oracle_swap() {
    let neutral = NeutralTimersRuntime {
        dragon_soul_unlocked: false,
        elder_unlocked: false,
        entities: HashMap::new(),
        extra: HashMap::new(),
    };

    let mut jgl = test_champion("jgl-blue", "blue", "JGL", "mid", Vec2 { x: 0.52, y: 0.52 });
    jgl.trinket_key = TRINKET_ORACLE_LENS.to_string();
    jgl.trinket_swapped = true;
    jgl.ward_cd_until = 0.0;

    let mut runtime = test_runtime(vec![jgl], vec![], vec![], neutral);
    runtime.time_sec = TRINKET_SWAP_UNLOCK_AT_SEC + 60.0;

    place_wards(&mut runtime);

    assert!(runtime.wards.is_empty());
}

#[test]
fn wards_use_strategic_points_not_raw_champion_position() {
    let neutral = NeutralTimersRuntime {
        dragon_soul_unlocked: false,
        elder_unlocked: false,
        entities: HashMap::new(),
        extra: HashMap::new(),
    };

    let mut sup = test_champion("sup-blue", "blue", "SUP", "bot", Vec2 { x: 0.60, y: 0.61 });
    sup.ward_cd_until = 0.0;
    sup.trinket_key = TRINKET_WARDING_TOTEM.to_string();

    let mut runtime = test_runtime(vec![sup], vec![], vec![], neutral);
    runtime.time_sec = WARD_UNLOCK_AT_SEC + 30.0;

    place_wards(&mut runtime);
    assert_eq!(runtime.wards.len(), 1);
    let ward_pos = runtime.wards[0].pos;
    assert!(
        dist(ward_pos, Vec2 { x: 0.615, y: 0.61 }) < 0.03
            || dist(ward_pos, Vec2 { x: 0.565, y: 0.455 }) < 0.03
    );
}
