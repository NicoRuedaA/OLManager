/** Parse {{Infobox Player}} from Leaguepedia wikitext */
import { normalizeRole, countryToISO } from "./config";
import type { ScrapedPlayer, LolRole } from "./types";

export interface InfoboxData {
  id: string | null;
  name: string | null;
  country: string | null;
  residency: string | null;
  role: string | null;
  isretired: string | null;
  birthYear: string | null;
  birthMonth: string | null;
  birthDay: string | null;
  favchamps: string[];
  twitter: string | null;
  stream: string | null;
  instagram: string | null;
  checkboxAutoImage: string | null;
  pageType: string | null;
  raw: Record<string, string>;
}

/** Parse wikitext and extract {{Infobox Player}} fields */
export function parseInfobox(wikitext: string): InfoboxData | null {
  const lines = wikitext.split(/\r?\n/);
  let inInfobox = false;
  const ibLines: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith("{{Infobox Player")) {
      inInfobox = true;
      ibLines.push(line);
      continue;
    }
    if (inInfobox) {
      ibLines.push(line);
      // End of template — }} on its own line or at end of line with no | before it
      const trimmed = line.trim();
      if (trimmed === "}}" || trimmed.endsWith("}}") && !trimmed.includes("=")) {
        break;
      }
    }
  }

  if (ibLines.length < 2) return null;

  const raw: Record<string, string> = {};

  for (const line of ibLines) {
    const trimmed = line.trim();
    if (trimmed === "}}" || trimmed === "{{Infobox Player") continue;

    const match = trimmed.match(/^\|([^=]+?)\s*=\s*(.+)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Clean up wiki markup
      value = value.replace(/'''/g, "");        // bold
      value = value.replace(/''/g, "");          // italic
      value = value.replace(/<br\s*\/?>/gi, ", "); // line breaks
      value = value.replace(/<[^>]+>/g, "");     // HTML tags
      value = value.replace(/&amp;/g, "&");
      value = value.replace(/&lt;/g, "<");
      value = value.replace(/&gt;/g, ">");
      value = value.replace(/&nbsp;/g, " ");
      value = value.replace(/&quot;/g, '"');
      raw[key] = value;
    }
  }

  // Extract favchamps
  const favchamps: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const key = i === 1 ? "favchamp" : `favchamp${i}`;
    if (raw[key]?.trim()) {
      // May contain multiple champions separated by commas
      const champs = raw[key].split(/[,;]/).map(c => c.trim()).filter(Boolean);
      favchamps.push(...champs);
    }
  }

  return {
    id: raw["id"]?.trim() ?? null,
    name: raw["name"]?.trim() ?? null,
    country: raw["country"]?.trim() ?? null,
    residency: raw["residency"]?.trim() ?? null,
    role: raw["role"]?.trim() ?? null,
    isretired: raw["isretired"]?.trim() ?? null,
    birthYear: raw["birth_date_year"]?.trim() ?? null,
    birthMonth: raw["birth_date_month"]?.trim() ?? null,
    birthDay: raw["birth_date_day"]?.trim() ?? null,
    favchamps,
    twitter: raw["twitter"]?.trim() ?? null,
    stream: raw["stream"]?.trim() ?? null,
    instagram: raw["instagram"]?.trim() ?? null,
    checkboxAutoImage: raw["checkboxAutoImage"]?.trim() ?? null,
    pageType: raw["page_type"]?.trim() ?? null,
    raw,
  };
}

/** Convert infobox data to ScrapedPlayer */
export function infoboxToPlayer(ib: InfoboxData, pageTitle: string): ScrapedPlayer | null {
  const ign = ib.id ?? pageTitle.replace(/ \(.*\)$/, "").trim();
  if (!ign || ign.length < 2 || ign.length > 30) return null;

  const fullName = ib.name ?? ign;
  const nameParts = fullName.split(" ");
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ") ?? "";

  // Build date of birth
  let dateOfBirth: string | null = null;
  if (ib.birthYear && ib.birthMonth) {
    const months: Record<string, number> = {
      january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
      july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    };
    const monthNum = months[ib.birthMonth.toLowerCase()] ?? 1;
    const day = ib.birthDay ? String(Math.min(parseInt(ib.birthDay) || 1, 28)).padStart(2, "0") : "01";
    dateOfBirth = `${ib.birthYear}-${String(monthNum).padStart(2, "0")}-${day}`;
  }

  const nationality = ib.country ? countryToISO(ib.country) : "XX";
  const rawRole = ib.role ?? "Mid";
  const role = normalizeRole(rawRole);

  const status =
    ib.isretired?.toLowerCase() === "yes" ? "Retired"
    : ib.pageType === "Retired" ? "Retired"
    : ib.pageType === "Staff" ? "Inactive"
    : "Active";

  // Skip non-player pages
  if (ib.pageType && !["Player", "Retired"].includes(ib.pageType) && ib.pageType !== "Staff") {
    return null; // Likely a coach/analyst/team page with infobox
  }

  // Generate deterministic ID
  const idInput = `${ign}-${dateOfBirth ?? "unknown"}-${nationality}`;
  let hash = 0;
  for (let i = 0; i < idInput.length; i++) {
    hash = ((hash << 5) - hash) + idInput.charCodeAt(i);
    hash |= 0;
  }
  const photoHash = Math.abs(hash).toString(16).padStart(8, "0").slice(0, 8);

  // Country flag emoji
  const flag = nationality.length === 2
    ? String.fromCodePoint(0x1F1E6 + nationality.charCodeAt(0) - 65, 0x1F1E6 + nationality.charCodeAt(1) - 65)
    : "🏳️";

  return {
    id: `player-${photoHash}`,
    ign,
    fullName,
    firstName,
    lastName,
    dateOfBirth,
    nationality,
    nationalityFlag: flag,
    role,
    roleRaw: rawRole,
    residency: ib.residency ?? null,
    status,
    championPool: ib.favchamps.slice(0, 5),
    photoId: ib.checkboxAutoImage?.toLowerCase() === "yes" ? photoHash : null,
    photoUrl: null, // Will be resolved later
    teamName: null, // Will be inferred from page context
    teamShort: null,
    leagueId: null,
    leagueName: null,
    region: null,
    socials: {
      twitter: ib.twitter,
      stream: ib.stream,
      instagram: ib.instagram,
    },
    scrapedAt: new Date().toISOString(),
  };
}
