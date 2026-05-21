import lesPlayersData from "../../data/erls/players/les_players.json";
import lflPlayersData from "../../data/erls/players/lfl_players.json";
import primeLeaguePlayersData from "../../data/erls/players/prm_players.json";

const FALLBACK_PLAYER_PHOTO = "/player-photos/107455908655055017.webp";

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildPhotoMapFromJson(data: { players: { match_name: string; profile_image_url?: string | null }[] }): Map<string, string> {
  const map = new Map<string, string>();
  for (const player of data.players) {
    const key = normalizeKey(player.match_name);
    if (!key) continue;
    if (!player.profile_image_url) continue;
    map.set(key, player.profile_image_url);
  }
  return map;
}

const EXAMPLE_PHOTO_MAP = new Map<string, string>([
  ...buildPhotoMapFromJson(lesPlayersData).entries(),
  ...buildPhotoMapFromJson(lflPlayersData).entries(),
  ...buildPhotoMapFromJson(primeLeaguePlayersData).entries(),
]);

function normalizeProfileImageUrl(url?: string | null): string | null {
  const value = String(url ?? "").trim();
  if (!value) return null;
  return value;
}

export function resolvePlayerPhoto(playerId: string, matchName?: string, profileImageUrl?: string | null): string | null {
  const explicit = normalizeProfileImageUrl(profileImageUrl);
  if (explicit) return explicit;

  const legacy = playerId.match(/^lec-player-(.+)$/);
  if (legacy) return `/player-photos/${legacy[1]}.webp`;

  const key = normalizeKey(matchName ?? "");
  if (!key) return FALLBACK_PLAYER_PHOTO;
  return EXAMPLE_PHOTO_MAP.get(key) ?? FALLBACK_PLAYER_PHOTO;
}

export function resolveStaffPhoto(profileImageUrl?: string | null): string | null {
  return normalizeProfileImageUrl(profileImageUrl) ?? FALLBACK_PLAYER_PHOTO;
}
