import { getApiClientSync } from "../api/client";
import type { GameStateData } from "../store/gameStore";

export async function startPotentialResearch(
  playerId: string,
): Promise<GameStateData> {
  return getApiClientSync().players.startPotentialResearch({ playerId });
}

export async function setPlayerChampionTrainingTarget(
  playerId: string,
  priorityIndex: number,
  championId: string | null,
): Promise<GameStateData> {
  return getApiClientSync().players.setChampionTrainingTarget({
    playerId,
    priorityIndex,
    championId: championId ?? "",
  });
}

export async function delegateChampionTraining(): Promise<GameStateData> {
  return getApiClientSync().players.delegateChampionTraining();
}
