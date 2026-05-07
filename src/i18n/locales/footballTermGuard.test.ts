import { describe, expect, it as itTest } from "vitest";

import de from "../locales/de.json";
import en from "../locales/en.json";
import es from "../locales/es.json";
import fr from "../locales/fr.json";
import itLocale from "../locales/it.json";
import ptBR from "../locales/pt-BR.json";
import pt from "../locales/pt.json";
import tr from "../locales/tr.json";

type LocaleTree = Record<string, unknown>;

const LOCALE_RESOURCES: Record<string, LocaleTree> = {
  de,
  en,
  es,
  fr,
  pt,
  "pt-BR": ptBR,
  tr,
  it: itLocale,
};

/**
 * Allowlist of legitimate LoL/esports terms only.
 * Minimum allowlist - only terms clearly LoL/esports that could legitimately
 * overlap with football vocabulary but have distinct esports meaning.
 * NO football terms allowed in any visible UI text.
 */
const FOOTBALL_ALLOWLIST: Record<string, string[]> = {
  en: [
    "lineup",
    "Starting Five",
    "Rift",
    "game plan",
    "objectives",
    "objective specialist",
  ],
  es: [
    "alineación",
    "quinteto",
    "quinteto inicial",
    "cinco inicial",
    "Grieta",
    "plan de juego",
    "objetivos",
  ],
  tr: [
    "İlk 5",
    "Rift",
    "hedefler",
  ],
  it: [
    "Rift",
    "obiettivi",
  ],
  fr: [
    "composition",
    "cinq de départ",
    " Rift",
    "objectifs",
    "fight",
    "fight plan",
    "fightplan",
  ],
  de: [
    "aufstellung",
    "spielplan",
    "objektive",
  ],
  pt: [
    "escalação",
    "plano de jogo",
    "objetivos",
  ],
  "pt-BR": [
    "escalação",
    "plano de jogo",
    "objetivos",
  ],
};

/**
 * Legitimate LoL role abbreviations - standard esports roles.
 * These are standard LoL positional abbreviations, NOT football (POR/DIF/CEN/ATT removed).
 */
const LOLEGITIMATE_ROLES = new Set([
  "TOP", "JGL", "JUNGLE", "MID", "ADC", "SUP", "SUPPORT", "BOT", "KL"
]);

/**
 * Extract only visible/translatable string values from locale.
 * Excludes technical keys (like "formation", "tactics", etc.) that are internal structure,
 * and only returns strings that would be shown to users.
 * Keys with very short values or that look like technical structure are excluded.
 */
function getAllVisibleStringValues(obj: unknown): string[] {
  if (typeof obj === "string") {
    // Exclude very short keys that are likely technical structure
    if (obj.length < 3) return [];
    return [obj];
  }
  if (Array.isArray(obj)) return obj.flatMap((item) => getAllVisibleStringValues(item));
  if (obj && typeof obj === "object") {
    // At root level, include all values; deeper levels we check for visible content
    return Object.entries(obj as Record<string, unknown>).flatMap(([, value]) =>
      getAllVisibleStringValues(value)
    );
  }
  return [];
}

function isAllowListed(locale: string, value: string): boolean {
  const localeAllowlist = FOOTBALL_ALLOWLIST[locale] || [];
  return localeAllowlist.some((term) => value.toLowerCase().includes(term.toLowerCase()));
}

/**
 * Prohibited football-specific terms.
 * Focuses on clear football terms: sport names, team counts (XI/11),
 * and football-specific vocabulary. Avoids overly broad patterns
 * like "formation" that could have valid LoL meanings.
 */
const PROHIBITED_TERMS_BY_LOCALE: Record<string, RegExp[]> = {
  en: [
    /\bfootball\b/i,
    /\bBest XI\b/i,
    /\bFirst XI\b/i,
    /\bstarting XI\b/i,
  ],
  es: [
    /\bfútbol\b/i,
    /\bfootball\b/i,
    /\bBalón Parado\b/i,
    /\bMejor XI\b/i,
    /\bOnce inicial\b/i,
  ],
  tr: [
    /\bfutbol\b/i,
  ],
  it: [
    /\bcalcio\b/i,
    /\bMiglior XI\b/i,
    /\bUndici\b/i,
  ],
  fr: [
    /\bfootball\b/i,
    /\bMeilleur XI\b/i,
    /\bOnze\b/i,
  ],
  pt: [
    /\bfutebol\b/i,
    /\bMelhor XI\b/i,
    /\bOnze\b/i,
  ],
  "pt-BR": [
    /\bfutebol\b/i,
    /\bMelhor XI\b/i,
    /\bOnze\b/i,
  ],
  de: [
    /\bBesten XI\b/i,
    /\bStartelf\b/i,
  ],
};

describe("i18n locale football guard", () => {
  for (const [localeCode, localeData] of Object.entries(LOCALE_RESOURCES)) {
    if (!localeData) continue;

    itTest(`should not contain prohibited football terms in ${localeCode}`, () => {
      const values = getAllVisibleStringValues(localeData);
      const failures: string[] = [];

      for (const value of values) {
        if (!value || typeof value !== "string" || value.length < 3) continue;
        if (LOLEGITIMATE_ROLES.has(value.toUpperCase())) continue;
        if (isAllowListed(localeCode, value)) continue;

        const prohibited = PROHIBITED_TERMS_BY_LOCALE[localeCode];
        if (!prohibited) continue;

        for (const pattern of prohibited) {
          pattern.lastIndex = 0;
          if (pattern.test(value)) {
            const matchedPattern = pattern.toString();
            failures.push(`"${value.substring(0, 60)}${value.length > 60 ? "..." : ""}" [${matchedPattern}]`);
          }
        }
      }

      expect(failures.length, `Failures in ${localeCode}:\n${failures.join('\n')}`).toBe(0);
    });
  }
});
