import championsSeed from "../../data/draft/champions.json";
import type { PlayerData, TeamData } from "../store/gameStore";

export type LolRoleTag = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";

const ACTIVE_LINEUP_ROLES: readonly LolRoleTag[] = [
  "TOP",
  "JUNGLE",
  "MID",
  "ADC",
  "SUPPORT",
] as const;

/**
 * Resolve the LoL role for a player directly from their data.
 * Now that the backend uses LolRole directly, this is straightforward.
 */
export function resolvePlayerLolRole(player: PlayerData): LolRoleTag {
  // Use position first (set by Rust LolRole custom deserializer from data files)
  const role = player.position;
  if (role === "TOP" || role === "JUNGLE" || role === "MID" || role === "ADC" || role === "SUPPORT") {
    return role;
  }
  // Fall back to natural_position (may be "UNKNOWN" if not set in data)
  const np = player.natural_position;
  if (np === "TOP" || np === "JUNGLE" || np === "MID" || np === "ADC" || np === "SUPPORT") {
    return np;
  }
  // Last resort: try legacy football position mapping from either field
  const legacyRole = String(role || np || "").toLowerCase();
  if (legacyRole === "defender" || legacyRole === "centre-back" || legacyRole === "center-back" || legacyRole === "full-back") {
    return "TOP";
  }
  if (legacyRole === "midfielder") {
    return "MID";
  }
  if (legacyRole === "forward" || legacyRole === "striker" || legacyRole === "winger") {
    return "ADC";
  }
  if (legacyRole === "goalkeeper") {
    return "SUPPORT";
  }
  // Absolute fallback — should never reach here with LEC data
  return "TOP";
}

/**
 * Resolve the player's current roster role.
 *
 * A player assigned to the active lineup adopts the role of that lineup slot.
 * Bench players keep their natural player role. This matters for champion-pool
 * training after lineup changes: a support moved into TOP must train TOP picks.
 */
export function resolvePlayerCurrentLolRole(
  player: PlayerData,
  team?: Pick<TeamData, "active_lineup_ids" | "starting_xi_ids"> | null,
): LolRoleTag {
  const lineupIds = team?.active_lineup_ids ?? team?.starting_xi_ids ?? [];
  const lineupIndex = lineupIds.indexOf(player.id);

  if (lineupIndex >= 0) {
    return ACTIVE_LINEUP_ROLES[lineupIndex] ?? resolvePlayerLolRole(player);
  }

  return resolvePlayerLolRole(player);
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

const CHAMPION_ROLE_MAP =
  ((championsSeed as { data?: { roles?: Record<string, string[]> } }).data?.roles ?? {}) as Record<string, string[]>;

const CHAMPION_POOL_BY_ROLE: Record<LolRoleTag, string[]> = {
  TOP: [],
  JUNGLE: [],
  MID: [],
  ADC: [],
  SUPPORT: [],
};

Object.entries(CHAMPION_ROLE_MAP).forEach(([champion, roles]) => {
  roles.forEach((role) => {
    const normalized = normalizeKey(role);
    if (normalized === "top") CHAMPION_POOL_BY_ROLE.TOP.push(champion);
    if (normalized === "jungle") CHAMPION_POOL_BY_ROLE.JUNGLE.push(champion);
    if (normalized === "mid") CHAMPION_POOL_BY_ROLE.MID.push(champion);
    if (normalized === "adc" || normalized === "bot" || normalized === "bottom") CHAMPION_POOL_BY_ROLE.ADC.push(champion);
    if (normalized === "support" || normalized === "sup") CHAMPION_POOL_BY_ROLE.SUPPORT.push(champion);
  });
});

function stableHash(value: string): number {
  return value
    .split("")
    .reduce((acc, ch) => (acc * 33 + ch.charCodeAt(0)) >>> 0, 5381);
}

export function fallbackChampionForRole(playerId: string, role: LolRoleTag): string | null {
  const pool = CHAMPION_POOL_BY_ROLE[role] ?? [];
  if (pool.length === 0) return null;
  const idx = stableHash(`${playerId}:${role}`) % pool.length;
  return pool[idx] ?? null;
}
