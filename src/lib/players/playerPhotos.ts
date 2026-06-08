import lesPlayersData from "../../../data/players/les_players.json";
import lflPlayersData from "../../../data/players/lfl_players.json";
import primeLeaguePlayersData from "../../../data/players/prm_players.json";
import { assetUrl } from "../assetUrl";

const FALLBACK_PLAYER_PHOTO = "/default/defaultplayer.webp";
const FALLBACK_STAFF_PHOTO = "/manager-icons/0.webp";

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildPhotoMapFromJson(data: {
  players: { match_name: string; profile_image_url?: string | null }[];
}): Map<string, string> {
  const map = new Map<string, string>();
  for (const player of data.players) {
    const key = normalizeKey(player.match_name);
    if (!key || !player.profile_image_url) continue;
    map.set(key, player.profile_image_url);
  }
  return map;
}

const IMPORTED_PHOTO_MAP = new Map<string, string>([
  ...buildPhotoMapFromJson(lesPlayersData).entries(),
  ...buildPhotoMapFromJson(lflPlayersData).entries(),
  ...buildPhotoMapFromJson(primeLeaguePlayersData).entries(),
]);

function normalizeProfileImageUrl(url?: string | null): string | null {
  const value = String(url ?? "").trim();
  return value || null;
}

function resolvePlayerPhotoRaw(
  playerId: string,
  matchName?: string,
  profileImageUrl?: string | null,
): string {
  const explicit = normalizeProfileImageUrl(profileImageUrl);
  if (explicit) return explicit;

  const legacy = playerId.match(/^lec-player-(.+)$/);
  if (legacy) return `/player-photos/${legacy[1]}.webp`;

  const key = normalizeKey(matchName ?? "");
  if (key && IMPORTED_PHOTO_MAP.has(key)) return IMPORTED_PHOTO_MAP.get(key)!;

  if (playerId.startsWith("player-") || playerId.startsWith("team-")) {
    return `/player-photos/${playerId}.webp`;
  }

  return FALLBACK_PLAYER_PHOTO;
}

export function resolvePlayerPhoto(
  playerId: string,
  matchName?: string,
  profileImageUrl?: string | null,
): string | null {
  return assetUrl(resolvePlayerPhotoRaw(playerId, matchName, profileImageUrl));
}

export function resolveStaffPhoto(profileImageUrl?: string | null): string | null {
  return assetUrl(normalizeProfileImageUrl(profileImageUrl) ?? FALLBACK_STAFF_PHOTO);
}
