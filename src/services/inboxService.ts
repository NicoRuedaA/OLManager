import { getApiClientSync } from "../api/client";
import type { GameStateData } from "../store/gameStore";

export interface ResolveMessageActionResult {
  game: GameStateData;
  effect: string | null;
  effect_i18n_key?: string | null;
  effect_i18n_params?: Record<string, string | number> | null;
}

export async function markMessageRead(
  messageId: string,
): Promise<GameStateData> {
  return getApiClientSync().inbox.markRead({ messageId });
}

export async function resolveMessageAction(
  messageId: string,
  actionId: string,
  optionId?: string | null,
): Promise<ResolveMessageActionResult> {
  return getApiClientSync().inbox.resolveAction({
    messageId,
    actionId,
    optionId: optionId ?? "",
  });
}

export async function markAllMessagesRead(): Promise<GameStateData> {
  return getApiClientSync().inbox.markAllRead();
}

export async function clearOldMessages(): Promise<GameStateData> {
  return getApiClientSync().inbox.clearOld();
}

export async function deleteMessage(
  messageId: string,
): Promise<GameStateData> {
  return getApiClientSync().inbox.delete({ messageId });
}

export async function deleteMessages(
  messageIds: string[],
): Promise<GameStateData> {
  return getApiClientSync().inbox.deleteMany({ messageIds });
}
