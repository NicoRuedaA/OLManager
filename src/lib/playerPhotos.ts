const FALLBACK_PLAYER_PHOTO = "/default/defaultplayer.webp";
const FALLBACK_STAFF_PHOTO = "/manager-icons/0.webp";

export function resolvePlayerPhoto(_playerId: string, _matchName?: string, profileImageUrl?: string | null): string | null {
  const value = String(profileImageUrl ?? "").trim();
  if (value) return value;
  return FALLBACK_PLAYER_PHOTO;
}

export function resolveStaffPhoto(profileImageUrl?: string | null): string | null {
  const value = String(profileImageUrl ?? "").trim();
  if (value) return value;
  return FALLBACK_STAFF_PHOTO;
}
