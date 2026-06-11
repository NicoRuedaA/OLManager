import { useTranslation } from "react-i18next";
import { Globe, Trophy } from "lucide-react";

import type { GameStateData } from "@/store/gameStore";
import { compareStandingsByLolScore, getStandingKillDiff } from "@/store/gameStore";
import { getTeamLogoPath } from "@/lib/schedule/helpers";
import { cn } from "@/ui-v2/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui-v2/components/ui/card";

interface Props {
  gameState: GameStateData;
}

export function InternationalTabV2({ gameState }: Props) {
  const { t } = useTranslation();

  const intlLeagues = gameState.leagues.filter(
    (l) => l.league_kind === "International"
  );

  if (intlLeagues.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-muted-foreground">
        <Globe className="size-16" />
        <p className="text-lg">{t("dashboard.noInternationalTournaments")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6 scrollbar-v2">
      {intlLeagues.map((league) => (
        <Card key={league.id} className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-xl uppercase tracking-wide">
              <Trophy className="size-5 text-orange-500" />
              {league.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <h3 className="mb-2 font-heading text-sm uppercase tracking-wider text-muted-foreground">
                {t("dashboard.standings")}
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">{t("dashboard.team")}</th>
                    <th className="p-2 text-center">{t("dashboard.played")}</th>
                    <th className="p-2 text-center">{t("dashboard.won")}</th>
                    <th className="p-2 text-center">{t("dashboard.lost")}</th>
                    <th className="p-2 text-center">{t("dashboard.points")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...league.standings]
                    .sort(compareStandingsByLolScore)
                    .map((s, i) => {
                      const team = gameState.teams.find(
                        (t) => t.id === s.team_id
                      );
                      return (
                        <tr
                          key={s.team_id}
                          className={cn(
                            "border-b transition-colors",
                            i < 4 && "bg-orange-500/5"
                          )}
                        >
                          <td className="p-2 font-medium">{i + 1}</td>
                          <td className="flex items-center gap-2 p-2">
                            {team && (
                              <img
                                src={getTeamLogoPath(team.id)}
                                alt=""
                                className="size-5 rounded object-contain"
                              />
                            )}
                            <span>{team?.name ?? s.team_id}</span>
                          </td>
                          <td className="p-2 text-center">{s.played}</td>
                          <td className="p-2 text-center">{s.won}</td>
                          <td className="p-2 text-center">{s.lost}</td>
                          <td className="p-2 text-center font-bold">{s.points}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="mb-2 font-heading text-sm uppercase tracking-wider text-muted-foreground">
                {t("dashboard.fixtures")}
              </h3>
              <div className="space-y-1">
                {league.fixtures
                  .filter((f) => f.status === "Completed" || f.status === "Scheduled")
                  .slice(-10)
                  .map((f) => {
                    const home = gameState.teams.find(
                      (t) => t.id === f.home_team_id
                    );
                    const away = gameState.teams.find(
                      (t) => t.id === f.away_team_id
                    );
                    const completed = f.status === "Completed";
                    return (
                      <div
                        key={f.id}
                        className="flex items-center gap-2 rounded px-2 py-1 text-xs transition-colors hover:bg-muted"
                      >
                        <span className="w-24 truncate text-right font-medium">
                          {home?.name ?? f.home_team_id}
                        </span>
                        <span className="w-16 text-center font-mono">
                          {completed
                            ? `${f.result?.home_wins ?? "-"} - ${f.result?.away_wins ?? "-"}`
                            : "vs"}
                        </span>
                        <span className="w-24 truncate font-medium">
                          {away?.name ?? f.away_team_id}
                        </span>
                        <span className="ml-auto text-muted-foreground">
                          {f.date}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
