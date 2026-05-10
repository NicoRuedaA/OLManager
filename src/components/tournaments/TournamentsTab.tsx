import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { compareStandingsByLolScore, GameStateData, FixtureData, getStandingKillDiff, getStandingKillsAgainst, getStandingKillsFor } from "../../store/gameStore";
import { Card, CardHeader, CardBody, Badge } from "../ui";
import {
  Trophy,
  Trophy as TrophyIcon,
  Calendar,
  TableProperties,
  Users,
  Globe,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import {
  getTeamName,
  formatMatchDate,
} from "../../lib/helpers";
import { resolveSeasonContext } from "../../lib/seasonContext";
import { useTranslation } from "react-i18next";
import PlayoffBracketBoard from "../playoffs/PlayoffBracketBoard";

interface TeamSummary {
  id: string; name: string; short_name: string;
  logo_url?: string | null; country: string; ovr?: number | null;
}

interface CompetitionSummary {
  id: string; name: string; region: string;
  logo?: string | null; team_count: number; teams: TeamSummary[];
}

interface LeagueSelectionData {
  competitions: CompetitionSummary[];
}

interface TournamentsTabProps {
  gameState: GameStateData;
  onSelectTeam: (id: string) => void;
}

export default function TournamentsTab({
  gameState,
  onSelectTeam,
}: TournamentsTabProps) {
  const { t, i18n } = useTranslation();
  const league = gameState.league ?? gameState.leagues?.[0] ?? null;
  const academyLeague = gameState.academy_league ?? null;
  const userTeamId = gameState.manager.team_id;
  const seasonContext = resolveSeasonContext(gameState);
  const isPreseason = seasonContext.phase === "Preseason";
  const [view, setView] = useState<"overview" | "fixtures" | "standings">("overview");
  const [allCompetitions, setAllCompetitions] = useState<CompetitionSummary[] | null>(null);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<LeagueSelectionData>("get_league_selection_data")
      .then((data) => setAllCompetitions(data.competitions))
      .catch(() => setAllCompetitions([]))
      .finally(() => setLoading(false));
  }, []);

  // Show league grid when no competition selected
  if (!selectedCompId) {
    if (loading) {
      return (
        <div className="max-w-4xl mx-auto text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
        </div>
      );
    }

    const comps = allCompetitions ?? [];
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-heading font-bold uppercase tracking-wide text-gray-800 dark:text-gray-100">
          {t("tournaments.allCompetitions", "All Competitions")}
        </h2>
        {comps.length === 0 ? (
          <div className="max-w-4xl mx-auto text-center py-12">
            <TrophyIcon className="w-12 h-12 text-gray-300 dark:text-navy-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {t("tournaments.noActive", "No active tournaments.")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {comps.map((comp) => (
              <button
                key={comp.id}
                onClick={() => setSelectedCompId(comp.id)}
                className="text-left transition-all duration-200 rounded-xl hover:scale-[1.01]"
              >
                <Card className="h-full">
                  <div className="p-5 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-navy-700 flex items-center justify-center overflow-hidden">
                        {comp.logo ? (
                          <img src={comp.logo} alt={`${comp.name} logo`} className="w-10 h-10 object-contain" />
                        ) : (
                          <Globe className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-heading font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide text-sm">
                          {comp.name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{comp.region}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Users className="w-3.5 h-3.5" />
                      <span>{comp.team_count} {t("tournaments.teams", "teams")}</span>
                    </div>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Competition selected: find its data
  const selectedComp = allCompetitions?.find((c) => c.id === selectedCompId);
  const isUserLeague = selectedCompId === league?.id || selectedCompId === gameState.manager.team_id?.split("-")[0];

  if (!selectedComp) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t("tournaments.notFound", "Competition not found.")}</p>
        <button onClick={() => setSelectedCompId(null)} className="mt-4 text-primary-500 hover:underline">
          {t("common.back", "Back")}
        </button>
      </div>
    );
  }

  // If it's the user's league, show full tournament data
  if (isUserLeague && league) {
    const standings = [...league.standings].sort(compareStandingsByLolScore);
    const playoffFixtures = league.fixtures.filter((f) => f.competition === "Playoffs");
    const hasPlayoffsStarted = playoffFixtures.length > 0;
    const tournamentFixtures = league.fixtures.filter(
      (f) => f.competition === "League" || f.competition === "Playoffs",
    );
    const sortedMatchdays = [...new Set(tournamentFixtures.map((f) => f.matchday))].sort((a, b) => a - b).map(
      (md) => [md, tournamentFixtures.filter((f) => f.matchday === md)] as [number, FixtureData[]],
    );
    const completedMatchdays = sortedMatchdays.filter(([, fixtures]) =>
      fixtures.every((f) => f.status === "Completed"),
    );

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => setSelectedCompId(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h2 className="text-lg font-heading font-bold uppercase tracking-wide text-gray-800 dark:text-gray-100">
            {selectedComp.name}
          </h2>
          <Badge variant="success" size="sm">{t("tournaments.yourLeague", "Your League")}</Badge>
        </div>
        {/* View tabs */}
        <div className="flex gap-2">
          {(["overview", "standings", "fixtures"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold uppercase tracking-wide transition-colors ${
                view === v ? "bg-primary-500 text-white" : "bg-gray-100 dark:bg-navy-700 text-gray-600 dark:text-gray-300"
              }`}
            >
              {v === "overview" ? t("tournaments.overview", "Overview") : v === "standings" ? t("tournaments.standings", "Standings") : t("tournaments.fixtures", "Fixtures")}
            </button>
          ))}
        </div>

        {view === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>{t("tournaments.leagueTable", "League Table")}</CardHeader>
                <CardBody className="p-0">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-navy-800 border-b border-gray-200 dark:border-navy-600 text-xs">
                        <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500">#</th>
                        <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500">{t("tournaments.team", "Team")}</th>
                        <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500">{t("tournaments.played", "P")}</th>
                        <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500">{t("tournaments.win", "W")}</th>
                        <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500">{t("tournaments.loss", "L")}</th>
                        <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500">{t("tournaments.points", "Pts")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-navy-600">
                      {standings.map((entry, i) => (
                        <tr key={entry.team_id} className={`hover:bg-gray-50 dark:hover:bg-navy-700/50 ${entry.team_id === userTeamId ? "bg-primary-50/50 dark:bg-primary-500/5" : ""}`}>
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
                </CardBody>
              </Card>
            </div>
            <div className="space-y-4">
              <Card>
                <CardHeader>{t("tournaments.recentResults", "Recent Results")}</CardHeader>
                <CardBody>
                  {sortedMatchdays.slice(-5).map(([md, fixtures]) => {
                    const first = fixtures[0];
                    return (
                      <div key={md} className="mb-3 last:mb-0">
                        <p className="text-xs text-gray-500 mb-1">
                          {first.competition === "Playoffs" ? first.competition : `${t("schedule.matchday", { number: md })}`} · {formatMatchDate(first.date)} · {fixtures.length} {t("tournaments.matches").toLowerCase()}
                        </p>
                      </div>
                    );
                  })}
                </CardBody>
              </Card>
            </div>
          </div>
        )}

        {view === "standings" && (
          <Card>
            <CardHeader>{t("tournaments.standings", "Standings")}</CardHeader>
            <CardBody className="p-0">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-navy-800 border-b border-gray-200 dark:border-navy-600 text-xs">
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500">#</th>
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500">{t("tournaments.team", "Team")}</th>
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500">{t("tournaments.played", "P")}</th>
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500">{t("tournaments.win", "W")}</th>
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500">{t("tournaments.loss", "L")}</th>
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500">{t("tournaments.points", "Pts")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-navy-600">
                  {standings.map((entry, i) => (
                    <tr key={entry.team_id} className={`hover:bg-gray-50 dark:hover:bg-navy-700/50 ${entry.team_id === userTeamId ? "bg-primary-50/50 dark:bg-primary-500/5" : ""}`}>
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
            </CardBody>
          </Card>
        )}

        {view === "fixtures" && (
          <div className="space-y-4">
            {sortedMatchdays.map(([md, fixtures]) => (
              <Card key={md}>
                <CardHeader>
                  {fixtures[0].competition === "Playoffs"
                    ? t("tournaments.playoffs", "Playoffs")
                    : t("schedule.matchday", { number: md })} — {formatMatchDate(fixtures[0].date)}
                </CardHeader>
                <CardBody className="p-0">
                  {fixtures.map((f) => (
                    <div key={f.id} className="flex items-center px-5 py-3 border-b border-gray-100 dark:border-navy-600 last:border-b-0">
                      <span className="flex-1 text-right text-sm">{getTeamName(gameState.teams, f.home_team_id)}</span>
                      <span className="mx-4 text-sm font-heading font-bold text-gray-400">VS</span>
                      <span className="flex-1 text-left text-sm">{getTeamName(gameState.teams, f.away_team_id)}</span>
                    </div>
                  ))}
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Other league: show team grid
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => setSelectedCompId(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <h2 className="text-lg font-heading font-bold uppercase tracking-wide text-gray-800 dark:text-gray-100">
          {selectedComp.name}
        </h2>
        <Badge variant="neutral" size="sm">{selectedComp.region}</Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {selectedComp.teams.map((team) => (
          <Card key={team.id}>
            <div className="p-4 flex items-center gap-3">
              {team.logo_url ? (
                <img src={team.logo_url} alt={team.name} className="w-10 h-10 object-contain rounded-lg" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-navy-700 flex items-center justify-center">
                  <Users className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-heading font-bold text-sm text-gray-800 dark:text-gray-100 truncate">{team.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{team.short_name} · {team.country}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
