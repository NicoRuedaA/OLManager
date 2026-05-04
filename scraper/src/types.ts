/** Core types for the Leaguepedia scraper */

export type LolRole = "Top" | "Jungle" | "Mid" | "Adc" | "Support";
export type EntityStatus = "Active" | "Retired" | "Former";
export type StaffCategory =
  | "Coach" | "Head Coach" | "Assistant Coach" | "Strategic Coach"
  | "Manager" | "General Manager" | "Team Manager"
  | "Analyst" | "Head Analyst"
  | "Director of Performance" | "Performance Coach"
  | "Content Creator" | "Streamer"
  | "Owner" | "Founder"
  | "Substitute" | "Sub"
  | "Other";

/** Fields common to both players and staff */
interface ScrapedEntity {
  /** Unique ID: hash of ign+birth */
  id: string;
  ign: string;
  fullName: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  nationality: string;        // ISO 3166-1 alpha-2
  nationalityFlag: string;    // emoji
  teamName: string | null;
  teamShort: string | null;
  leagueId: string | null;
  leagueName: string | null;
  region: string | null;
  status: EntityStatus;
  photoId: string | null;
  photoUrl: string | null;
  socials: {
    twitter: string | null;
    stream: string | null;
    instagram: string | null;
  };
  scrapedAt: string;
}

export interface ScrapedPlayer extends ScrapedEntity {
  kind: "player";
  role: LolRole | null;
  roleRaw: string;
  residency: string | null;
  championPool: string[];
  attributes: Record<string, number> | null;
  ovr: number | null;
  potentialBase: number | null;
  marketValue: number | null;
  wage: number | null;
}

export interface ScrapedStaff extends ScrapedEntity {
  kind: "staff";
  staffRole: string;           // e.g. "Head Coach", "Analyst"
  staffCategory: StaffCategory;
  residency: string | null;
}

export interface ScrapedTeam {
  id: string;
  name: string;
  shortName: string;
  country: string;
  city: string;
  arenaName: string;
  arenaCapacity: number;
  region: string;
  leagueId: string;
  leagueName: string | null;
  isDisbanded: boolean;
  logoUrl: string | null;
}

export interface ScrapedLeague {
  id: string;
  name: string;
  shortName: string;
  region: string;
  tier: "primary" | "secondary" | "academy";
  teams: string[];
  memberCount: number;
}

export interface ScraperOutput {
  meta: {
    version: string;
    scrapedAt: string;
    source: string;
    totalPlayers: number;
    totalStaff: number;
    totalTeams: number;
    totalHistoricalTeams: number;
    leaguesScraped: string[];
    playerPhotosPath: string;
    staffPhotosPath: string;
  };
  leagues: ScrapedLeague[];
  teams: ScrapedTeam[];
  historicalTeams: ScrapedTeam[];
  players: ScrapedPlayer[];
  staff: ScrapedStaff[];
}
