use serde_json::Value;

use super::{runtime_buffs_from_extra, NeutralTimerRuntime, NeutralTimersRuntime, RuntimeState, OBJECTIVE_NEXT_SPAWN_FALLBACK};

pub(super) struct NeutralTimerTickResult {
    pub(super) spawn_text: Option<String>,
    pub(super) despawn_text: Option<String>,
    pub(super) voidgrubs_expired_with_remaining_hp: bool,
}

pub(super) struct VoidgrubExpirationInput {
    pub(super) blue_stacks: i64,
    pub(super) red_stacks: i64,
}

pub(super) struct VoidgrubExpirationEffect {
    pub(super) winner_team: &'static str,
    pub(super) stacks_to_award: i64,
}

pub(super) enum NeutralCaptureKind {
    Dragon,
    Baron,
    Elder,
    Herald,
    Voidgrubs,
    OtherObjective,
}

pub(super) struct NeutralCaptureDecision {
    pub(super) kind: NeutralCaptureKind,
    pub(super) event_type: &'static str,
}

pub(super) fn resolve_neutral_capture_decision(key: &str) -> Option<NeutralCaptureDecision> {
    let kind = match key {
        "dragon" => NeutralCaptureKind::Dragon,
        "baron" => NeutralCaptureKind::Baron,
        "elder" => NeutralCaptureKind::Elder,
        "herald" => NeutralCaptureKind::Herald,
        "voidgrubs" => NeutralCaptureKind::Voidgrubs,
        "scuttle-top" | "scuttle-bot" => NeutralCaptureKind::OtherObjective,
        _ => return None,
    };

    let event_type = match kind {
        NeutralCaptureKind::Dragon | NeutralCaptureKind::Elder => "dragon",
        NeutralCaptureKind::Baron => "baron",
        _ => "info",
    };

    Some(NeutralCaptureDecision { kind, event_type })
}

pub(super) fn resolve_voidgrub_expiration_effect(
    expired_with_remaining_hp: bool,
    stacks: VoidgrubExpirationInput,
) -> Option<VoidgrubExpirationEffect> {
    if !expired_with_remaining_hp {
        return None;
    }

    let total = (stacks.blue_stacks + stacks.red_stacks).clamp(0, 3);
    let remaining = (3 - total).max(0);
    if remaining <= 0 {
        return None;
    }

    let winner_team = if stacks.red_stacks > stacks.blue_stacks {
        "red"
    } else {
        "blue"
    };

    Some(VoidgrubExpirationEffect {
        winner_team,
        stacks_to_award: remaining,
    })
}

pub(super) fn current_dragon_kind(neutral_timers: &NeutralTimersRuntime) -> String {
    let raw = neutral_timers
        .extra
        .get("dragonCurrentKind")
        .and_then(Value::as_str)
        .unwrap_or("infernal")
        .trim()
        .to_lowercase();

    match raw.as_str() {
        "infernal" | "ocean" | "mountain" | "cloud" | "hextech" | "chemtech" => raw,
        _ => "infernal".to_string(),
    }
}

pub(super) fn set_current_dragon_kind(neutral_timers: &mut NeutralTimersRuntime, kind: &str) {
    neutral_timers
        .extra
        .insert("dragonCurrentKind".to_string(), Value::from(kind));
}

pub(super) fn choose_different_dragon_kind(base_kind: &str, seed: i64) -> &'static str {
    const KINDS: [&str; 6] = [
        "infernal", "ocean", "mountain", "cloud", "hextech", "chemtech",
    ];
    let mut options: Vec<&str> = KINDS
        .into_iter()
        .filter(|kind| *kind != base_kind)
        .collect();
    if options.is_empty() {
        return "infernal";
    }
    let idx = (seed.unsigned_abs() as usize) % options.len();
    options.swap_remove(idx)
}

pub(super) fn choose_dragon_kind_excluding(excluded: &[&str], seed: i64) -> &'static str {
    const KINDS: [&str; 6] = [
        "infernal", "ocean", "mountain", "cloud", "hextech", "chemtech",
    ];
    let mut options: Vec<&str> = KINDS
        .into_iter()
        .filter(|kind| !excluded.iter().any(|excluded_kind| excluded_kind == kind))
        .collect();
    if options.is_empty() {
        return "infernal";
    }
    let idx = (seed.unsigned_abs() as usize) % options.len();
    options.swap_remove(idx)
}

pub(super) fn ensure_dragon_cycle_defaults(
    champion_ids: impl Iterator<Item = String>,
    neutral_timers: &mut NeutralTimersRuntime,
) {
    if neutral_timers.extra.get("dragonCurrentKind").is_some() {
        return;
    }
    let seed = champion_ids.fold(0_i64, |acc, id| {
        acc + id.bytes().fold(0_i64, |s, b| s + b as i64)
    });
    let first = choose_different_dragon_kind("", seed);
    set_current_dragon_kind(neutral_timers, first);
    neutral_timers
        .extra
        .insert("dragonFirstKind".to_string(), Value::from(""));
    neutral_timers
        .extra
        .insert("dragonSecondKind".to_string(), Value::from(""));
    neutral_timers
        .extra
        .insert("dragonSoulRiftKind".to_string(), Value::from(""));
}

pub(super) fn sync_objectives_from_neutral_timers(
    runtime: &mut RuntimeState,
    neutral_timers: &NeutralTimersRuntime,
) {
    let Some(objectives) = runtime.objectives.as_object_mut() else {
        return;
    };

    let buffs = runtime_buffs_from_extra(runtime.extra.get("teamBuffs"));

    if let Some(dragon_timer) = neutral_timers.entities.get("dragon") {
        sync_dragon_objective(objectives, neutral_timers, dragon_timer, buffs.blue.dragon_stacks, buffs.red.dragon_stacks, buffs.blue.soul_kind.is_some(), buffs.red.soul_kind.is_some());
    }

    if let Some(baron_timer) = neutral_timers.entities.get("baron") {
        sync_baron_objective(objectives, baron_timer);
    }
}

pub(super) fn sync_dragon_timer_kind(neutral_timers: &mut NeutralTimersRuntime) {
    let dragon_kind = current_dragon_kind(neutral_timers);
    if let Some(dragon_timer) = neutral_timers.entities.get_mut("dragon") {
        dragon_timer
            .extra
            .insert("dragonCurrentKind".to_string(), Value::from(dragon_kind));
    }
}

pub(super) fn unlock_elder_if_needed(neutral_timers: &mut NeutralTimersRuntime, now: f64) {
    if !neutral_timers.elder_unlocked {
        return;
    }

    if let Some(elder) = neutral_timers.entities.get_mut("elder") {
        if !elder.unlocked {
            elder.unlocked = true;
            elder.next_spawn_at = Some(now + 6.0 * 60.0);
        }
    }
}

pub(super) fn tick_neutral_entity_timer(
    neutral_timers: &mut NeutralTimersRuntime,
    key: &str,
    now: f64,
) -> NeutralTimerTickResult {
    let mut spawn_text: Option<String> = None;
    let mut despawn_text: Option<String> = None;
    let mut voidgrubs_expired_with_remaining_hp = false;

    if let Some(timer) = neutral_timers.entities.get_mut(key) {
        let can_spawn = timer.unlocked
            && !timer.alive
            && timer.next_spawn_at.is_some()
            && now >= timer.next_spawn_at.unwrap_or(f64::INFINITY);
        if can_spawn {
            timer.alive = true;
            timer.hp = timer.max_hp;
            timer.last_spawn_at = timer.next_spawn_at;
            timer.times_spawned += 1;
            spawn_text = Some(format!("{} spawned", timer.label));
        }

        if timer.alive {
            if let Some(grace_until) = timer.combat_grace_until {
                if now >= grace_until {
                    let had_remaining_hp = timer.hp > 0.0;
                    timer.alive = false;
                    timer.hp = 0.0;
                    timer.next_spawn_at = None;
                    despawn_text = Some(format!("{} despawned", timer.label));

                    if key == "voidgrubs" && had_remaining_hp {
                        voidgrubs_expired_with_remaining_hp = true;
                    }
                }
            }
        }
    }

    NeutralTimerTickResult {
        spawn_text,
        despawn_text,
        voidgrubs_expired_with_remaining_hp,
    }
}

fn sync_dragon_objective(
    objectives: &mut serde_json::Map<String, Value>,
    neutral_timers: &NeutralTimersRuntime,
    dragon_timer: &NeutralTimerRuntime,
    blue_dragon_stacks: i64,
    red_dragon_stacks: i64,
    blue_has_soul: bool,
    red_has_soul: bool,
) {
    let Some(dragon_obj) = objectives.get_mut("dragon").and_then(Value::as_object_mut) else {
        return;
    };

    dragon_obj.insert("alive".to_string(), Value::from(dragon_timer.alive));
    dragon_obj.insert(
        "nextSpawnAt".to_string(),
        Value::from(next_spawn_or_fallback(dragon_timer)),
    );
    dragon_obj.insert(
        "currentKind".to_string(),
        Value::from(current_dragon_kind(neutral_timers)),
    );
    dragon_obj.insert(
        "firstKind".to_string(),
        neutral_timers
            .extra
            .get("dragonFirstKind")
            .cloned()
            .unwrap_or(Value::from("")),
    );
    dragon_obj.insert(
        "secondKind".to_string(),
        neutral_timers
            .extra
            .get("dragonSecondKind")
            .cloned()
            .unwrap_or(Value::from("")),
    );
    dragon_obj.insert(
        "soulRiftKind".to_string(),
        neutral_timers
            .extra
            .get("dragonSoulRiftKind")
            .cloned()
            .unwrap_or(Value::from("")),
    );
    dragon_obj.insert("homeStacks".to_string(), Value::from(blue_dragon_stacks));
    dragon_obj.insert("awayStacks".to_string(), Value::from(red_dragon_stacks));
    dragon_obj.insert(
        "soulClaimedBy".to_string(),
        if blue_has_soul {
            Value::from("Home")
        } else if red_has_soul {
            Value::from("Away")
        } else {
            Value::Null
        },
    );
}

fn sync_baron_objective(
    objectives: &mut serde_json::Map<String, Value>,
    baron_timer: &NeutralTimerRuntime,
) {
    let Some(baron_obj) = objectives.get_mut("baron").and_then(Value::as_object_mut) else {
        return;
    };
    baron_obj.insert("alive".to_string(), Value::from(baron_timer.alive));
    baron_obj.insert(
        "nextSpawnAt".to_string(),
        Value::from(next_spawn_or_fallback(baron_timer)),
    );
}

fn next_spawn_or_fallback(timer: &NeutralTimerRuntime) -> f64 {
    timer.next_spawn_at.unwrap_or(OBJECTIVE_NEXT_SPAWN_FALLBACK)
}
