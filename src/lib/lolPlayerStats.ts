import type { PlayerData } from "../store/gameStore";

export type LolVisibleStatId =
  | "mechanics"
  | "laning"
  | "teamfighting"
  | "macro"
  | "consistency"
  | "shotcalling"
  | "championPool"
  | "discipline"
  | "mentalResilience";

export const LOL_VISIBLE_STAT_LABEL_KEYS: Record<LolVisibleStatId, string> = {
  mechanics: "playerProfile.lolStats.mechanics",
  laning: "playerProfile.lolStats.laning",
  teamfighting: "playerProfile.lolStats.teamfighting",
  macro: "playerProfile.lolStats.macro",
  consistency: "playerProfile.lolStats.consistency",
  shotcalling: "playerProfile.lolStats.shotcalling",
  championPool: "playerProfile.lolStats.championPool",
  discipline: "playerProfile.lolStats.discipline",
  mentalResilience: "playerProfile.lolStats.mentalResilience",
};

export const LOL_VISIBLE_STAT_GROUPS = [
  {
    labelKey: "playerProfile.lolStatGroups.gameplay",
    statIds: ["mechanics", "laning", "teamfighting"],
  },
  {
    labelKey: "playerProfile.lolStatGroups.gameIq",
    statIds: ["macro", "consistency", "shotcalling"],
  },
  {
    labelKey: "playerProfile.lolStatGroups.competitive",
    statIds: ["championPool", "discipline", "mentalResilience"],
  },
] as const;

function clampOvr(value: number): number {
  return Math.max(1, Math.min(99, Math.round(value)));
}

export function getLolVisibleStatValue(player: PlayerData, statId: LolVisibleStatId): number {
  const a = player.attributes;

  switch (statId) {
    case "mechanics":
      return a.mechanics;
    case "laning":
      return a.laning;
    case "teamfighting":
      return a.teamfighting;
    case "macro":
      return a.macro_play;
    case "consistency":
      return a.consistency;
    case "shotcalling":
      return a.shotcalling;
    case "championPool":
      return a.champion_pool;
    case "discipline":
      return a.discipline;
    case "mentalResilience":
      return a.mental_resilience;
  }
}

/** Shared OVR formula — takes raw stat values so any data source can use it. */
export function calcOvr(
  dribbling: number,
  shooting: number,
  teamwork: number,
  vision: number,
  decisions: number,
  leadership: number,
  agility: number,
  composure: number,
  stamina: number,
): number {
  return clampOvr(
    (dribbling +
      shooting +
      teamwork +
      vision +
      decisions +
      leadership +
      agility +
      composure +
      stamina) / 9,
  );
}

export function calculateLolOvr(player: PlayerData): number {
  return calcOvr(
    getLolVisibleStatValue(player, "mechanics"),
    getLolVisibleStatValue(player, "laning"),
    getLolVisibleStatValue(player, "teamfighting"),
    getLolVisibleStatValue(player, "macro"),
    getLolVisibleStatValue(player, "consistency"),
    getLolVisibleStatValue(player, "shotcalling"),
    getLolVisibleStatValue(player, "championPool"),
    getLolVisibleStatValue(player, "discipline"),
    getLolVisibleStatValue(player, "mentalResilience"),
  );
}
