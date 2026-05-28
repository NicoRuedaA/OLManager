import lesExampleRaw from "../../data/erls/les.txt?raw";
import lflExampleRaw from "../../data/erls/lfl.txt?raw";
import primeLeagueExampleRaw from "../../data/erls/Prime League.txt?raw";

const FALLBACK_PLAYER_PHOTO = "/player-photos/107455908655055017.webp";

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseExamplePhotoMap(content: string): Map<string, string> {
  const map = new Map<string, string>();
  let currentIgn = "";

  const rolePrefixes = ["Toplaner:", "Jungle:", "Midlaner:", "ADC:", "Support:"];

  content.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    const rolePrefix = rolePrefixes.find((prefix) => line.startsWith(prefix));
    if (rolePrefix) {
      currentIgn = line.slice(rolePrefix.length).trim();
      return;
    }

    if (line.startsWith("Image:")) {
      const rawUrl = line.slice("Image:".length).trim();
      if (!currentIgn) return;
      if (!rawUrl || rawUrl.includes("??") || !rawUrl.startsWith("http")) return;
      map.set(normalizeKey(currentIgn), rawUrl);
    }
  });

  return map;
}

const EXAMPLE_PHOTO_MAP = new Map<string, string>([
  ...parseExamplePhotoMap(lesExampleRaw).entries(),
  ...parseExamplePhotoMap(lflExampleRaw).entries(),
  ...parseExamplePhotoMap(primeLeagueExampleRaw).entries(),
]);

function normalizeProfileImageUrl(url?: string | null): string | null {
  const value = String(url ?? "").trim();
  if (!value) return null;
  if (value.startsWith("/images/")) return `/data/lec${value}`;
  return value;
}

export function resolvePlayerPhoto(playerId: string, matchName?: string, profileImageUrl?: string | null): string | null {
  // 1. Explicit profile_image_url from data (highest priority)
  const explicit = normalizeProfileImageUrl(profileImageUrl);
  if (explicit) return explicit;

  // 2. Legacy lec-player-XXXX pattern
  const legacy = playerId.match(/^lec-player-(.+)$/);
  if (legacy) return `/player-photos/${legacy[1]}.webp`;

  // 3. Try playerId as direct photo filename (player-XXXX.webp)
  const byId = `/player-photos/${playerId}.webp`;
  if (playerId.startsWith("player-") || playerId.startsWith("team-")) return byId;

  // 4. Match name lookup in example data
  const key = normalizeKey(matchName ?? "");
  if (key && EXAMPLE_PHOTO_MAP.has(key)) return EXAMPLE_PHOTO_MAP.get(key)!;

  // 5. Fallback
  return FALLBACK_PLAYER_PHOTO;
}

export function resolveStaffPhoto(profileImageUrl?: string | null): string | null {
  return normalizeProfileImageUrl(profileImageUrl) ?? FALLBACK_PLAYER_PHOTO;
}
