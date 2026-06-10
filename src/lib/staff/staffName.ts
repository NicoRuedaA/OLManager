import type { StaffData } from "@/store/types";

/**
 * Display name for a staff member. Prefers the esports handle (`nickname`,
 * e.g. "Zetz", "ZalFIRE") and falls back to the real name when no nickname is
 * present — mirroring how players are shown by their in-game name.
 */
export function staffDisplayName(
  staff: Pick<StaffData, "nickname" | "first_name" | "last_name">,
): string {
  const nick = staff.nickname?.trim();
  if (nick) return nick;
  return `${staff.first_name ?? ""} ${staff.last_name ?? ""}`.trim();
}
