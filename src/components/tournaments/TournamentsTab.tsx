import { useEffect, useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { compareStandingsByLolScore, GameStateData, FixtureData, getStandingKillDiff, getStandingKillsAgainst, getStandingKillsFor } from "../../store/gameStore";
import { Card, CardBody, Badge } from "../ui";
import { Trophy, Users, Globe, ArrowLeft, Loader2 } from "lucide-react";
import { getTeamName, formatMatchDate } from "../../lib/helpers";
import { resolveSeasonContext } from "../../lib/seasonContext";
import { useTranslation } from "react-i18next";

interface TeamSummary {
  id: string; name: string; short_name: string;
  logo_url?: string | null; country: string;
}
interface CompetitionSummary {
  id: string; name: string; region: string;
  logo?: string | null; team_count: number; teams: TeamSummary[];
}
interface LeagueSelectionData { competitions: CompetitionSummary[]; }

interface TournamentsTabProps {
  gameState: GameStateData;
  onSelectTeam: (id: string) => void;
}

export default function TournamentsTab({
  gameState,
  onSelectTeam,
}: TournamentsTabProps) {
  const { t } = useTranslation();
  const league = gameState.leagues[0];
  const academyLeague = gameState.academy_league ?? null;
  const userTeamId = gameState.manager.team_id;
  const seasonContext = resolveSeasonContext(gameState);
  const isPreseason = seasonContext.phase === "Preseason";
  const [view, setView] = useState<"overview" | "fixtures" | "standings">(
    "overview",
  );

  // Find league data from gameState.leagues[] by matching competition ID
  const userTeamPrefix = gameState.manager.team_id?.split("-")[0] ?? null;
  const selectedLeague = useMemo(() => {
    if (!selectedCompId || !gameState.leagues) return null;
    // Match by checking team IDs — the league whose teams match the competition prefix
    return gameState.leagues.find((l) =>
      l.fixtures.some((f) => f.home_team_id.startsWith(selectedCompId + "-"))
    ) ?? null;
  }, [selectedCompId, gameState.leagues]);

  // League grid (no competition selected yet)
  if (!selectedCompId) {
    if (loading) return <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" /></div>;
    const comps = allComps ?? [];
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-heading font-bold uppercase tracking-wide text-gray-800 dark:text-gray-100">
          {t("tournaments.allCompetitions", "All Competitions")}
        </h2>
        {comps.length === 0 ? (
          <div className="text-center py-12"><Trophy className="w-12 h-12 text-gray-300 dark:text-navy-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">{t("tournaments.noActive", "No active tournaments.")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {comps.map((comp) => (
              <button key={comp.id} onClick={() => setSelectedCompId(comp.id)}
                className="text-left transition-all duration-200 rounded-xl hover:scale-[1.01]">
                <Card className="h-full">
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-navy-700 flex items-center justify-center overflow-hidden">
                        {comp.logo ? <img src={comp.logo} alt="" className="w-10 h-10 object-contain" />
                          : <Globe className="w-6 h-6 text-gray-400" />}
                      </div>
                      <div>
                        <h3 className="font-heading font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide text-sm">{comp.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{comp.region}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Users className="w-3.5 h-3.5" /><span>{comp.team_count} {t("tournaments.teams", "teams")}</span>
                    </div>
                    {comp.id === userTeamPrefix && <Badge variant="success" size="sm" className="mt-2">{t("tournaments.yourLeague", "Your League")}</Badge>}
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Competition selected — find its data in gameState.leagues
  const playerLeague = selectedLeague;
  if (!playerLeague) {
    // Fallback: show teams from get_league_selection_data
    const comp = allComps?.find((c) => c.id === selectedCompId);
    if (!comp) return <div className="text-center py-12"><p className="text-gray-500">{t("tournaments.notFound", "Competition not found.")}</p></div>;
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedCompId(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-navy-700"><ArrowLeft className="w-5 h-5" /></button>
          <h2 className="text-lg font-heading font-bold uppercase tracking-wide text-gray-800 dark:text-gray-100">{comp.name}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {comp.teams.map((team) => (
            <Card key={team.id}><div className="p-4 flex items-center gap-3">
              {team.logo_url ? <img src={team.logo_url} alt="" className="w-10 h-10 object-contain rounded-lg" />
                : <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-navy-700 flex items-center justify-center"><Users className="w-5 h-5 text-gray-400" /></div>}
              <div><p className="font-heading font-bold text-sm text-gray-800 dark:text-gray-100 truncate">{team.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{team.short_name} · {team.country}</p></div>
            </div></Card>
          ))}
        </div>
      </div>
    );
  }

  const playoffFixtures = league.fixtures.filter((fixture) => fixture.match_type === "Playoffs");
  const hasPlayoffsStarted = playoffFixtures.length > 0;
  const tournamentFixtures = league.fixtures.filter(
    (fixture) => fixture.match_type === "League" || fixture.match_type === "Playoffs",
  );

  const matchdays = new Map<number, FixtureData[]>();
  tournamentFixtures.forEach((f) => {
    const list = matchdays.get(f.matchday) || [];
    list.push(f);
    matchdays.set(f.matchday, list);
  });
  const sortedMatchdays = Array.from(matchdays.entries()).sort(
    (a, b) => a[0] - b[0],
  );

  const completedMatchdays = sortedMatchdays.filter(([, fixtures]) =>
    fixtures.every((f) => f.status === "Completed"),
  ).length;
  const totalMatchdays = sortedMatchdays.length;
  const userStanding = standings.find((entry) => entry.team_id === userTeamId);
  const userWins = userStanding?.won ?? 0;
  const completedMatches = tournamentFixtures.filter(
    (f) => f.status === "Completed",
  ).length;

  const academyStandings = academyLeague
      ? [...academyLeague.standings].sort(compareStandingsByLolScore)
    : [];
  const academyPlayoffFixtures = academyLeague
    ? academyLeague.fixtures.filter((fixture) => fixture.match_type === "Playoffs")
    : [];
  const hasAcademyPlayoffsStarted = academyPlayoffFixtures.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setSelectedCompId(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-navy-700"><ArrowLeft className="w-5 h-5" /></button>
        <h2 className="text-lg font-heading font-bold uppercase tracking-wide text-gray-800 dark:text-gray-100">{league.name}</h2>
        {selectedCompId === userTeamPrefix && <Badge variant="success" size="sm">{t("tournaments.yourLeague", "Your League")}</Badge>}
      </div>

      {/* Standings table */}
      <Card>
        <div className="px-5 py-3 border-b border-gray-100 dark:border-navy-600 font-heading font-bold text-sm uppercase tracking-wider">
          {t("tournaments.standings", "Standings")}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead><tr className="bg-gray-50 dark:bg-navy-800 border-b border-gray-200 dark:border-navy-600 text-xs">
              <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500">#</th>
              <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500">{t("tournaments.team", "Team")}</th>
              <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500">{t("tournaments.played", "P")}</th>
              <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500">{t("tournaments.win", "W")}</th>
              <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500">{t("tournaments.loss", "L")}</th>
              <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500">{t("tournaments.points", "Pts")}</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-600">
              {standings.map((entry, i) => (
                <tr key={entry.team_id} className={`hover:bg-gray-50 dark:hover:bg-navy-700/50 ${entry.team_id === gameState.manager.team_id ? "bg-primary-50/50 dark:bg-primary-500/5" : ""}`}>
                  <td className="py-2 px-4 font-heading font-bold text-sm">{i + 1}</td>
                  <td className="py-2 px-4 text-sm">{getTeamName(gameState.teams, entry.team_id)}</td>
                  <td className="py-2 px-4 text-sm">{entry.played}</td>
                  <td className="py-2 px-4 text-sm">{entry.won}</td>
                  <td className="py-2 px-4 text-sm">{entry.lost}</td>
                  <td className="py-2 px-4 text-sm font-heading font-bold">{entry.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-5">
        {(["overview", "standings", "fixtures"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg font-heading font-bold text-sm uppercase tracking-wider transition-all ${
              view === v
                ? "bg-primary-500 text-white shadow-md shadow-primary-500/20"
                : "bg-white dark:bg-navy-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-navy-600"
            }`}
          >
            {v === "overview" ? (
              <>
                <Trophy className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                {t("tournaments.overview")}
              </>
            ) : v === "standings" ? (
              <>
                <TableProperties className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                {t("schedule.standings")}
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4 inline mr-1.5 -mt-0.5" />
{t("schedule.matches")}
              </>
            )}
          </button>
        ))}
      </div>

      {/* Overview */}
      {view === "overview" && (
        <div className="space-y-5">
          {hasPlayoffsStarted ? (
            <PlayoffBracketBoard
              league={league}
              teams={gameState.teams}
              onSelectTeam={onSelectTeam}
              title={`${t("schedule.playoffs")} · ${t("tournaments.bracket")}`}
            />
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Mini standings */}
          <Card className="lg:col-span-2">
            <CardHeader>{t("tournaments.leagueTable")}</CardHeader>
            <CardBody className="p-0">
              {isPreseason ? (
                <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
                  <Trophy className="w-8 h-8 text-gray-300 dark:text-navy-600" />
                  <p className="text-sm font-heading font-bold text-gray-800 dark:text-gray-100">
                    {t("season.standingsLocked")}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md">
                    {t("season.tournamentsPreseasonHint")}
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-navy-800 border-b border-gray-200 dark:border-navy-600 text-xs">
                      <th className="py-2 px-3 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-8">#</th>
                      <th className="py-2 px-3 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t("common.team")}</th>
                      <th className="py-2 px-3 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-center">{t("common.played")}</th>
                      <th className="py-2 px-3 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-center">{t("common.won")}</th>
                      <th className="py-2 px-3 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-center">{t("common.lost")}</th>
                      <th className="py-2 px-3 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-center">{t("tournaments.mapScore")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-navy-600">
                    {standings.map((entry, idx) => {
                      const isUser = entry.team_id === userTeamId;
                      return (
                        <tr
                          key={entry.team_id}
                          onClick={() => onSelectTeam(entry.team_id)}
                          className={`cursor-pointer transition-colors ${isUser ? "bg-primary-50 dark:bg-primary-500/10" : "hover:bg-gray-50 dark:hover:bg-navy-700/50"}`}
                        >
                          <td className="py-2 px-3 font-heading font-bold text-sm text-gray-400">{idx + 1}</td>
                          <td className={`py-2 px-3 font-semibold text-sm ${isUser ? "text-primary-600 dark:text-primary-400" : "text-gray-800 dark:text-gray-200"}`}>{getTeamName(gameState.teams, entry.team_id)}</td>
                          <td className="py-2 px-3 text-center text-sm text-gray-600 dark:text-gray-400 tabular-nums">{entry.played}</td>
                          <td className="py-2 px-3 text-center text-sm text-gray-600 dark:text-gray-400 tabular-nums">{entry.won}</td>
                          <td className="py-2 px-3 text-center text-sm text-gray-600 dark:text-gray-400 tabular-nums">{entry.lost}</td>
                          <td className="py-2 px-3 text-center text-sm text-gray-600 dark:text-gray-400 tabular-nums">{getStandingKillsFor(entry)}-{getStandingKillsAgainst(entry)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>{t("schedule.matches")}</CardHeader>
            <CardBody className="p-0">
              {sortedMatchdays.length === 0 ? (
                <p className="p-4 text-sm text-gray-400 dark:text-gray-500 text-center">
                  {t("season.noOpener")}
                </p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-navy-600">
                  {sortedMatchdays.slice(-5).map(([md, fixtures]) => {
                    const first = fixtures[0];
                    return (
                      <div key={`overview-md-${md}`} className="px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-heading font-bold">
                          {first.match_type === "Playoffs"
                            ? `${t("schedule.playoffs")} · ${t("schedule.round", { number: md })}`
                            : t("schedule.matchday", { number: md })}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {formatMatchDate(first.date)} · {fixtures.length} {t("tournaments.matches").toLowerCase()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
          </div>

          {academyLeague ? (
            <div className="space-y-4">
              <Card accent="primary">
                <div className="bg-gradient-to-r from-navy-700 to-navy-800 p-4 rounded-t-xl">
                  <h3 className="text-lg font-heading font-bold text-white uppercase tracking-wide">
                    {academyLeague.name}
                  </h3>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {t("schedule.season", { number: academyLeague.season })} — {t("tournaments.nTeams", { count: academyLeague.standings.length })}
                  </p>
                </div>
              </Card>

              {hasAcademyPlayoffsStarted ? (
                <PlayoffBracketBoard
                  league={academyLeague}
                  teams={gameState.teams}
                  onSelectTeam={onSelectTeam}
                  title={`${t("schedule.playoffs")} · ${t("tournaments.bracket")}`}
                />
              ) : null}

              <Card>
                <CardBody>
                  <div className="flex items-center gap-3">
                    <Badge variant="primary" size="md">
                      #{userTeamStanding}
                    </Badge>
                    <div>
                      <p className="font-heading font-bold text-sm text-gray-900 dark:text-white">{getTeamName(gameState.teams, userTeamId)}</p>
                      <p className="text-xs text-gray-500">{t("tournaments.yourTeam")}</p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Standings */}
      {view === "standings" && (
        <Card>
          <CardHeader>{t("tournaments.leagueTable")}</CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-navy-800 border-b border-gray-200 dark:border-navy-600 text-xs">
                  <th className="py-2 px-3 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-8">#</th>
                  <th className="py-2 px-3 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t("common.team")}</th>
                  <th className="py-2 px-3 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-center">{t("common.played")}</th>
                  <th className="py-2 px-3 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-center">{t("common.won")}</th>
                  <th className="py-2 px-3 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-center">{t("common.lost")}</th>
                  <th className="py-2 px-3 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-center">{t("tournaments.mapScore")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-navy-600">
                {standings.map((entry, idx) => {
                  const isUser = entry.team_id === userTeamId;
                  return (
                    <tr
                      key={entry.team_id}
                      onClick={() => onSelectTeam(entry.team_id)}
                      className={`cursor-pointer transition-colors ${isUser ? "bg-primary-50 dark:bg-primary-500/10" : "hover:bg-gray-50 dark:hover:bg-navy-700/50"}`}
                    >
                      <td className="py-2 px-3 font-heading font-bold text-sm text-gray-400">{idx + 1}</td>
                      <td className={`py-2 px-3 font-semibold text-sm ${isUser ? "text-primary-600 dark:text-primary-400" : "text-gray-800 dark:text-gray-200"}`}>{getTeamName(gameState.teams, entry.team_id)}</td>
                      <td className="py-2 px-3 text-center text-sm text-gray-600 dark:text-gray-400 tabular-nums">{entry.played}</td>
                      <td className="py-2 px-3 text-center text-sm text-gray-600 dark:text-gray-400 tabular-nums">{entry.won}</td>
                      <td className="py-2 px-3 text-center text-sm text-gray-600 dark:text-gray-400 tabular-nums">{entry.lost}</td>
                      <td className="py-2 px-3 text-center text-sm text-gray-600 dark:text-gray-400 tabular-nums">{getStandingKillsFor(entry)}-{getStandingKillsAgainst(entry)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Fixtures */}
      {view === "fixtures" && (
        <div className="space-y-4">
          {filteredMatchdays.map(([md, fixtures]) => (
            <Card key={md}>
              <div className="px-5 py-3 border-b border-gray-100 dark:border-navy-600 bg-gray-50 dark:bg-navy-800 rounded-t-xl">
                <h4 className="font-heading font-bold text-sm uppercase tracking-wider text-gray-600 dark:text-gray-300">
                  {fixtures[0].match_type === "Playoffs"
                    ? `${t("schedule.playoffs")} · ${t("schedule.round", { number: md })}`
                    : t("schedule.matchday", { number: md })} — {formatMatchDate(fixtures[0].date)}
                </h4>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
