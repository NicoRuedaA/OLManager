/**
 * Champion key normalization map.
 *
 * DDragon champion.json uses canonical keys like "Fiddlesticks", "MonkeyKing",
 * but various sources in the codebase use non-standard forms like "FiddleSticks",
 * "Wukong", etc. This map normalizes those forms to their canonical DDragon key.
 *
 * Keys are stored lowercase (normalized via removeNonAlpha) for lookup.
 */
const NORMALIZED_KEYS: Record<string, string> = {
  aurelionsol: "AurelionSol",
  belveth: "Belveth",
  chogath: "Chogath",
  drmundo: "DrMundo",
  fiddlestick: "Fiddlesticks",
  fiddlesticks: "Fiddlesticks",
  jarvaniv: "JarvanIV",
  kaisa: "Kaisa",
  khazix: "Khazix",
  kogmaw: "KogMaw",
  ksante: "KSante",
  leblanc: "Leblanc",
  leesin: "LeeSin",
  monkeyking: "MonkeyKing",
  nunuandwillump: "Nunu",
  reksai: "RekSai",
  tahmkench: "TahmKench",
  twistedfate: "TwistedFate",
  velkoz: "Velkoz",
  wukong: "MonkeyKing",
  yunara: "Yunara",
};

/**
 * Remove non-alphanumeric characters and lowercase for lookup normalization.
 */
function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Normalize a champion key to its canonical DDragon form.
 *
 * - If the key matches an entry in NORMALIZED_KEYS, returns the canonical form.
 * - Otherwise, capitalizes the first letter and returns the key as-is.
 *
 * @param key — Champion key string (e.g., "FiddleSticks", "Wukong", "Aatrox")
 * @returns Canonical champion key (e.g., "Fiddlesticks", "MonkeyKing", "Aatrox")
 * @throws TypeError if key is null or undefined
 */
export function normalizeChampionKey(key: string): string {
  if (key === null || key === undefined) {
    throw new TypeError("normalizeChampionKey: key must be a string");
  }
  if (key === "") return "";

  const lookup = normalizeKey(key);
  const override = NORMALIZED_KEYS[lookup];
  if (override) return override;

  // Passthrough: capitalize first letter if it isn't already
  return key.charAt(0).toUpperCase() + key.slice(1);
}
