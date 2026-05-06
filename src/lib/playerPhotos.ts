const FALLBACK_PLAYER_PHOTO = "/player-photos/107455908655055017.png";

export function resolvePlayerPhoto(
  _playerId: string,
  _matchName?: string,
  profileImageUrl?: string | null,
): string | null {
  return profileImageUrl ?? FALLBACK_PLAYER_PHOTO;
}

export function resolveStaffPhoto(profileImageUrl?: string | null): string | null {
  return profileImageUrl ?? FALLBACK_PLAYER_PHOTO;
}
