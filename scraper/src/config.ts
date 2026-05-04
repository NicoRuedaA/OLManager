/** Configuration for the Leaguepedia scraper */

export const API_URL = "https://lol.fandom.com/api.php";
export const USER_AGENT = "OLManager-Scraper/0.1 (https://github.com/NicoRuedaA/OLManager; contact via GitHub issues)";

/** Rate limiting config */
export const RATE_LIMIT = {
  /** Delay between standard API calls (ms) */
  apiDelay: 1500,
  /** Delay between image downloads (ms) */
  imageDelay: 300,
  /** Max concurrent image downloads */
  maxConcurrentImages: 5,
  /** Max retries for failed requests */
  maxRetries: 3,
  /** Backoff multiplier for retries */
  backoffMultiplier: 2,
};

/** Leagues to scrape (category → league metadata) */
export const LEAGUES: Record<string, { id: string; name: string; region: string; tier: "primary" | "secondary" | "academy" }> = {
  LEC:   { id: "lec",   name: "LoL EMEA Championship", region: "EMEA",   tier: "primary" },
  LCK:   { id: "lck",   name: "LoL Champions Korea",    region: "Korea",  tier: "primary" },
  LPL:   { id: "lpl",   name: "LoL Pro League",         region: "China",  tier: "primary" },
  LCS:   { id: "lcs",   name: "LoL Championship Series", region: "NA",    tier: "primary" },
  PCS:   { id: "pcs",   name: "Pacific Championship",    region: "APAC",   tier: "primary" },
  VCS:   { id: "vcs",   name: "Vietnam Championship",    region: "VN",     tier: "primary" },
  LLA:   { id: "lla",   name: "Liga Latinoamérica",      region: "LATAM",  tier: "primary" },
  CBLOL: { id: "cblol", name: "Campeonato Brasileiro",    region: "Brazil", tier: "primary" },
  LJL:   { id: "ljl",   name: "League of Legends Japan",  region: "Japan",  tier: "primary" },
  LCO:   { id: "lco",   name: "League of Legends Circuit Oceania", region: "OCE", tier: "secondary" },
};

/** Output paths */
export const OUTPUT_DIR = "output";
export const PHOTOS_DIR = "output/player-photos";
export const CACHE_DIR = ".cache";

import type { LolRole } from "./types";

/** Country name → ISO 3166-1 alpha-2 */
export const COUNTRY_MAP: Record<string, string> = {
  "South Korea": "KR", Korea: "KR",
  Denmark: "DK",
  Spain: "ES", "España": "ES",
  France: "FR",
  Germany: "DE",
  "United Kingdom": "GB", "Great Britain": "GB", England: "GB",
  Sweden: "SE",
  Poland: "PL",
  Czechia: "CZ", "Czech Republic": "CZ",
  Netherlands: "NL",
  Belgium: "BE",
  Norway: "NO",
  Finland: "FI",
  Turkey: "TR",
  Greece: "GR",
  Italy: "IT",
  Portugal: "PT",
  Austria: "AT",
  Switzerland: "CH",
  Romania: "RO",
  Bulgaria: "BG",
  Hungary: "HU",
  Serbia: "RS",
  Croatia: "HR",
  Slovenia: "SI",
  Slovakia: "SK",
  Lithuania: "LT",
  Latvia: "LV",
  Estonia: "EE",
  Ukraine: "UA",
  Russia: "RU",
  "United States": "US", "USA": "US",
  Canada: "CA",
  Mexico: "MX",
  Brazil: "BR",
  Argentina: "AR",
  Chile: "CL",
  Peru: "PE",
  Colombia: "CO",
  China: "CN",
  Taiwan: "TW",
  "Hong Kong": "HK",
  Japan: "JP",
  Vietnam: "VN",
  Australia: "AU",
  "New Zealand": "NZ",
  Philippines: "PH",
  India: "IN",
  "South Africa": "ZA",
  Egypt: "EG",
  Morocco: "MA",
  Israel: "IL",
  Thailand: "TH",
  Malaysia: "MY",
  Singapore: "SG",
  Indonesia: "ID",
  "Costa Rica": "CR",
  EMEA: "EU",
};

/** Role normalization */
export function normalizeRole(raw: string): LolRole | null {
  const r = raw.trim().toLowerCase();
  if (r === "mid" || r === "mid lane" || r === "midlaner") return "Mid";
  if (r === "top" || r === "top lane" || r === "toplaner") return "Top";
  if (r === "jungle" || r === "jungler" || r === "jungla") return "Jungle";
  if (r === "bot" || r === "adc" || r === "ad carry" || r === "bot lane" || r === "bottom") return "Adc";
  if (r === "support" || r === "sup" || r === "supp") return "Support";
  if (r === "coach") return null; // Not a player role
  return null;
}

/** Country name → ISO code */
export function countryToISO(name: string): string {
  const trimmed = name.trim();
  // Already ISO
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
  // Lookup by name
  for (const [key, iso] of Object.entries(COUNTRY_MAP)) {
    if (key.toLowerCase() === trimmed.toLowerCase()) return iso;
  }
  // Partial match
  for (const [key, iso] of Object.entries(COUNTRY_MAP)) {
    if (trimmed.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(trimmed.toLowerCase())) {
      return iso;
    }
  }
  console.warn(`  ⚠️  Unknown country: "${trimmed}"`);
  return trimmed.toUpperCase().slice(0, 2);
}
