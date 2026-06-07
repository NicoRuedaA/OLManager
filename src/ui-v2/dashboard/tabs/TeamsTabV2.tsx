import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Trophy } from "lucide-react";

import type { GameStateData } from "@/store/gameStore";
import { compareStandingsByLolScore } from "@/store/gameStore";
import { getMainTeams } from "@/store/academySelectors";
import { calculateLolOvr } from "@/lib/players/lolPlayerStats";
import { formatVal } from "@/lib/common/helpers";
import { resolveTeamLogo } from "@/lib/teams/teamLogos";
import { CardContent } from "@/ui-v2/components/ui/card";
import { Badge } from "@/ui-v2/components/ui/badge";

interface TeamsTabV2Props {
  gameState: GameStateData;
  onSelectTeam: (id: string) => void;
}

export function TeamsTabV2({ gameState, onSelectTeam }: TeamsTabV2Props) {
  const { t } = useTranslation();
  const userTeamId = gameState.manager.team_id;
  const [competitionFilter, setCompetitionFilter] = useState<string | null>(null);

  const allStandings = gameState.leagues?.[0]?.standings
    ? [...gameState.leagues[0].standings].sort(compareStandingsByLolScore)
    : [];

  const leagues = useMemo(
    () =>
      gameState.leagues.map((l) => ({
        id: l.id,
        name: l.name,
      })),
    [gameState.leagues],
  );

  const teamsData = useMemo(() => {
    const mainTeams = getMainTeams(gameState.teams);
    const filtered = competitionFilter
      ? mainTeams.filter((team) => team.competition_id === competitionFilter)
      : mainTeams;

    return filtered
      .map((team) => {
        const roster = gameState.players.filter((p) => p.team_id === team.id);
        const avgOvr =
          roster.length > 0
            ? Math.round(roster.reduce((s, p) => s + calculateLolOvr(p), 0) / roster.length)
            : 0;
        const totalValue = roster.reduce((s, p) => s + p.market_value, 0);
        const leaguePos = allStandings.findIndex((s) => s.team_id === team.id) + 1;
        const standing = allStandings.find((s) => s.team_id === team.id);
        return { team, roster, avgOvr, totalValue, leaguePos, standing };
      })
      .sort((a, b) => a.leaguePos - b.leaguePos);
  }, [gameState.teams, gameState.players, allStandings, competitionFilter]);

  const activeLeagueName = competitionFilter
    ? leagues.find((l) => l.id === competitionFilter)?.name ?? competitionFilter
    : null;

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <select
          value={competitionFilter ?? ""}
          onChange={(e) => setCompetitionFilter(e.target.value || null)}
          className="h-8 rounded-md border border-border bg-muted/30 px-2.5 text-xs text-foreground outline-none"
        >
          <option value="">{t("common.all")}</option>
          {leagues.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {activeLeagueName
            ? t("teams.nTeamsInLeague", {
                league: activeLeagueName,
                count: teamsData.length,
              })
            : t("teams.nTeams", { count: teamsData.length })}
        </p>
      </div>

      {/* Team cards grid */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        {teamsData.map(({ team, roster, avgOvr, totalValue, leaguePos, standing }) => {
          const isUser = team.id === userTeamId;
          const wr =
            standing && standing.played > 0
              ? Math.round((standing.won / standing.played) * 100)
              : null;
          const logo = resolveTeamLogo(team.name, team.logo_url);

          return (
            <button
              key={team.id}
              type="button"
              onClick={() => onSelectTeam(team.id)}
              className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:bg-muted/50"
            >
              {/* Header with team color gradient */}
              <div
                className="flex items-center gap-4 p-4"
                style={{
                  background: `linear-gradient(135deg, ${team.colors.primary}, ${team.colors.secondary}40)`,
                }}
              >
                <div
                  className="flex size-14 shrink-0 items-center justify-center rounded-xl border-2 border-white/30"
                  style={{ backgroundColor: team.colors.primary }}
                >
                  {logo && (
                    <img
                      src={logo}
                      alt={`${team.name} logo`}
                      className="size-10 object-contain"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="flex items-center gap-2 truncate font-heading text-lg font-bold uppercase tracking-wide text-white drop-shadow">
                    {team.name}
                    {isUser && (
                      <Badge variant="secondary" className="text-[10px]">
                        {t("teams.yourTeam")}
                      </Badge>
                    )}
                  </h3>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-white/70">
                    <span>{t(`countries.${team.country}`, team.country)}</span>
                    {team.city && (
                      <>
                        <span>·</span>
                        <span>{team.city}</span>
                      </>
                    )}
                  </p>
                </div>
                {leaguePos > 0 && (
                  <div className="rounded-lg bg-black/20 px-3 py-1.5 text-center backdrop-blur">
                    <p className="font-heading text-[10px] uppercase tracking-wider text-white/60">
                      {t("common.position")}
                    </p>
                    <p className="font-heading text-xl font-bold text-white">
                      #{leaguePos}
                    </p>
                  </div>
                )}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-5 gap-px bg-border">
                <StatCell label={t("teams.squad")} value={String(roster.length)} />
                <StatCell label={t("teams.avgOvr")} value={String(avgOvr)} />
                <StatCell
                  label={t("teams.rep")}
                  value={String(team.reputation)}
                />
                <StatCell
                  label={t("common.value")}
                  value={formatVal(totalValue)}
                />
                <StatCell
                  label={t("common.pts")}
                  value={standing ? String(standing.points) : "—"}
                />
              </div>

              {/* Bottom info */}
              <CardContent className="flex flex-1 items-center gap-4 py-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="size-3.5" />
                  {t("teams.hq")} {team.city}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Trophy className="size-3.5" />
                  {t("teams.est")} {team.founded_year}
                </div>
                {standing && (
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {standing.won}W {standing.lost}L
                    {wr !== null && ` · ${t("teams.winRateShort")} ${wr}%`}
                  </span>
                )}
              </CardContent>
            </button>
          );
        })}

        {teamsData.length === 0 && (
          <div className="col-span-full flex items-center justify-center py-16">
            <p className="font-heading text-sm uppercase tracking-wider text-muted-foreground">
              {t("teams.noTeams")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-2 py-2.5 text-center">
      <p className="font-heading text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-heading text-sm font-bold text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}
