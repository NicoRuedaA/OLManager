import { getApiClientSync } from "../api/client";
import type { GameStateData } from "../store/gameStore";

export async function hireStaff(staffId: string): Promise<GameStateData> {
  return getApiClientSync().staff.hire({ staffId });
}

export async function releaseStaff(staffId: string): Promise<GameStateData> {
  return getApiClientSync().staff.release({ staffId });
}
