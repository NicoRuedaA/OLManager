import { GameStateData, FixtureData } from "../../store/gameStore";
import type { MatchSnapshot } from "../match/types";
import type { DraftMatchResult } from "../match/draftResultSimulator";

export interface StoredSeriesGameResult {
  gameIndex: number;
  result: DraftMatchResult;
  winnerSide?: "blue" | "red";
}

export interface StoredFixtureDraftResult {
  snapshot: MatchSnapshot;
  controlledSide: "blue" | "red";
  result: DraftMatchResult;
  seriesGames?: StoredSeriesGameResult[];
  seriesLength?: 1 | 3 | 5;
  seriesGameIndex?: number;
  userSeriesWins?: number;
  opponentSeriesWins?: number;
  homeSeriesWins?: number;
  awaySeriesWins?: number;
}

const TEAM_LOGO_BY_NORMALIZED_NAME: Record<string, string> = {
  [normalizeKey("G2 Esports")]: "/teams-icons/g2-esports.webp",
  [normalizeKey("Movistar KOI")]: "/teams-icons/movistar-koi.webp",
  [normalizeKey("MAD Lions KOI")]: "/teams-icons/movistar-koi.webp",
  [normalizeKey("Fnatic")]: "/teams-icons/fnatic.webp",
  [normalizeKey("GIANTX")]: "/teams-icons/giantx-lec.webp",
  [normalizeKey("Karmine Corp")]: "/teams-icons/karmine-corp.webp",
  [normalizeKey("Natus Vincere")]: "/teams-icons/natus-vincere.webp",
  [normalizeKey("SK Gaming")]: "/teams-icons/sk-gaming.webp",
  [normalizeKey("Team Heretics")]: "/teams-icons/team-heretics-lec.webp",
  [normalizeKey("Team Vitality")]: "/teams-icons/team-vitality.webp",
  [normalizeKey("Team BDS")]: "/teams-icons/team-bds.webp",
  [normalizeKey("Shifters")]: "/teams-icons/shifters.webp",
};

export function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function toNonNegativeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

export interface BestOfContext {
  playoffBounds: { start: number | null; end: number | null };
  friendlySeriesLengthById: Record<string, 1 | 3 | 5>;
}

export function inferBestOf(fixture: FixtureData, ctx: BestOfContext): 1 | 3 | 5 {
  const explicitBestOf = toNonNegativeNumber(fixture.best_of);
  if (explicitBestOf === 1 || explicitBestOf === 3 || explicitBestOf === 5) {
    return explicitBestOf;
  }

  if (fixture.match_type === "Friendly") {
    return ctx.friendlySeriesLengthById[fixture.id] ?? 1;
  }

  if (fixture.match_type !== "Playoffs") return 1;

  const { start, end } = ctx.playoffBounds;
  if (start === null) return 3;

  if (fixture.matchday === start) return 3;
  if (fixture.matchday === start + 1) return 5;
  if (end !== null && fixture.matchday >= end) return 5;

  return 3;
}

export function normalizeLolScore(
  fixture: FixtureData,
  storedResult: StoredFixtureDraftResult | null,
  userTeamId: string,
  bo: 1 | 3 | 5,
): { home: number; away: number } | null {
  if (!fixture.result) return null;

  const rawHomeWins =
    toNonNegativeNumber(fixture.result.home_wins) ??
    toNonNegativeNumber(fixture.result.home_goals);
  const rawAwayWins =
    toNonNegativeNumber(fixture.result.away_wins) ??
    toNonNegativeNumber(fixture.result.away_goals);

  let storedHomeWins = toNonNegativeNumber(storedResult?.homeSeriesWins);
  let storedAwayWins = toNonNegativeNumber(storedResult?.awaySeriesWins);

  if (
    (storedHomeWins === null || storedAwayWins === null) &&
    storedResult?.snapshot &&
    typeof storedResult.userSeriesWins === "number" &&
    typeof storedResult.opponentSeriesWins === "number"
  ) {
    const isUserHome = storedResult.snapshot.home_team.id === userTeamId;
    const isUserAway = storedResult.snapshot.away_team.id === userTeamId;
    if (isUserHome) {
      storedHomeWins = storedResult.userSeriesWins;
      storedAwayWins = storedResult.opponentSeriesWins;
    } else if (isUserAway) {
      storedHomeWins = storedResult.opponentSeriesWins;
      storedAwayWins = storedResult.userSeriesWins;
    }
  }

  if (bo === 1) {
    const rawHome = rawHomeWins ?? 0;
    const rawAway = rawAwayWins ?? 0;
    if (rawHome === rawAway) return { home: 0, away: 0 };
    return rawHome > rawAway ? { home: 1, away: 0 } : { home: 0, away: 1 };
  }

  const resultHomeWins = rawHomeWins;
  const resultAwayWins = rawAwayWins;
  const preferredHomeWins = storedHomeWins;
  const preferredAwayWins = storedAwayWins;

  if (preferredHomeWins !== null && preferredAwayWins !== null) {
    return { home: preferredHomeWins, away: preferredAwayWins };
  }

  if (resultHomeWins !== null && resultAwayWins !== null) {
    return { home: resultHomeWins, away: resultAwayWins };
  }

  return null;
}

export function getTeamLogoPath(teams: GameStateData["teams"], teamId: string): string | null {
  const team = teams.find((candidate) => candidate.id === teamId);
  if (!team) return null;

  // Use logo_url from backend if available (already mapped to /teams-icons/)
  if (team.logo_url) return team.logo_url;

  const normalizedName = normalizeKey(team.name);
  return TEAM_LOGO_BY_NORMALIZED_NAME[normalizedName] ?? null;
}

export function readStoredFixtureDraftResult(fixtureId: string): StoredFixtureDraftResult | null {
  try {
    const raw = localStorage.getItem(`fixture-draft-result:${fixtureId}`);
    if (!raw) return null;
    return JSON.parse(raw) as StoredFixtureDraftResult;
  } catch {
    return null;
  }
}

export function buildBestOfContext(fixtures: FixtureData[]): BestOfContext {
  const playoffFixtures = fixtures.filter((f) => f.match_type === "Playoffs");
  const playoffBounds = {
    start: playoffFixtures.length > 0 ? Math.min(...playoffFixtures.map((f) => f.matchday)) : null,
    end: playoffFixtures.length > 0 ? Math.max(...playoffFixtures.map((f) => f.matchday)) : null,
  };
  const preseasonFriendlyFixtures = fixtures
    .filter((f) => f.match_type === "Friendly" && f.matchday === 0)
    .sort(
      (l, r) =>
        l.date.localeCompare(r.date) ||
        l.matchday - r.matchday ||
        l.id.localeCompare(r.id),
    );
  const friendlySeriesLengthById: Record<string, 1 | 3 | 5> = {};
  if (preseasonFriendlyFixtures[0]) friendlySeriesLengthById[preseasonFriendlyFixtures[0].id] = 3;
  if (preseasonFriendlyFixtures[1]) friendlySeriesLengthById[preseasonFriendlyFixtures[1].id] = 5;
  return { playoffBounds, friendlySeriesLengthById };
}

export function parseFixtureDate(dateStr: string): Date | null {
  const dateOnly = dateStr.substring(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
  const value = new Date(`${dateOnly}T12:00:00`);
  if (Number.isNaN(value.getTime())) return null;
  return value;
}

export function isoDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
