import { useState, type ImgHTMLAttributes } from "react";

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

interface PlayerAvatarProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> {
  playerId: string;
  matchName?: string;
  profileImageUrl?: string | null;
}

export function PlayerAvatar({ playerId, matchName, profileImageUrl, className = "", ...imgProps }: PlayerAvatarProps) {
  const [src, setSrc] = useState(() => resolvePlayerPhoto(playerId, matchName, profileImageUrl));

  return (
    <img
      src={src}
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
