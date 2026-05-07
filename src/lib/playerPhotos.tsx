import { useState, type ImgHTMLAttributes } from "react";
import PLAYER_PHOTO_MAPPING from "./playerPhotoMapping";
import STAFF_PHOTO_MAPPING from "./staffPhotoMapping";

const FALLBACK_PLAYER_PHOTO = "/player-photos/107455908655055017.png";

function normalizeKey(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

export function resolvePlayerPhoto(
  _playerId: string,
  matchName?: string,
  profileImageUrl?: string | null,
): string | null {
  if (profileImageUrl) return profileImageUrl;
  if (matchName) {
    const key = normalizeKey(matchName);
    if (PLAYER_PHOTO_MAPPING[key]) return PLAYER_PHOTO_MAPPING[key];
  }
  return null;
}

export function resolveStaffPhoto(
  matchName?: string,
  profileImageUrl?: string | null,
): string | null {
  if (profileImageUrl) return profileImageUrl;
  if (matchName) {
    const key = normalizeKey(matchName);
    if (STAFF_PHOTO_MAPPING[key]) return STAFF_PHOTO_MAPPING[key];
  }
  return null;
}

interface PlayerAvatarProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> {
  playerId: string;
  matchName?: string;
  profileImageUrl?: string | null;
}

export function PlayerAvatar({ playerId, matchName, profileImageUrl, className = "", ...imgProps }: PlayerAvatarProps) {
  const [src, setSrc] = useState(() => resolvePlayerPhoto(playerId, matchName, profileImageUrl));

  return (
    <img
      src={src ?? FALLBACK_PLAYER_PHOTO}
      alt={matchName ?? "Player"}
      className={`w-8 h-8 rounded-full object-cover bg-gray-200 dark:bg-navy-600 ${className}`}
      onError={(e) => {
        e.currentTarget.onerror = null;
        setSrc(FALLBACK_PLAYER_PHOTO);
      }}
      loading="lazy"
      {...imgProps}
    />
  );
}
