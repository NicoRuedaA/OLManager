import type { PlayerData } from "../../store/gameStore";
import { calculateLolOvr } from "../../lib/lolPlayerStats";
import { resolvePlayerLolRole } from "../../lib/lolIdentity";

export type SquadSection = "xi" | "bench";
export type DragState = {
  playerId: string;
  from: SquadSection;
  slotIndex: number | null;
};

export type PitchRow = { label: string; y: string; positions: string[] };
export type PitchSlot = {
  index: number;
  position: string;
  player: PlayerData | null;
};
export type PitchSlotRow = PitchRow & { slots: PitchSlot[] };
export type LolRole = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";
export type ActiveLineupSlot = {
  index: number;
  role: LolRole;
  player: PlayerData | null;
};

export const LOL_ACTIVE_ROLES: readonly LolRole[] = [
  "TOP",
  "JUNGLE",
  "MID",
  "ADC",
  "SUPPORT",
] as const;

export const LOL_ROLE_LABELS: Record<LolRole, string> = {
  TOP: "TOP",
  JUNGLE: "JUNGLE",
  MID: "MID",
  ADC: "ADC",
  SUPPORT: "SUPPORT",
};

const POSITION_LABELS: Record<string, string> = {
  TOP: "TOP",
  JUNGLE: "JUNGLE",
  MID: "MID",
  ADC: "ADC",
  SUPPORT: "SUPPORT",
};

const POSITION_CODES: Record<string, string> = {
  TOP: "TOP",
  JUNGLE: "JNG",
  MID: "MID",
  ADC: "ADC",
  SUPPORT: "SUP",
};

export function canonicalPosition(position?: string | null): string {
  const trimmed = (position ?? "").trim();
  if (!trimmed) return trimmed;

  if (LOL_ACTIVE_ROLES.includes(trimmed.toUpperCase() as LolRole)) {
    return trimmed.toUpperCase();
  }

  return trimmed;
}

export function normalisePosition(position?: string | null): string {
  return canonicalPosition(position);
}

export function positionCode(position?: string | null): string {
  const normalized = canonicalPosition(position);
  return (
    POSITION_CODES[normalized] || normalized.substring(0, 3).toUpperCase()
  );
}

export function translatePositionLabel(
  translateFnOrPosition: string | ((key: string, options?: { defaultValue?: string }) => string),
  positionOrTranslateFn?: string | ((key: string, options?: { defaultValue?: string }) => string),
): string {
  let translateFn: (key: string, options?: { defaultValue?: string }) => string;
  let position: string | null | undefined;

  if (typeof translateFnOrPosition === "function") {
    translateFn = translateFnOrPosition;
    position = positionOrTranslateFn as string | null | undefined;
  } else if (typeof positionOrTranslateFn === "function") {
    translateFn = positionOrTranslateFn;
    position = translateFnOrPosition;
  } else {
    return translateFnOrPosition ?? "";
  }

  const canonical = canonicalPosition(position);

  return translateFn(`common.positions.${canonical}`, {
    defaultValue: POSITION_LABELS[canonical] || canonical,
  });
}

export function translatePositionAbbreviation(
  translateFnOrPosition: string | ((key: string, options?: { defaultValue?: string }) => string),
  positionOrTranslateFn?: string | ((key: string, options?: { defaultValue?: string }) => string),
): string {
  let translateFn: (key: string, options?: { defaultValue?: string }) => string;
  let position: string | null | undefined;

  if (typeof translateFnOrPosition === "function") {
    translateFn = translateFnOrPosition;
    position = positionOrTranslateFn as string | null | undefined;
  } else if (typeof positionOrTranslateFn === "function") {
    translateFn = positionOrTranslateFn;
    position = translateFnOrPosition;
  } else {
    return translateFnOrPosition ?? "";
  }

  const normalized = canonicalPosition(position);

  return translateFn(`common.posAbbr.${normalized}`, {
    defaultValue: positionCode(position),
  });
}

export function getLolRoleForPlayer(player: PlayerData): LolRole {
  return resolvePlayerLolRole(player);
}

export function getPreferredPositions(player: PlayerData): string[] {
  return [
    ...new Set(
      [
        player.natural_position || player.position,
        ...(player.alternate_positions || []),
      ]
        .filter(Boolean)
        .map(canonicalPosition),
    ),
  ];
}

/**
 * Returns 5 fixed LoL lane rows for display (replaces football pitch rows).
 */
export function buildLaneRows(): PitchRow[] {
  return [
    { label: "TOP", y: "16%", positions: ["TOP"] },
    { label: "JNG", y: "34%", positions: ["JUNGLE"] },
    { label: "MID", y: "52%", positions: ["MID"] },
    { label: "ADC", y: "70%", positions: ["ADC"] },
    { label: "SUP", y: "88%", positions: ["SUPPORT"] },
  ];
}

export function buildActiveLineupIds(
  available: PlayerData[],
  savedIds: string[],
): string[] {
  const byId = new Map(available.map((player) => [player.id, player]));
  const used = new Set<string>();
  const activeIds: string[] = [];

  for (const role of LOL_ACTIVE_ROLES) {
    const savedRolePlayer = savedIds
      .map((id) => byId.get(id))
      .find(
        (player): player is PlayerData =>
          player !== undefined && !used.has(player.id) && getLolRoleForPlayer(player) === role,
      );

    if (savedRolePlayer) {
      activeIds.push(savedRolePlayer.id);
      used.add(savedRolePlayer.id);
      continue;
    }

    const roleCandidates = available
      .filter((player) => !used.has(player.id) && getLolRoleForPlayer(player) === role)
      .sort((a, b) => calculateLolOvr(b) - calculateLolOvr(a));

    const bestRolePlayer = roleCandidates[0];
    if (bestRolePlayer) {
      activeIds.push(bestRolePlayer.id);
      used.add(bestRolePlayer.id);
    }
  }

  return activeIds.slice(0, LOL_ACTIVE_ROLES.length);
}

export function buildActiveLineupSlots(
  roles: readonly LolRole[],
  activeIds: string[],
  playersById: Map<string, PlayerData>,
): ActiveLineupSlot[] {
  return roles.map((role, index) => ({
    index,
    role,
    player: playersById.get(activeIds[index]) ?? null,
  }));
}

export function buildActivePositionMap(
  slotsOrRows: PitchSlotRow[] | ActiveLineupSlot[],
): Map<string, string> {
  const map = new Map<string, string>();

  slotsOrRows.forEach((entry) => {
    if ("slots" in entry) {
      entry.slots.forEach((slot) => {
        if (slot.player) {
          map.set(slot.player.id, canonicalPosition(slot.position));
        }
      });
      return;
    }

    if (entry.player) {
      map.set(entry.player.id, entry.role);
    }
  });
  return map;
}

export function isPlayerOutOfPosition(
  player: PlayerData,
  currentPos: string,
): boolean {
  const canonicalCurrentPos = canonicalPosition(currentPos);
  const normalizedCurrentPos = normalisePosition(currentPos);
  return !getPreferredPositions(player).some(
    (position) =>
      position === canonicalCurrentPos ||
      normalisePosition(position) === normalizedCurrentPos,
  );
}

export function applyLineupDrop(
  currentXiIds: string[],
  dragState: DragState,
  slotIndex: number,
): string[] {
  const nextXiIds = [...currentXiIds];

  if (slotIndex < 0 || slotIndex >= nextXiIds.length) {
    return nextXiIds;
  }

  if (dragState.from === "xi") {
    const fromIndex =
      dragState.slotIndex ?? nextXiIds.indexOf(dragState.playerId);
    if (fromIndex < 0 || fromIndex === slotIndex) {
      return nextXiIds;
    }
    [nextXiIds[fromIndex], nextXiIds[slotIndex]] = [
      nextXiIds[slotIndex],
      nextXiIds[fromIndex],
    ];
    return nextXiIds;
  }

  const existingIndex = nextXiIds.indexOf(dragState.playerId);
  if (existingIndex === slotIndex) {
    return nextXiIds;
  }
  if (existingIndex >= 0) {
    nextXiIds.splice(existingIndex, 1);
    if (existingIndex < slotIndex) {
      slotIndex -= 1;
    }
    nextXiIds.splice(slotIndex, 0, dragState.playerId);
    return nextXiIds.slice(0, currentXiIds.length);
  }
  if (slotIndex >= nextXiIds.length) {
    nextXiIds.push(dragState.playerId);
  } else {
    nextXiIds[slotIndex] = dragState.playerId;
  }
  return nextXiIds.slice(0, currentXiIds.length);
}

export function applyLineupSwap(
  currentXiIds: string[],
  swapSource: { id: string; from: SquadSection },
  playerId: string,
  from: SquadSection,
): string[] | null {
  if (swapSource.from === "xi" && from === "bench") {
    return currentXiIds.map((id) => (id === swapSource.id ? playerId : id));
  }

  if (swapSource.from === "bench" && from === "xi") {
    return currentXiIds.map((id) => (id === playerId ? swapSource.id : id));
  }

  if (swapSource.from === "xi" && from === "xi") {
    const firstIndex = currentXiIds.indexOf(swapSource.id);
    const secondIndex = currentXiIds.indexOf(playerId);
    if (firstIndex < 0 || secondIndex < 0 || firstIndex === secondIndex) {
      return currentXiIds;
    }
    const nextXiIds = [...currentXiIds];
    nextXiIds[firstIndex] = playerId;
    nextXiIds[secondIndex] = swapSource.id;
    return nextXiIds;
  }

  return null;
}
