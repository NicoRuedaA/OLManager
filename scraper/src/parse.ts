/** Parse {{Infobox Player}} and {{Infobox Team}} from Leaguepedia wikitext */
import { normalizeRole, countryToISO } from "./config";
import type { ScrapedPlayer, ScrapedStaff, ScrapedTeam, LolRole, StaffCategory } from "./types";

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

// ─── Staff role detection ────────────────────────────────────────

const STAFF_ROLES = new Set([
  "coach", "head coach", "assistant coach", "strategic coach", "performance coach",
  "manager", "general manager", "team manager",
  "analyst", "head analyst",
  "owner", "founder", "ceo",
  "content creator", "streamer",
  "director of performance",
  "substitute", "sub",
]);

function isStaffRole(role: string | null): boolean {
  if (!role) return false;
  const r = role.trim().toLowerCase();
  return STAFF_ROLES.has(r);
}

export type EntityType = "player" | "staff" | "skip";

/** Classify an infobox as player, staff, or skip */
export function classifyInfobox(ib: InfoboxData): EntityType {
  const pt = ib.pageType?.toLowerCase() ?? "";
  const role = ib.role?.trim().toLowerCase() ?? "";

  // 1. Staff role (Coach, Manager, Analyst) → staff regardless of page_type
  if (isStaffRole(role)) return "staff";

  // 2. Explicit page type
  if (pt === "player") return "player";
  if (pt === "retired") return "player";
  if (pt === "staff") return "staff";

  // 3. Has a recognizable LoL role → player
  if (role && normalizeRole(role)) return "player";

  // 4. Has champion pool → player
  if (ib.favchamps.length > 0) return "player";

  // 5. Has lolpros/deeplol links → player
  if (ib.raw["lolpros"] || ib.raw["deeplol"]) return "player";

  // 6. Has no id → skip
  if (!ib.id) return "skip";

  // Unknown → skip
  return "skip";
}

// ─── Staff category mapping ──────────────────────────────────────

function classifyStaffRole(raw: string): StaffCategory {
  const r = raw.trim().toLowerCase();
  if (r.includes("head coach")) return "Head Coach";
  if (r.includes("assistant coach")) return "Assistant Coach";
  if (r.includes("strategic coach")) return "Strategic Coach";
  if (r.includes("performance coach") || r.includes("director of performance")) return "Director of Performance";
  if (r.includes("coach")) return "Coach";
  if (r.includes("general manager")) return "General Manager";
  if (r.includes("team manager") || r.includes("manager")) return "Manager";
  if (r.includes("head analyst")) return "Head Analyst";
  if (r.includes("analyst")) return "Analyst";
  if (r.includes("owner") || r.includes("founder") || r.includes("ceo")) return "Owner";
  if (r.includes("content creator") || r.includes("streamer")) return "Content Creator";
  if (r.includes("substitute") || r === "sub") return "Substitute";
  return "Other";
}

// ─── ID generator (deterministic hash) ──────────────────────────

function makeId(ign: string, dateOfBirth: string | null, nationality: string): string {
  const input = `${ign}-${dateOfBirth ?? "unknown"}-${nationality}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0").slice(0, 8);
}

function flagEmoji(iso: string): string {
  if (iso.length !== 2) return "🏳️";
  return String.fromCodePoint(
    0x1F1E6 + iso.charCodeAt(0) - 65,
    0x1F1E6 + iso.charCodeAt(1) - 65,
  );
}

function buildDateOfBirth(ib: InfoboxData): string | null {
  if (!ib.birthYear || !ib.birthMonth) return null;
  const months: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  };
  const monthNum = months[ib.birthMonth.toLowerCase()] ?? 1;
  const day = ib.birthDay ? String(Math.min(parseInt(ib.birthDay) || 1, 28)).padStart(2, "0") : "01";
  return `${ib.birthYear}-${String(monthNum).padStart(2, "0")}-${day}`;
}

function buildStatus(ib: InfoboxData): "Active" | "Retired" | "Former" {
  if (ib.isretired?.toLowerCase() === "yes") return "Retired";
  if (ib.pageType === "Retired") return "Retired";
  if (ib.pageType === "Staff") return "Former"; // staff pages are historical
  return "Active";
}

function cleanValue(v: string): string {
  return v
    .replace(/'''/g, "").replace(/''/g, "")
    .replace(/<br\s*\/?>/gi, ", ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"')
    .trim();
}

// ─── Parse wikitext ──────────────────────────────────────────────

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
      const trimmed = line.trim();
      if (trimmed === "}}" || (trimmed.endsWith("}}") && !trimmed.includes("="))) break;
    }
  }

  if (ibLines.length < 2) return null;

  const raw: Record<string, string> = {};
  for (const line of ibLines) {
    const trimmed = line.trim();
    if (trimmed === "}}" || trimmed === "{{Infobox Player") continue;
    const match = trimmed.match(/^\|([^=]+?)\s*=\s*(.+)$/);
    if (match) {
      raw[match[1].trim()] = cleanValue(match[2]);
    }
  }

  const favchamps: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const key = i === 1 ? "favchamp" : `favchamp${i}`;
    if (raw[key]?.trim()) {
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

// ─── Convert to player ──────────────────────────────────────────

export function infoboxToPlayer(ib: InfoboxData, pageTitle: string): ScrapedPlayer | null {
  const ign = ib.id ?? pageTitle.replace(/ \(.*\)$/, "").trim();
  if (!ign || ign.length < 2 || ign.length > 30) return null;

  const fullName = ib.name ?? ign;
  const nameParts = fullName.split(" ");
  const dateOfBirth = buildDateOfBirth(ib);
  const nationality = ib.country ? countryToISO(ib.country) : "XX";
  const rawRole = ib.role ?? "Mid";
  const role = normalizeRole(rawRole);
  const status = buildStatus(ib);
  const photoHash = makeId(ign, dateOfBirth, nationality);

  return {
    kind: "player",
    id: `player-${photoHash}`,
    ign,
    fullName,
    firstName: nameParts[0] ?? "",
    lastName: nameParts.slice(1).join(" ") ?? "",
    dateOfBirth,
    nationality,
    nationalityFlag: flagEmoji(nationality),
    teamId: null,
    role,
    roleRaw: rawRole,
    residency: ib.residency ?? null,
    status,
    championPool: ib.favchamps.slice(0, 5),
    attributes: null,
    ovr: null,
    potentialBase: null,
    marketValue: null,
    wage: null,
    career: [],
    photoId: ib.checkboxAutoImage?.toLowerCase() === "yes" ? photoHash : null,
    photoUrl: null,
    teamName: null,
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

// ─── TeamHistory parser ─────────────────────────────────────────

export interface TeamHistoryEntry {
  teamName: string;
  role: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
}

export function parseTeamHistory(wikitext: string): TeamHistoryEntry[] {
  const lines = wikitext.split(/\r?\n/);
  let inHistory = false;
  const entries: TeamHistoryEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("{{TeamHistory")) { inHistory = true; continue; }
    if (inHistory && trimmed === "}}") break;
    if (!inHistory) continue;

    const match = trimmed.match(/^\|(team|role|date)(\d+)\s*=\s*(.+)$/);
    if (match) {
      const index = parseInt(match[2]) - 1;
      const field = match[1];
      const value = match[3].trim();
      if (!entries[index]) entries[index] = { teamName: "", role: "", startDate: "", endDate: null, isCurrent: false };
      if (field === "team") entries[index].teamName = value;
      else if (field === "role") entries[index].role = value;
      else if (field === "date") {
        const parts = value.split(/[–-]/).map(s => s.trim());
        entries[index].startDate = parts[0] ?? "";
        entries[index].endDate = parts.length > 1 && parts[1].toLowerCase() !== "present" ? parts[1] : null;
        entries[index].isCurrent = parts.length <= 1 || parts[1]?.toLowerCase() === "present" || !parts[1];
      }
    }
  }
  return entries.filter(e => e.teamName);
}

export function mapTeamHistoryToCareer(
  history: TeamHistoryEntry[],
  teamNameToId: Map<string, string>,
): { career: Array<{ season: string; teamId: string; teamName: string; role: string }>; currentTeamId: string | null } {
  const career: Array<{ season: string; teamId: string; teamName: string; role: string }> = [];
  let currentTeamId: string | null = null;
  for (const entry of history) {
    const normalizedKey = entry.teamName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const teamId = teamNameToId.get(normalizedKey) ?? `team-${normalizedKey}`;
    const season = entry.startDate ? entry.startDate.slice(0, 4) : "?";
    career.push({ season, teamId, teamName: entry.teamName, role: entry.role });
    if (entry.isCurrent) currentTeamId = teamId;
  }
  return { career, currentTeamId };
}

export function infoboxToStaff(ib: InfoboxData, pageTitle: string): ScrapedStaff | null {
  const ign = ib.id ?? pageTitle.replace(/ \(.*\)$/, "").trim();
  if (!ign || ign.length < 2) return null;

  const fullName = ib.name ?? ign;
  const nameParts = fullName.split(" ");
  const dateOfBirth = buildDateOfBirth(ib);
  const nationality = ib.country ? countryToISO(ib.country) : "XX";
  const staffRole = ib.role ?? "Other";
  const staffCategory = classifyStaffRole(staffRole);
  const status = buildStatus(ib);
  const photoHash = makeId(ign, dateOfBirth, nationality);

  return {
    kind: "staff",
    id: `staff-${photoHash}`,
    ign,
    fullName,
    firstName: nameParts[0] ?? "",
    lastName: nameParts.slice(1).join(" ") ?? "",
    dateOfBirth,
    nationality,
    nationalityFlag: flagEmoji(nationality),
    teamId: null,
    staffRole,
    staffCategory,
    residency: ib.residency ?? null,
    status,
    photoId: ib.checkboxAutoImage?.toLowerCase() === "yes" ? photoHash : null,
    photoUrl: null,
    teamName: null,
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

// ─── Team infobox ────────────────────────────────────────────────

export interface TeamInfoboxData {
  name: string | null;
  shortName: string | null;
  region: string | null;
  country: string | null;
  location: string | null;
  foundedCountry: string | null;
  created: string | null;
  disbanded: string | null;
  isDisbanded: boolean;
  headCoach: string | null;
  owner: string | null;
  raw: Record<string, string>;
}

export function parseTeamInfobox(wikitext: string): TeamInfoboxData | null {
  const lines = wikitext.split(/\r?\n/);
  let inInfobox = false;
  const ibLines: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith("{{Infobox Team")) { inInfobox = true; ibLines.push(line); continue; }
    if (inInfobox) { ibLines.push(line); const trimmed = line.trim(); if (trimmed === "}}" || (trimmed.endsWith("}}") && !trimmed.includes("="))) break; }
  }

  if (ibLines.length < 2) return null;
  const raw: Record<string, string> = {};
  for (const line of ibLines) {
    const trimmed = line.trim();
    if (trimmed === "}}" || trimmed.match(/^\{\{Infobox Team/)) continue;
    const match = trimmed.match(/^\|([^=]+?)\s*=\s*(.+)$/);
    if (match) {
      let value = match[2].trim().replace(/<br\s*\/?>/gi, ", ").replace(/<[^>]+>/g, "").replace(/'''/g, "").replace(/''/g, "");
      value = value.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
      raw[match[1].trim()] = value;
    }
  }

  const disbanded = raw["disbanded"]?.trim() ?? null;
  return {
    name: raw["name"]?.trim() ?? null,
    shortName: raw["short"]?.trim() ?? null,
    region: raw["region"]?.trim() ?? null,
    country: raw["orgcountry"]?.trim() ?? null,
    location: raw["location"]?.trim() ?? raw["city"]?.trim() ?? null,
    foundedCountry: raw["foundedcountry"]?.trim() ?? null,
    created: raw["created"]?.trim() ?? null,
    disbanded,
    isDisbanded: disbanded !== null && disbanded !== "" && disbanded.toLowerCase() !== "no",
    headCoach: raw["headcoach"]?.trim() ?? null,
    owner: raw["owner"]?.trim() ?? null,
    raw,
  };
}

function regionToLeagueId(region: string | null): string {
  if (!region) return "unknown";
  const r = region.toLowerCase();
  if (r.includes("emea") || r.includes("europe")) return "lec";
  if (r.includes("korea")) return "lck"; if (r.includes("china")) return "lpl";
  if (r.includes("na") || r.includes("north america")) return "lcs";
  if (r.includes("apac") || r.includes("southeast asia")) return "pcs";
  if (r.includes("vietnam") || r.includes("vn")) return "vcs";
  if (r.includes("latam")) return "lla"; if (r.includes("brazil")) return "cblol";
  if (r.includes("japan")) return "ljl"; if (r.includes("oce")) return "lco";
  if (r.includes("turkey")) return "tcl"; if (r.includes("cis")) return "lcl";
  return "other";
}

function regionToLeagueName(region: string | null): string | null {
  if (!region) return null;
  const r = region.toLowerCase();
  if (r.includes("emea") || r.includes("europe")) return "LEC"; if (r.includes("korea")) return "LCK";
  if (r.includes("china")) return "LPL"; if (r.includes("na") || r.includes("north america")) return "LCS";
  if (r.includes("apac")) return "PCS"; if (r.includes("vietnam")) return "VCS";
  if (r.includes("latam")) return "LLA"; if (r.includes("brazil")) return "CBLOL";
  if (r.includes("japan")) return "LJL"; if (r.includes("oce")) return "LCO";
  return region;
}

export function infoboxToTeam(ib: TeamInfoboxData, pageTitle: string): ScrapedTeam | null {
  const name = ib.name ?? pageTitle;
  if (!name || name.length < 2) return null;
  const shortName = (ib.shortName ?? name.replace(/[A-Z]/g, m => ' ' + m).trim().split(/\s+/).map(w => (w.match(/[A-Za-z0-9]/)?.[0] ?? '')).join('').toUpperCase().slice(0, 4)) || name.slice(0, 4).toUpperCase();
  const country = ib.country ? countryToISO(ib.country) : "XX";
  const city = ib.location ?? "";
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return {
    id: `team-${normalizedName}`,
    name, shortName, country, city,
    arenaName: `${shortName} Arena`, arenaCapacity: 2500,
    region: ib.region ?? "Unknown",
    leagueId: regionToLeagueId(ib.region),
    leagueName: regionToLeagueName(ib.region),
    isDisbanded: ib.isDisbanded,
    logoUrl: null,
    sourcePage: null, // set during scrape
  };
}
