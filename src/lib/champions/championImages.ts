import { normalizeChampionKey } from "./championIds";

/**
 * Build a tile URL for the given champion key.
 * Returns a local webp path if key is valid, null otherwise.
 *
 * The key is normalized via normalizeChampionKey before constructing the path,
 * so non-standard forms like "FiddleSticks" → "Fiddlesticks" are handled.
 *
 * @param key — Champion key string, null, or undefined
 * @returns "/champion-tiles/{normalizedKey}.webp" or null
 */
export function resolveChampionTile(
  key: string | null | undefined,
): string | null {
  if (!key) return null;
  const normalized = normalizeChampionKey(key);
  if (!normalized) return null;
  return `/champion-tiles/${normalized}.webp`;
}

/**
 * Build a splash URL for the given champion key.
 * Returns a local webp path if key is valid, null otherwise.
 *
 * @param key — Champion key string, null, or undefined
 * @returns "/champion-splash/{normalizedKey}.webp" or null
 */
export function resolveChampionSplash(
  key: string | null | undefined,
): string | null {
  if (!key) return null;
  const normalized = normalizeChampionKey(key);
  if (!normalized) return null;
  return `/champion-splash/${normalized}.webp`;
}
