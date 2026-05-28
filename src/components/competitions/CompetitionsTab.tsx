import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Users,
  Globe,
  Search,
  Loader2,
  Building2,
  Calendar,
  TrendingUp,

  ListOrdered,
} from "lucide-react";
import type { GameStateData, LeagueData } from "../../store/gameStore";
import {
  compareStandingsByLolScore,
  getStandingKillDiff,
} from "../../store/gameStore";
import ScheduleCalendarView from "../schedule/ScheduleCalendarView";
import { Card, CardBody, Badge } from "../ui";
import { getTeamLogoPath } from "../schedule/ScheduleTab.helpers";
import type { StoredFixtureDraftResult } from "../schedule/ScheduleTab.helpers";

interface CompetitionsTabProps {
  gameState: GameStateData;
  onSelectTeam?: (id: string) => void;
}

type DetailView = "calendar" | "standings" | "teams" | "players";

const COMPETITION_COLORS: Record<string, string> = {
  lec: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  lcs: "bg-red-500/20 text-red-300 border-red-500/30",
  lck: "bg-green-500/20 text-green-300 border-green-500/30",
  lpl: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  lcp: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  cblol: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

function getCompetitionColor(id: string): string {
  return COMPETITION_COLORS[id] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30";
}

export default function CompetitionsTab({ gameState, onSelectTeam }: CompetitionsTabProps) {
  const { t } = useTranslation();
  const [selectedCid, setSelectedCid] = useState<string | null>(null);
  const [detailView, setDetailView] = useState<DetailView>("calendar");

  const leagues = gameState.leagues;
  const selectedLeague = selectedCid
    ? leagues.find((l) => l.competition_id === selectedCid) ?? null
    : null;

  // Teams in selected competition (competition_id = manifest id like "lec", not UUID)
  const allTeams = gameState.teams ?? [];
  const selectedTeamIds = selectedCid
    ? allTeams
        .filter((t) => t.competition_id === selectedCid)
        .map((t) => t.id)
    : [];

  // Players in selected competition
  const allPlayers = gameState.players ?? [];
  const selectedPlayers = selectedTeamIds.length > 0
    ? allPlayers.filter((p) => p.team_id != null && selectedTeamIds.includes(p.team_id))
    : [];

  // Standings sorted
  const sortedStandings = selectedLeague
    ? [...selectedLeague.standings].sort(compareStandingsByLolScore)
    : [];

  // Build competition label map for calendar
  const competitionLabelMap = new Map<string, string>();
  leagues.forEach((l) => {
    l.fixtures.forEach((f) => competitionLabelMap.set(f.id, l.name));
  });

  const calendarFixtures = selectedLeague
    ? selectedLeague.fixtures
    : leagues.flatMap((l) => l.fixtures);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Globe className="w-6 h-6 text-primary-500" />
        <h2 className="text-xl font-heading font-bold text-gray-800 dark:text-gray-100">
          {t("competitions.title", "Competiciones")}
        </h2>
      </div>

      {/* Competitions grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {leagues.map((league) => (
          <CompetitionCard
            key={league.id}
            league={league}
            selected={selectedCid === league.id}
            colorClass={getCompetitionColor(league.id)}
            teamsCount={
              gameState.teams.filter((t) => t.competition_id === league.id)
                .length
            }
            onSelect={() => {
              const cid = league.competition_id ?? league.id;
              setSelectedCid(selectedCid === cid ? null : cid);
            }}
          />
        ))}
      </div>

      {/* Selected competition detail */}
      {selectedLeague && (
        <div className="space-y-4">
          {/* View switcher */}
          <div className="flex items-center gap-2 flex-wrap">
            <ViewButton
              icon={<Calendar />}
              label={t("competitions.calendar", "Calendario")}
              active={detailView === "calendar"}
              onClick={() => setDetailView("calendar")}
            />
            <ViewButton
              icon={<ListOrdered />}
              label={t("competitions.standings", "Clasificación")}
              active={detailView === "standings"}
              onClick={() => setDetailView("standings")}
            />
            <ViewButton
              icon={<Building2 />}
              label={t("competitions.teams", "Equipos")}
              active={detailView === "teams"}
              onClick={() => setDetailView("teams")}
              count={selectedTeamIds.length}
            />
            <ViewButton
              icon={<Users />}
              label={t("competitions.players", "Jugadores")}
              active={detailView === "players"}
              onClick={() => setDetailView("players")}
              count={selectedPlayers.length}
            />
          </div>

          {/* Calendar view */}
          {detailView === "calendar" && (
            <ScheduleCalendarView
              gameState={gameState}
              fixtures={calendarFixtures}
              competitionLabelMap={competitionLabelMap}
              onOpenFixtureResult={(_stored: StoredFixtureDraftResult) => {}}
            />
          )}

          {/* Standings view */}
          {detailView === "standings" && (
            <StandingsTable
              standings={sortedStandings}
              gameState={gameState}
              onSelectTeam={onSelectTeam}
            />
          )}

          {/* Teams view */}
          {detailView === "teams" && (
            <TeamsGrid
              teamIds={selectedTeamIds}
              gameState={gameState}
              onSelectTeam={onSelectTeam}
            />
          )}

          {/* Players view */}
          {detailView === "players" && (
            <PlayersTable
              players={selectedPlayers}
              gameState={gameState}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

interface ViewButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}

function ViewButton({ icon, label, active, onClick, count }: ViewButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-heading font-bold uppercase tracking-wider transition-all ${
        active
          ? "bg-primary-500 text-white shadow-md shadow-primary-500/20"
          : "bg-white dark:bg-navy-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-navy-600 hover:text-gray-700 dark:hover:text-gray-200"
      }`}
    >
      {icon}
      {label}
      {count !== undefined && (
        <Badge variant={active ? "accent" : "neutral"} size="sm">
          {count}
        </Badge>
      )}
    </button>
  );
}

// ─── Competition Card ───────────────────────────────────────────────────

interface CompetitionCardProps {
  league: LeagueData;
  selected: boolean;
  colorClass: string;
  teamsCount: number;
  onSelect: () => void;
}

function CompetitionCard({
  league,
  selected,
  colorClass,
  teamsCount,
  onSelect,
}: CompetitionCardProps) {
  const { t } = useTranslation();

  const totalMatches = league.fixtures.length;
  const playedMatches = league.fixtures.filter(
    (f) => f.status === "Completed",
  ).length;
  const playoffFixtures = league.fixtures.filter(
    (f) => f.match_type === "Playoffs",
  ).length;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "relative text-left rounded-xl border-2 p-5 transition-all duration-200 hover:shadow-lg",
        selected
          ? "border-primary-500 bg-primary-500/10 shadow-md shadow-primary-500/10"
          : "border-gray-200 dark:border-navy-600 bg-white dark:bg-navy-800 hover:border-primary-400/50",
      ].join(" ")}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass} border`}
          >
            {(() => {
              const iconId = (league.competition_id ?? league.id).replace(/\s+/g, '_');
              return (
                <img
                  src={`/competitions-icons/${iconId}.webp`}
                  alt={league.name}
                  className="w-10 h-10 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              );
            })()}
          </div>
          <div>
            <h4 className="font-heading font-bold text-sm text-gray-800 dark:text-gray-100">
              {league.name}
            </h4>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t("competitions.season", "Temporada")} {league.season}
            </p>
          </div>
        </div>
        {selected && <div className="w-3 h-3 rounded-full bg-primary-500" />}
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <Building2 className="w-3.5 h-3.5" />
          {teamsCount} {t("competitions.teams", "equipos")}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          {totalMatches} {t("competitions.matches", "partidos")}
        </span>
        <span className="flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5" />
          {playedMatches}/{totalMatches}
        </span>
        {playoffFixtures > 0 && (
          <Badge variant="accent" size="sm">
            {t("competitions.playoffs", "Playoffs")}
          </Badge>
        )}
      </div>
    </button>
  );
}

// ─── Standings Table ───────────────────────────────────────────────────

interface StandingsTableProps {
  standings: LeagueData["standings"];
  gameState: GameStateData;
  onSelectTeam?: (id: string) => void;
}

function StandingsTable({ standings, gameState, onSelectTeam }: StandingsTableProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-navy-600 bg-gray-50 dark:bg-navy-800">
                <th className="text-left px-4 py-3 font-heading font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 w-10">
                  #
                </th>
                <th className="text-left px-4 py-3 font-heading font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t("standings.team", "Equipo")}
                </th>
                <th className="text-center px-3 py-3 font-heading font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t("standings.played", "PJ")}
                </th>
                <th className="text-center px-3 py-3 font-heading font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t("standings.won", "G")}
                </th>
                <th className="text-center px-3 py-3 font-heading font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t("standings.lost", "P")}
                </th>
                <th className="text-center px-3 py-3 font-heading font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t("standings.mapsWon", "GM")}
                </th>
                <th className="text-center px-3 py-3 font-heading font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t("standings.mapsLost", "GP")}
                </th>
                <th className="text-center px-3 py-3 font-heading font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t("standings.diff", "D")}
                </th>
                <th className="text-center px-4 py-3 font-heading font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t("standings.points", "Pts")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-600">
              {standings.map((entry, idx) => (
                <tr
                  key={entry.team_id}
                  onClick={() => onSelectTeam?.(entry.team_id)}
                  className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <img
                        src={getTeamLogoPath(gameState.teams, entry.team_id) ?? undefined}
                        alt=""
                        className="w-5 h-5 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm">
                        {gameState.teams.find((t) => t.id === entry.team_id)
                          ?.name ?? entry.team_id}
                      </span>
                    </div>
                  </td>
                  <td className="text-center px-3 py-3 text-gray-600 dark:text-gray-300 font-mono text-xs">
                    {entry.played}
                  </td>
                  <td className="text-center px-3 py-3 text-green-600 dark:text-green-400 font-mono text-xs">
                    {entry.won}
                  </td>
                  <td className="text-center px-3 py-3 text-red-600 dark:text-red-400 font-mono text-xs">
                    {entry.lost}
                  </td>
                  <td className="text-center px-3 py-3 text-gray-600 dark:text-gray-300 font-mono text-xs">
                    {entry.maps_won ?? entry.kills_for ?? 0}
                  </td>
                  <td className="text-center px-3 py-3 text-gray-600 dark:text-gray-300 font-mono text-xs">
                    {entry.maps_lost ?? entry.kills_against ?? 0}
                  </td>
                  <td className="text-center px-3 py-3 font-mono text-xs">
                    <span
                      className={
                        (entry.maps_won ?? entry.kills_for ?? 0) -
                          (entry.maps_lost ?? entry.kills_against ?? 0) >=
                        0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }
                    >
                      {getStandingKillDiff(entry) >= 0 ? "+" : ""}
                      {getStandingKillDiff(entry)}
                    </span>
                  </td>
                  <td className="text-center px-4 py-3">
                    <span className="font-heading font-bold text-sm text-gray-800 dark:text-gray-100">
                      {entry.points}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

// ─── Teams Grid ─────────────────────────────────────────────────────────

interface TeamsGridProps {
  teamIds: string[];
  gameState: GameStateData;
  onSelectTeam?: (id: string) => void;
}

function TeamsGrid({ teamIds, gameState, onSelectTeam }: TeamsGridProps) {
  const { t } = useTranslation();

  const teams = teamIds
    .map((id) => gameState.teams.find((t) => t.id === id)!)
    .filter(Boolean);

  if (teams.length === 0) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            {t("competitions.noTeams", "No hay equipos en esta competición.")}
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {teams.map((team) => (
        <Card key={team.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onSelectTeam?.(team.id)}>
          <CardBody>
            <div className="flex items-center gap-3">
              <img
                src={getTeamLogoPath(gameState.teams, team.id) ?? undefined}
                alt={team.name}
                className="w-10 h-10 object-contain rounded-lg bg-gray-100 dark:bg-navy-700 p-1"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div>
                <h4 className="font-heading font-bold text-sm text-gray-800 dark:text-gray-100">
                  {team.name}
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {team.short_name}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

// ─── Players Table ──────────────────────────────────────────────────────

interface PlayersTableProps {
  players: GameStateData["players"];
  gameState: GameStateData;
}

function PlayersTable({ players, gameState }: PlayersTableProps) {
  const { t } = useTranslation();

  if (players.length === 0) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            {t("competitions.noPlayers", "No hay jugadores en esta competición.")}
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-navy-600 bg-gray-50 dark:bg-navy-800">
                <th className="text-left px-4 py-3 font-heading font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t("players.name", "Nombre")}
                </th>
                <th className="text-left px-4 py-3 font-heading font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t("players.role", "Rol")}
                </th>
                <th className="text-left px-4 py-3 font-heading font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t("players.team", "Equipo")}
                </th>
                <th className="text-center px-4 py-3 font-heading font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t("players.overall", "OVR")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-600">
              {players.slice(0, 100).map((player) => {
                const team = gameState.teams.find(
                  (t) => t.id === player.team_id,
                );
                const overall = player.attributes
                  ? Math.round(
                      (player.attributes.mechanics +
                        player.attributes.laning +
                        player.attributes.teamfighting +
                        player.attributes.macro_play +
                        player.attributes.consistency +
                        player.attributes.shotcalling +
                        player.attributes.champion_pool +
                        player.attributes.discipline +
                        player.attributes.mental_resilience) /
                        9,
                    )
                  : null;

                return (
                  <tr
                    key={player.id}
                    className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <img
                          src={
                            player.profile_image_url ??
                            "/player-photos/default.webp"
                          }
                          alt={player.match_name}
                          className="w-7 h-7 rounded-full object-cover bg-gray-100 dark:bg-navy-700"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                        <div>
                          <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm">
                            {player.match_name}
                          </span>
                          <span className="text-[11px] text-gray-400 block">
                            {player.full_name}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="neutral" size="sm">
                        {player.position}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">
                      {team?.name ?? t("common.freeAgent", "Agente libre")}
                    </td>
                    <td className="text-center px-4 py-2.5">
                      {overall !== null && (
                        <span
                          className={`font-heading font-bold text-sm ${
                            overall >= 80
                              ? "text-green-500"
                              : overall >= 65
                                ? "text-yellow-500"
                                : "text-gray-500"
                          }`}
                        >
                          {overall}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {players.length > 100 && (
            <div className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 text-center border-t border-gray-100 dark:border-navy-600">
              {t("competitions.showingFirst", "Mostrando los primeros 100 de")}{" "}
              {players.length}{" "}
              {t("competitions.players_plural", "jugadores")}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
