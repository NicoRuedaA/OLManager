/** Core types for the Leaguepedia scraper */

export type LolRole = "Top" | "Jungle" | "Mid" | "Adc" | "Support";
export type PlayerStatus = "Active" | "Retired" | "Free Agent" | "Inactive";

export interface ScrapedPlayer {
  /** Unique ID: sha256(ign + birth) first 8 chars */
  id: string;
  ign: string;
  fullName: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  nationality: string;       // ISO 3166-1 alpha-2
  nationalityFlag: string;   // emoji
  role: LolRole | null;
  roleRaw: string;
  residency: string | null;
  status: PlayerStatus;
  championPool: string[];
  photoId: string | null;    // sha256 hash for image filename
  photoUrl: string | null;   // original URL from wiki
  teamName: string | null;
  teamShort: string | null;
  leagueId: string | null;
  leagueName: string | null;
  region: string | null;
  socials: {
    twitter: string | null;
    stream: string | null;
    instagram: string | null;
  };
  scrapedAt: string;         // ISO timestamp
}

export interface ScrapedTeam {
  id: string;
  name: string;
  shortName: string;
  leagueId: string;
  leagueName: string;
  region: string;
  logoUrl: string | null;
}

export interface ScrapedLeague {
  id: string;
  name: string;
  shortName: string;
  region: string;
  tier: "primary" | "secondary" | "academy";
  teams: string[];           // team IDs
  playerCount: number;
}

export interface WorldOutput {
  meta: {
    version: string;
    scrapedAt: string;
    source: string;
    totalPlayers: number;
    totalTeams: number;
    leaguesScraped: string[];
    imageBasePath: string;
  };
  leagues: ScrapedLeague[];
  teams: ScrapedTeam[];
  players: ScrapedPlayer[];
}
