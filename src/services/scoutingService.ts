import { getApiClientSync } from "../api/client";

import type { GameStateData } from "../store/gameStore";

export async function sendScout(
  scoutId: string,
  playerId: string,
): Promise<GameStateData> {
  return getApiClientSync().scouting.sendScout({ scoutId, playerId });
}
