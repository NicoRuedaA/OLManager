import type { PlayerData } from "../../store/gameStore";

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
      return a.mechanics ?? a.dribbling ?? 0;
    case "laning":
      return a.laning ?? a.shooting ?? 0;
    case "teamfighting":
      return a.teamfighting ?? a.teamwork ?? 0;
    case "macro":
      return a.macro_play ?? a.vision ?? 0;
    case "consistency":
      return a.consistency ?? a.decisions ?? 0;
    case "shotcalling":
      return a.shotcalling ?? a.leadership ?? 0;
    case "championPool":
      return a.champion_pool ?? a.agility ?? 0;
    case "discipline":
      return a.discipline ?? a.composure ?? 0;
    case "mentalResilience":
      return a.mental_resilience ?? a.stamina ?? 0;
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

/** LoL OVR: pre-computed by olm_core, or calculated client-side as fallback. */
export function calculateLolOvr(player: PlayerData): number {
  if (player.lol_ovr != null && player.lol_ovr > 0) return player.lol_ovr;
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

