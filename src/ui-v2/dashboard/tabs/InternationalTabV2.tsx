import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Trophy, Swords, UsersRound, CalendarDays } from "lucide-react";

import type { GameStateData, LeagueData, StandingData, FixtureData } from "@/store/gameStore";
import { cn } from "@/ui-v2/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui-v2/components/ui/card";

interface Props {
  gameState: GameStateData;
}

function tournamentFormatInfo(name: string): { label: string; stages: string; teams: string } {
  const n = name.toLowerCase();
  if (n.includes("first stand")) {
    return {
      label: "Groups → Single Elim",
      stages: "1 Group (Bo3) → Top 4 Knockout (Bo5)",
      teams: "5 regions · 1 seed each",
    };
  }
  if (n.includes("msi")) {
    return {
      label: "Double Elimination",
      stages: "8 teams · Upper/Lower Bracket (Bo5)",
      teams: "5 regions · Top 2 seeds each",
    };
  }
  if (n.includes("worlds")) {
    return {
      label: "Swiss → Single Elim",
      stages: "16 teams Swiss (Bo1/Bo3) → Top 8 Knockout (Bo5)",
      teams: "5 regions · 3-4 seeds each",
    };
  }
  return { label: "", stages: "", teams: "" };
}

function dateRange(fixtures: FixtureData[]): string {
  if (fixtures.length === 0) return "";
  const dates = fixtures.map((f) => f.date).filter(Boolean).sort();
  return dates.length > 0 ? `${dates[0]} → ${dates[dates.length - 1]}` : "";
}

export function InternationalTabV2({ gameState }: Props) {
  const { t } = useTranslation();

  const intlLeagues = useMemo(
    () => gameState.leagues.filter((l) => l.league_kind === "International"),
    [gameState.leagues]
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
      {[...intlLeagues].reverse().map((league: LeagueData) => {
        const info = tournamentFormatInfo(league.name);
        return (
          <Card key={league.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-xl uppercase tracking-wide">
                <Trophy className="size-5 text-orange-500" />
                {league.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 text-xs">
                <span className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 font-medium">
                  <Swords className="size-3.5" />
                  {info.label}
                </span>
                <span className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 font-medium">
                  <UsersRound className="size-3.5" />
                  {info.teams}
                </span>
                <span className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 font-medium">
                  <CalendarDays className="size-3.5" />
                  {dateRange(league.fixtures)}
                </span>
              </div>

              <p className="text-xs text-muted-foreground">{info.stages}</p>

              <div>
                <h3 className="mb-2 font-heading text-xs uppercase tracking-wider text-muted-foreground">
                  {t("dashboard.participants")}
                </h3>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4">
                  {league.standings.map((s: StandingData) => (
                    <div
                      key={s.team_id}
                      className="rounded-md border bg-card px-3 py-2 text-xs font-medium"
                    >
                      {s.team_id}
                    </div>
                  ))}
                </div>
              </div>

              {league.fixtures.some((f: FixtureData) => f.status === "Completed") && (
                <div>
                  <h3 className="mb-2 font-heading text-xs uppercase tracking-wider text-muted-foreground">
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
                        .sort((a: StandingData, b: StandingData) => b.points - a.points || ((b.maps_won ?? 0) - (b.maps_lost ?? 0)) - ((a.maps_won ?? 0) - (a.maps_lost ?? 0)))
                        .map((s: StandingData, i: number) => (
                          <tr key={s.team_id} className={cn("border-b transition-colors", i < 4 && "bg-orange-500/5")}>
                            <td className="p-2 font-medium">{i + 1}</td>
                            <td className="p-2">{s.team_id}</td>
                            <td className="p-2 text-center">{s.played}</td>
                            <td className="p-2 text-center">{s.won}</td>
                            <td className="p-2 text-center">{s.lost}</td>
                            <td className="p-2 text-center font-bold">{s.points}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {league.fixtures.some((f: FixtureData) => f.status === "Completed") && (
                <div>
                  <h3 className="mb-2 font-heading text-xs uppercase tracking-wider text-muted-foreground">
                    {t("dashboard.fixtures")}
                  </h3>
                  <div className="space-y-1">
                    {league.fixtures
                      .filter((f: FixtureData) => f.status === "Completed")
                      .slice(-10)
                      .map((f: FixtureData) => (
                        <div key={f.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs transition-colors hover:bg-muted">
                          <span className="w-24 truncate text-right font-medium">{f.home_team_id}</span>
                          <span className="w-16 text-center font-mono">
                            {f.result ? `${f.result.home_wins} - ${f.result.away_wins}` : "-"}
                          </span>
                          <span className="w-24 truncate font-medium">{f.away_team_id}</span>
                          <span className="ml-auto text-muted-foreground">{f.date}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
