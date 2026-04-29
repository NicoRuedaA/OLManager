use super::test_helpers::{empty_neutral, test_minion, test_runtime, test_structure};
use super::*;

#[test]
fn baron_push_targets_inhib_before_nexus() {
    let mut red_inhib = test_structure("red-inhib-bot", "red", "base", Vec2 { x: 0.91, y: 0.25 });
    red_inhib.kind = "inhib".to_string();
    let red_nexus = test_structure("red-nexus", "red", "base", Vec2 { x: 0.891, y: 0.117 });
    let target = baron_push_target_for_lane(&[red_inhib.clone(), red_nexus], "blue", "bot");
    let target = target.expect("expected Baron push to target inhibitor before nexus");
    assert!(dist(target, red_inhib.pos) < 1e-9);
}

#[test]
fn minion_can_target_inhib_after_inhib_tower_is_down() {
    let mut blue = test_minion("m-blue-1", "blue", "mid", Vec2 { x: 0.79, y: 0.22 });
    blue.attack_damage = 10.0;
    blue.attack_range = 0.06;

    let mut red_inhib = test_structure(
        "red-inhib-mid",
        "red",
        "base",
        Vec2 {
            x: 0.7832,
            y: 0.2240,
        },
    );
    red_inhib.kind = "inhib".to_string();
    red_inhib.hp = 200.0;

    let mut runtime = test_runtime(vec![], vec![blue], vec![red_inhib], empty_neutral());
    let hp_before = runtime.structures[0].hp;
    resolve_minion_combat(&mut runtime);
    assert!(runtime.structures[0].hp < hp_before);
}

#[test]
fn minion_cannot_target_nexus_tower_while_lane_inhib_alive() {
    let mut blue = test_minion("m-blue-1", "blue", "top", Vec2 { x: 0.846, y: 0.133 });
    blue.attack_damage = 10.0;
    blue.attack_range = 0.06;

    let mut red_nexus_top_tower = test_structure(
        "red-nexus-top-tower",
        "red",
        "base",
        Vec2 {
            x: 0.845703125,
            y: 0.1328125,
        },
    );
    red_nexus_top_tower.hp = 200.0;
    let red_inhib_top = test_structure(
        "red-inhib-top",
        "red",
        "base",
        Vec2 {
            x: 0.7545572916666666,
            y: 0.09114583333333333,
        },
    );

    let mut runtime = test_runtime(
        vec![],
        vec![blue],
        vec![red_nexus_top_tower, red_inhib_top],
        empty_neutral(),
    );
    let hp_before = runtime.structures[0].hp;
    resolve_minion_combat(&mut runtime);
    assert_eq!(runtime.structures[0].hp, hp_before);
}

#[test]
fn minion_can_target_nexus_tower_after_lane_inhib_is_down() {
    let mut blue = test_minion("m-blue-1", "blue", "top", Vec2 { x: 0.846, y: 0.133 });
    blue.attack_damage = 10.0;
    blue.attack_range = 0.06;

    let mut red_nexus_top_tower = test_structure(
        "red-nexus-top-tower",
        "red",
        "base",
        Vec2 {
            x: 0.845703125,
            y: 0.1328125,
        },
    );
    red_nexus_top_tower.hp = 200.0;

    let mut runtime = test_runtime(
        vec![],
        vec![blue],
        vec![red_nexus_top_tower],
        empty_neutral(),
    );
    let hp_before = runtime.structures[0].hp;
    resolve_minion_combat(&mut runtime);
    assert!(runtime.structures[0].hp < hp_before);
}
