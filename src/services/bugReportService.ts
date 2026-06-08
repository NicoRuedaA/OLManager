import { getApiClientSync } from "../api/client";

/**
 * Export a bug report ZIP to the user's Desktop.
 *
 * @param contextJson - JSON string with user description + game context
 * @param saveJson - JSON string with the full serialized save/game state
 * @returns The path to the created .zip file
 */
export async function exportBugReport(
  contextJson: string,
  saveJson: string,
): Promise<string> {
  return getApiClientSync().serverCommands.bugReport({ contextJson, saveJson });
}
