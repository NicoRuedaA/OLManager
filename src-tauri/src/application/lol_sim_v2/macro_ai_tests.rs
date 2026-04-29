use std::collections::HashMap;

use super::test_helpers::{test_champion, test_neutral_timer, test_runtime};
use super::*;

#[test]
fn jgl_disengage_prefers_jungle_camp_fallback() {
    let jungler = test_champion("jgl-blue", "blue", "JGL", "bot", Vec2 { x: 0.46, y: 0.61 });
    let mut entities = HashMap::new();
    entities.insert(
        "gromp-blue".to_string(),
        test_neutral_timer("gromp-blue", Vec2 { x: 0.16, y: 0.43 }, true),
    );
    let neutral = NeutralTimersRuntime {
        dragon_soul_unlocked: false,
        elder_unlocked: false,
        entities,
        extra: HashMap::new(),
    };
    let mut runtime = test_runtime(vec![jungler], vec![], vec![], neutral);

    issue_lane_disengage(&mut runtime, 0, Vec2 { x: 0.52, y: 0.65 });

    let target = runtime.champions[0].target_path.last().copied();
    assert!(target.is_some());
    let p = target.unwrap_or(Vec2 { x: 0.0, y: 0.0 });
    assert!(dist(p, Vec2 { x: 0.16, y: 0.43 }) <= 0.02);
}

#[test]
fn red_jungler_macro_prefers_own_side_buffs_first() {
    let red_jgl = test_champion("jgl-red", "red", "JGL", "bot", Vec2 { x: 0.75, y: 0.55 });
    let blue_jgl = test_champion("jgl-blue", "blue", "JGL", "bot", Vec2 { x: 0.25, y: 0.46 });

    let mut entities = HashMap::new();
    entities.insert(
        "blue-buff-blue".to_string(),
        test_neutral_timer("blue-buff-blue", Vec2 { x: 0.25, y: 0.46 }, true),
    );
    entities.insert(
        "blue-buff-red".to_string(),
        test_neutral_timer("blue-buff-red", Vec2 { x: 0.48, y: 0.26 }, true),
    );

    let neutral = NeutralTimersRuntime {
        dragon_soul_unlocked: false,
        elder_unlocked: false,
        entities,
        extra: HashMap::new(),
    };

    let default_tactics = RuntimeTeamTactics::default();
    let champions = vec![red_jgl.clone(), blue_jgl.clone()];
    let red_pick =
        pick_macro_objective_pos(&red_jgl, &champions, &neutral, 120.0, &default_tactics);
    let blue_pick =
        pick_macro_objective_pos(&blue_jgl, &champions, &neutral, 120.0, &default_tactics);

    assert_eq!(red_pick.map(|p| (p.x, p.y)), Some((0.48, 0.26)));
    assert_eq!(blue_pick.map(|p| (p.x, p.y)), Some((0.25, 0.46)));
}

#[test]
fn jungle_pathing_bot_to_top_invades_enemy_top_side_first_for_both_teams() {
    let blue_order = jungler_macro_jungle_priority_for_team("blue", "BotToTop");
    let red_order = jungler_macro_jungle_priority_for_team("red", "BotToTop");

    assert_eq!(blue_order[8], "blue-buff-red");
    assert_eq!(red_order[8], "blue-buff-blue");
}

#[test]
fn jungle_pathing_top_to_bot_invades_enemy_bot_side_first_for_both_teams() {
    let blue_order = jungler_macro_jungle_priority_for_team("blue", "TopToBot");
    let red_order = jungler_macro_jungle_priority_for_team("red", "TopToBot");

    assert_eq!(blue_order[8], "red-buff-red");
    assert_eq!(red_order[8], "red-buff-blue");
}

#[test]
fn jungle_disengage_fallback_honors_pathing_start_side_for_blue_and_red() {
    let blue_bot_to_top = jungle_disengage_fallback_order_for_team("blue", "BotToTop");
    let blue_top_to_bot = jungle_disengage_fallback_order_for_team("blue", "TopToBot");
    let red_bot_to_top = jungle_disengage_fallback_order_for_team("red", "BotToTop");
    let red_top_to_bot = jungle_disengage_fallback_order_for_team("red", "TopToBot");

    assert_eq!(blue_bot_to_top[0], "raptors-blue");
    assert_eq!(blue_top_to_bot[0], "gromp-blue");
    assert_eq!(red_bot_to_top[0], "raptors-red");
    assert_eq!(red_top_to_bot[0], "gromp-red");
}
