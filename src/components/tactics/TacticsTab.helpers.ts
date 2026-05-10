import { calcAge, calcOvr } from "../../lib/helpers";
import type { PlayerData } from "../../store/gameStore";
import {
  buildActiveLineupIds,
  buildLaneRows,
  getPreferredPositions,
  isPlayerOutOfPosition,
  normalisePosition,
  positionCode,
  type SquadSection,
} from "../squad/SquadTab.helpers";

export const DRAFT_STRATEGIES = [
  "Balanced",
  "Aggressive",
  "Passive",
  "Scaling",
  "CounterPick",
  "PriorityBans",
];

export const DRAFT_STRATEGY_DESCRIPTION_FALLBACKS: Record<string, string> = {
  Balanced:
    "Keeps your team measured in draft and map play, with a steady approach and fewer extremes.",
  Aggressive:
    "Pushes for early advantages and proactive map pressure, forcing the opponent to react.",
  Passive:
    "Prioritizes safe scaling and vision control, minimizing risks in the early game.",
  Scaling:
    "Invests in late-game team compositions, trading early pressure for power spikes.",
  CounterPick:
    "Reserves draft slots for adaptive counter picks based on opponent's revealed composition.",
  PriorityBans:
    "Focuses ban phase on denying key opponent champions and meta threats.",
};

export type SortDirection = "asc" | "desc";
export type SortKey = "pos" | "name" | "age" | "condition" | "morale" | "ovr";

const POSITION_ORDER: Record<string, number> = {
  Goalkeeper: 1,
  Defender: 2,
  Midfielder: 3,
  Forward: 4,
};

interface TacticsPlayerSortContext {
  currentDate: string;
  section: SquadSection;
  sortDir: SortDirection;
  sortKey: SortKey;
  xiActivePosition: Map<string, string>;
}

interface TacticsPlayerFilterContext {
  playerSearch: string;
  positionFilter: string;
  section: SquadSection;
  xiActivePosition: Map<string, string>;
}

interface ResolveStartingXiIdsOptions {
  availablePlayers: PlayerData[];
  pendingStartingXiIds: string[] | null;
  playersById: Map<string, PlayerData>;
  savedStartingXiIds: string[];
}

export function buildTacticsRoster(
  players: PlayerData[],
  teamId: string,
): PlayerData[] {
  return players
    .filter((player) => player.team_id === teamId)
    .sort((leftPlayer, rightPlayer) => {
      return (
        (POSITION_ORDER[normalisePosition(leftPlayer.position)] ?? 99) -
          (POSITION_ORDER[normalisePosition(rightPlayer.position)] ?? 99) ||
        calcOvr(rightPlayer, rightPlayer.natural_position || rightPlayer.position).ovr -
          calcOvr(leftPlayer, leftPlayer.natural_position || leftPlayer.position).ovr
      );
    });
}

export function resolveStartingXiIds({
  availablePlayers,
  pendingStartingXiIds,
  playersById,
  savedStartingXiIds,
}: ResolveStartingXiIdsOptions): string[] {
  const baseIds = buildActiveLineupIds(
    availablePlayers,
    savedStartingXiIds,
  );
  const slotPositions = buildLaneRows().flatMap((row) => row.positions);

  if (!pendingStartingXiIds || pendingStartingXiIds.length === 0) {
    return baseIds;
  }

  const validPendingIds = pendingStartingXiIds.filter((id) => playersById.has(id));
  const usedPlayerIds = new Set(validPendingIds);
  const fillPlayerIds: string[] = [];

  while (validPendingIds.length + fillPlayerIds.length < 5) {
    const slotPosition = slotPositions[validPendingIds.length + fillPlayerIds.length];
    const bestPlayer = availablePlayers
      .filter((player) => !usedPlayerIds.has(player.id))
      .sort(
        (leftPlayer, rightPlayer) =>
          calcOvr(rightPlayer, slotPosition as PlayerData["position"]).ovr - calcOvr(leftPlayer, slotPosition as PlayerData["position"]).ovr,
      )[0];

    if (!bestPlayer) break;
    fillPlayerIds.push(bestPlayer.id);
    usedPlayerIds.add(bestPlayer.id);
  }

  return [...validPendingIds, ...fillPlayerIds].slice(0, 5);
}

export function getSectionPlayerPosition(
  player: PlayerData,
  section: SquadSection,
  xiActivePosition: Map<string, string>,
): string {
  if (section === "xi") {
    return xiActivePosition.get(player.id) ?? player.position;
  }

  return player.natural_position || player.position;
}

export function sortTacticsPlayers(
  players: PlayerData[],
  context: TacticsPlayerSortContext,
): PlayerData[] {
  const { currentDate, section, sortDir, sortKey, xiActivePosition } = context;
  const sortedPlayers = [...players].sort((leftPlayer, rightPlayer) => {
    const leftPosition = getSectionPlayerPosition(leftPlayer, section, xiActivePosition);
    const rightPosition = getSectionPlayerPosition(rightPlayer, section, xiActivePosition);

    switch (sortKey) {
      case "pos":
        return (
          (POSITION_ORDER[normalisePosition(leftPosition)] ?? 99) -
            (POSITION_ORDER[normalisePosition(rightPosition)] ?? 99) ||
          calcOvr(rightPlayer, rightPosition as PlayerData["position"]).ovr - calcOvr(leftPlayer, leftPosition as PlayerData["position"]).ovr
        );
      case "name":
        return leftPlayer.full_name.localeCompare(rightPlayer.full_name);
      case "age":
        return calcAge(leftPlayer.date_of_birth, currentDate) - calcAge(rightPlayer.date_of_birth, currentDate);
      case "condition":
        return leftPlayer.condition - rightPlayer.condition;
      case "morale":
        return leftPlayer.morale - rightPlayer.morale;
      case "ovr":
        return calcOvr(leftPlayer, leftPosition as PlayerData["position"]).ovr - calcOvr(rightPlayer, rightPosition as PlayerData["position"]).ovr;
      default:
        return 0;
    }
  });

  if (sortDir === "desc") {
    return sortedPlayers.reverse();
  }

  return sortedPlayers;
}

export function matchesTacticsPlayerFilters(
  player: PlayerData,
  context: TacticsPlayerFilterContext,
): boolean {
  const { playerSearch, positionFilter, section, xiActivePosition } = context;
  const currentPosition = normalisePosition(
    getSectionPlayerPosition(player, section, xiActivePosition),
  );
  const preferredPositions = getPreferredPositions(player);
  const normalizedSearch = playerSearch.trim().toLowerCase();

  if (normalizedSearch) {
    const searchableText = [
      player.full_name,
      player.match_name,
      currentPosition,
      ...preferredPositions,
      ...preferredPositions.map(positionCode),
    ]
      .join(" ")
      .toLowerCase();

    if (!searchableText.includes(normalizedSearch)) {
      return false;
    }
  }

  if (
    positionFilter !== "All" &&
    currentPosition !== positionFilter &&
    !preferredPositions.includes(positionFilter)
  ) {
    return false;
  }

  return true;
}

export function filterAndSortTacticsPlayers(
  players: PlayerData[],
  filterContext: TacticsPlayerFilterContext,
  sortContext: TacticsPlayerSortContext,
): PlayerData[] {
  return sortTacticsPlayers(
    players.filter((player) => matchesTacticsPlayerFilters(player, filterContext)),
    sortContext,
  );
}

export function countOutOfPositionPlayers(
  startingPlayers: PlayerData[],
  xiActivePosition: Map<string, string>,
): number {
  return startingPlayers.filter((player) => {
    const currentPosition = xiActivePosition.get(player.id) ?? player.position;

    return isPlayerOutOfPosition(player, currentPosition);
  }).length;
}

export function getSelectedAndComparePlayers(
  comparePlayerId: string | null,
  playersById: Map<string, PlayerData>,
  selectedPlayerId: string | null,
): {
  comparePlayer: PlayerData | null;
  selectedPlayer: PlayerData | null;
} {
  const selectedPlayer = selectedPlayerId
    ? playersById.get(selectedPlayerId) ?? null
    : null;

  const comparePlayer =
    selectedPlayerId && comparePlayerId && selectedPlayerId !== comparePlayerId
      ? playersById.get(comparePlayerId) ?? null
      : null;

  return {
    comparePlayer,
    selectedPlayer,
  };
}

export function getOverallRatingClassName(overallRating: number): string {
  if (overallRating >= 75) {
    return "text-success-500 dark:text-success-400";
  }

  if (overallRating >= 55) {
    return "text-accent-600 dark:text-accent-400";
  }

  return "text-gray-500 dark:text-gray-400";
}
