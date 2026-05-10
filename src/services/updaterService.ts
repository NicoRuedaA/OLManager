import { check, Update, DownloadEvent } from "@tauri-apps/plugin-updater";

export type { Update, DownloadEvent };

export interface UpdateInfo {
  version: string;
  notes: string;
  date: string | null;
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const update = await check();
  if (!update) return null;
  return {
    version: update.version,
    notes: update.body || "",
    date: update.date || null,
  };
}

export async function downloadAndInstallUpdate(
  onEvent?: (event: DownloadEvent) => void,
): Promise<void> {
  const update = await check();
  if (!update) throw new Error("No update available");
  await update.downloadAndInstall(onEvent);
}
