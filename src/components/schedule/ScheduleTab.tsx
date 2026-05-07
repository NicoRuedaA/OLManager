import { useEffect, useState } from "react";
import { compareStandingsByLolScore, GameStateData, FixtureData, getStandingKillDiff, getStandingKillsAgainst, getStandingKillsFor } from "../../store/gameStore";
import { Card, CardBody, Badge } from "../ui";
import {
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronRight,
  TableProperties,
  Trophy,
} from "lucide-react";
import { getTeamName, formatMatchDate } from "../../lib/helpers";
import { resolveSeasonContext } from "../../lib/seasonContext";
import { useTranslation } from "react-i18next";
import DraftResultScreen from "../match/DraftResultScreen";
import PlayoffBracketBoard from "../playoffs/PlayoffBracketBoard";
import ScheduleCalendarView from "./ScheduleCalendarView";
import {
  buildBestOfContext,
  getTeamLogoPath,
  inferBestOf,
  normalizeLolScore,
  readStoredFixtureDraftResult,
  type StoredFixtureDraftResult,
} from "./ScheduleTab.helpers";

interface ScheduleTabProps {
  gameState: GameStateData;
  onSelectTeam: (id: string) => void;
}

export default function ScheduleTab({
  gameState,
  onSelectTeam,
}: ScheduleTabProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<"fixtures" | "calendar" | "standings">("fixtures");
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return true;
    }
    return window.matchMedia("(min-width: 768px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mql = window.matchMedia("(min-width: 768px)");
    const handler = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!isDesktop && view === "calendar") {
      setView("fixtures");
    }
  }, [isDesktop, view]);
  const [fixtureResultView, setFixtureResultView] = useState<StoredFixtureDraftResult | null>(null);
  const league = gameState.league;
  const userTeamId = gameState.manager.team_id;
  const seasonContext = resolveSeasonContext(gameState);
  const isPreseason = seasonContext.phase === "Preseason";

  const getFixtureGroupKey = (fixture: FixtureData): string => {
    if (fixture.competition === "League") {
      return `league-${fixture.matchday}`;
    }

    if (fixture.competition === "Playoffs") {
      return `playoffs-${fixture.matchday}`;
    }

    return `${fixture.competition}-${fixture.date}`;
  };

  const getFixtureGroupLabel = (fixture: FixtureData): string => {
    if (fixture.competition === "League") {
      return `${t("schedule.matchday", { number: fixture.matchday })} — ${formatMatchDate(fixture.date)}`;
    }

    if (fixture.competition === "Playoffs") {
      const playoffStart = league?.fixtures
        ?.filter((candidate) => candidate.competition === "Playoffs")
        .map((candidate) => candidate.matchday)
        .reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY);
      const round = Number.isFinite(playoffStart)
        ? fixture.matchday - (playoffStart ?? 0) + 1
        : fixture.matchday;
      return `${t("schedule.playoffs")} · ${t("schedule.round", { number: round })} — ${formatMatchDate(fixture.date)}`;
    }

    if (fixture.competition === "PreseasonTournament") {
      return `${t("season.preseasonTournament")} — ${formatMatchDate(fixture.date)}`;
    }

    return `${t("season.friendly")} — ${formatMatchDate(fixture.date)}`;
  };

  if (!league) {
    return (
      <p className="text-gray-500 dark:text-gray-400 text-center py-8">
        {t("schedule.noLeague")}
      </p>
    );
  }

  if (fixtureResultView) {
    return (
      <DraftResultScreen
        snapshot={fixtureResultView.snapshot}
        controlledSide={fixtureResultView.controlledSide}
        result={fixtureResultView.result}
        seriesGames={fixtureResultView.seriesGames}
        seriesLength={fixtureResultView.seriesLength}
        seriesGameIndex={fixtureResultView.seriesGameIndex}
        userSeriesWins={fixtureResultView.userSeriesWins}
        opponentSeriesWins={fixtureResultView.opponentSeriesWins}
        onContinue={() => setFixtureResultView(null)}
      />
    );
  }

  const fixturesForDisplay = league.fixtures;
  const playoffFixtures = fixturesForDisplay.filter((fixture) => fixture.competition === "Playoffs");
  const bestOfContext = buildBestOfContext(fixturesForDisplay);

  // Group fixtures by matchday
  const matchdays = new Map<string, FixtureData[]>();
  fixturesForDisplay.forEach((f) => {
    const key = getFixtureGroupKey(f);
    const list = matchdays.get(key) || [];
    list.push(f);
    matchdays.set(key, list);
  });
  const sortedMatchdays = Array.from(matchdays.entries()).sort((a, b) => {
    const leftFixture = a[1][0];
    const rightFixture = b[1][0];
    return (
      leftFixture.date.localeCompare(rightFixture.date) ||
      leftFixture.matchday - rightFixture.matchday
    );
  });

  // Sorted standings
  const standings = [...league.standings].sort(compareStandingsByLolScore);

  return (
    <div className={view === "calendar" ? "w-full" : "max-w-6xl mx-auto"}>
      {isPreseason && (
        <Card accent="accent" className="mb-5">
          <CardBody>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent" size="sm">
                  {t(`season.phases.${seasonContext.phase}`)}
                </Badge>
                <span className="text-sm font-heading font-bold text-gray-800 dark:text-gray-100">
                  {seasonContext.season_start
                    ? t("season.startsOn", {
                        date: formatMatchDate(seasonContext.season_start),
                      })
                    : t("season.noOpener")}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("season.standingsLocked")}
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Tab switcher */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setView("fixtures")}
          className={`px-4 py-2 rounded-lg font-heading font-bold text-sm uppercase tracking-wider transition-all ${
            view === "fixtures"
              ? "bg-primary-500 text-white shadow-md shadow-primary-500/20"
              : "bg-white dark:bg-navy-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-navy-600"
          }`}
        >
          <CalendarIcon className="w-4 h-4 inline mr-1.5 -mt-0.5" />{" "}
          {t("schedule.fixtures")}
        </button>
        <button
          onClick={() => setView("calendar")}
          className={`hidden md:inline-block px-4 py-2 rounded-lg font-heading font-bold text-sm uppercase tracking-wider transition-all ${
            view === "calendar"
              ? "bg-primary-500 text-white shadow-md shadow-primary-500/20"
              : "bg-white dark:bg-navy-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-navy-600"
          }`}
        >
          <CalendarDays className="w-4 h-4 inline mr-1.5 -mt-0.5" />{" "}
          {t("schedule.calendar", "Calendario")}
        </button>
        <button
          onClick={() => setView("standings")}
          className={`px-4 py-2 rounded-lg font-heading font-bold text-sm uppercase tracking-wider transition-all ${
            view === "standings"
              ? "bg-primary-500 text-white shadow-md shadow-primary-500/20"
              : "bg-white dark:bg-navy-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-navy-600"
          }`}
        >
          <TableProperties className="w-4 h-4 inline mr-1.5 -mt-0.5" />{" "}
          {t("schedule.standings")}
        </button>
      </div>

      {view === "calendar" && (
        <ScheduleCalendarView
          gameState={gameState}
          fixtures={fixturesForDisplay}
          onOpenFixtureResult={(stored) => setFixtureResultView(stored)}
        />
      )}

      {view === "fixtures" && (
        <div className="flex flex-col gap-4">
          {playoffFixtures.length > 0 ? (
            <PlayoffBracketBoard
              league={league}
              teams={gameState.teams}
              onSelectTeam={onSelectTeam}
              title={`${t("schedule.playoffs")} · Bracket`}
            />
          ) : null}

          {sortedMatchdays.map(([groupKey, fixtures]) => (
            <Card key={groupKey}>
              <div className="px-5 py-3 border-b border-gray-100 dark:border-navy-600 bg-gray-50 dark:bg-navy-800 rounded-t-xl">
                <h4 className="font-heading font-bold text-sm uppercase tracking-wider text-gray-600 dark:text-gray-300">
                  {getFixtureGroupLabel(fixtures[0])}
                </h4>
              </div>
              <CardBody className="p-0">
                <div className="divide-y divide-gray-100 dark:divide-navy-600">
                  {fixtures.map((f) => {
                    const storedDraftResult = readStoredFixtureDraftResult(f.id);
                    const isUserMatch =
                      f.home_team_id === userTeamId ||
                      f.away_team_id === userTeamId;
                    const completed = f.status === "Completed";
                    const bo = inferBestOf(f, bestOfContext);
                    const score = userTeamId
                      ? normalizeLolScore(f, storedDraftResult, userTeamId, bo)
                      : null;
                    const homeLogo = getTeamLogoPath(gameState.teams, f.home_team_id);
                    const awayLogo = getTeamLogoPath(gameState.teams, f.away_team_id);
                    const hasStoredResult = !!storedDraftResult;

                    const userResultTone = (() => {
                      if (!isUserMatch || !completed || !score) return "";
                      const userIsHome = f.home_team_id === userTeamId;
                      const userWins = userIsHome
                        ? score.home > score.away
                        : score.away > score.home;
                      return userWins
                        ? "bg-blue-500/10 dark:bg-blue-500/18"
                        : "bg-red-500/10 dark:bg-red-500/16";
                    })();

                    return (
                      <div key={f.id}>
                        <div
                          className={`grid grid-cols-[54px_1fr_60px_1fr_32px] items-center px-5 py-3 transition-colors ${userResultTone || (isUserMatch ? "bg-primary-50/50 dark:bg-primary-500/5" : "")}`}
                        >
                          <div className="text-left">
                            <Badge variant="neutral" size="sm">
                              BO{bo}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => onSelectTeam(f.home_team_id)}
                              className={`inline-flex items-center gap-2 text-sm font-semibold hover:underline ${f.home_team_id === userTeamId ? "text-primary-600 dark:text-primary-400" : "text-gray-800 dark:text-gray-200"}`}
                            >
                              {homeLogo ? (
                                <img src={homeLogo} alt={getTeamName(gameState.teams, f.home_team_id)} className="w-5 h-5 object-contain" loading="lazy" />
                              ) : null}
                              <span>{getTeamName(gameState.teams, f.home_team_id)}</span>
                            </button>
                          </div>

                          <span className="font-heading font-bold text-base text-gray-800 dark:text-gray-100 text-center">
                            {score ? `${score.home} - ${score.away}` : "VS"}
                          </span>

                          <div className="flex items-center justify-start gap-2">
                            <button
                              onClick={() => onSelectTeam(f.away_team_id)}
                              className={`inline-flex items-center gap-2 text-sm font-semibold hover:underline ${f.away_team_id === userTeamId ? "text-primary-600 dark:text-primary-400" : "text-gray-800 dark:text-gray-200"}`}
                            >
                              {awayLogo ? (
                                <img src={awayLogo} alt={getTeamName(gameState.teams, f.away_team_id)} className="w-5 h-5 object-contain" loading="lazy" />
                              ) : null}
                              <span>{getTeamName(gameState.teams, f.away_team_id)}</span>
                            </button>
                          </div>

                          <div className="flex justify-end">
                            {completed && f.result ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const stored = readStoredFixtureDraftResult(f.id);
                                  if (!stored) return;
                                  setFixtureResultView(stored);
                                }}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-500 dark:text-gray-300 hover:text-primary-500 transition-colors"
                                title={t("schedule.viewResult")}
                                disabled={!hasStoredResult}
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {view === "standings" &&
        (isPreseason ? (
          <Card>
            <CardBody>
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Trophy className="w-8 h-8 text-gray-300 dark:text-navy-600" />
                <p className="text-sm font-heading font-bold text-gray-800 dark:text-gray-100">
                  {t("season.standingsLocked")}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {seasonContext.season_start
                    ? t("season.startsOn", {
                        date: formatMatchDate(seasonContext.season_start),
                      })
                    : t("season.noOpener")}
                </p>
              </div>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <div className="p-5 border-b border-gray-100 dark:border-navy-600 bg-gradient-to-r from-navy-700 to-navy-800 rounded-t-xl">
              <h3 className="text-lg font-heading font-bold text-white flex items-center gap-2 uppercase tracking-wide">
                <Trophy className="text-accent-400 w-5 h-5" />
                {league.name} —{" "}
                {t("schedule.season", { number: league.season })}
              </h3>
              {playoffFixtures.length > 0 ? (
                <p className="mt-1 text-xs text-gray-300">
                  {t("season.standingsLocked")}
                </p>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-navy-800 border-b border-gray-200 dark:border-navy-600 text-xs">
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-8">
                      #
                    </th>
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t("common.team")}
                    </th>
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-center">
                      {t("common.played")}
                    </th>
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-center">
                      {t("common.won")}
                    </th>
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-center">
                      {t("common.lost")}
                    </th>
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-center">
                      {t("tournaments.mapScore")}
                    </th>
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-center">
                      {t("tournaments.mapsDiff")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-navy-600">
                  {standings.map((entry, idx) => {
                    const isUser = entry.team_id === userTeamId;
                    const mapDiff = getStandingKillDiff(entry);
                    return (
                      <tr
                        key={entry.team_id}
                        className={`transition-colors ${isUser ? "bg-primary-50 dark:bg-primary-500/10" : "hover:bg-gray-50 dark:hover:bg-navy-700/50"}`}
                      >
                        <td className="py-3 px-4 font-heading font-bold text-sm text-gray-400 dark:text-gray-500">
                          {idx + 1}
                        </td>
                        <td
                          onClick={() => onSelectTeam(entry.team_id)}
                          className={`py-3 px-4 font-semibold text-sm cursor-pointer hover:underline ${isUser ? "text-primary-600 dark:text-primary-400" : "text-gray-800 dark:text-gray-200"}`}
                        >
                          {getTeamName(gameState.teams, entry.team_id)}
                        </td>
                        <td className="py-3 px-4 text-center text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                          {entry.played}
                        </td>
                        <td className="py-3 px-4 text-center text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                          {entry.won}
                        </td>
                        <td className="py-3 px-4 text-center text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                          {entry.lost}
                        </td>
                        <td className="py-3 px-4 text-center text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                          {getStandingKillsFor(entry)}-{getStandingKillsAgainst(entry)}
                        </td>
                        <td
                          className={`py-3 px-4 text-center text-sm font-semibold tabular-nums ${mapDiff > 0 ? "text-primary-500" : mapDiff < 0 ? "text-red-500" : "text-gray-500 dark:text-gray-400"}`}
                        >
                          {mapDiff > 0 ? `+${mapDiff}` : mapDiff}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
    </div>
  );
}
