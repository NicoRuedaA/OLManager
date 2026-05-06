import type { PlayerData } from "../store/gameStore";
import type { LolRole } from "../store/types";

/**
 * Base OVR: simple average of the 9 visible LoL stats.
 * Same formula as calculate_lol_ovr() in Rust (potential.rs).
 */
function baseOvr(player: PlayerData): number {
  const a = player.attributes;
  return Math.round(
    Math.max(1, Math.min(99,
      (a.mechanics +
        a.laning +
        a.teamfighting +
        a.macro_play +
        a.consistency +
        a.shotcalling +
        a.champion_pool +
        a.discipline +
        a.mental_resilience) / 9
    ))
  );
}

/**
 * Compatibility penalty based on role match
 * - Primary role (natural_position): 0 penalty
 * - Alternate role: 4.0 penalty
 * - Different role: 14.0 penalty
 */
function roleCompatibilityPenalty(player: PlayerData, targetRole: LolRole): number {
    const primary = player.natural_position;
    const alternates = player.alternate_positions || [];

    if (primary === targetRole) {
        return 0;
    }

    if (alternates.includes(targetRole)) {
        return 4.0;
    }

    return 14.0;
}

/**
 * Calculate OVR for a player. Returns { ovr, rolePenalty }.
 * ovr = base OVR from the 9 visible stats (same everywhere).
 * rolePenalty = penalty for playing outside natural/alternate roles (shown separately).
 */
export function calcOvr(player: PlayerData, role?: LolRole): { ovr: number; rolePenalty: number } {
    const targetRole = role || player.natural_position;
    const penalty = role ? roleCompatibilityPenalty(player, targetRole) : 0;
    return {
        ovr: baseOvr(player),
        rolePenalty: Math.round(penalty),
    };
}

/**
 * Role badge color mapping
 * Uses the same mapping as roleIcons.ts for consistency
 */
export function positionBadgeVariant(role: LolRole): "accent" | "primary" | "success" | "danger" {
    switch (role) {
        case "TOP":
            return "danger";
        case "JUNGLE":
            return "success";
        case "MID":
            return "primary";
        case "ADC":
            return "accent";
        case "SUPPORT":
            return "neutral";
        default:
            return "primary";
    }
}