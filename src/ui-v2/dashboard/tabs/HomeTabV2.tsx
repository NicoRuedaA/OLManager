import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  DollarSign,
  Dumbbell,
  Eye,
  Home,
  Mail,
  MapPin,
  Moon,
  Newspaper,
  Swords,
  TrendingUp,
  Trophy,
} from "lucide-react";

import { compareStandingsByLolScore, type GameStateData } from "@/store/gameStore";
import { resolveTeamLogo } from "@/lib/teams/teamLogos";
import {
  getLeagueDigestArticles,
  getNextOpponentWidgetData,
  getRecentResultsForTeam,
} from "@/lib/home/helpers";
import { resolveMessage, resolveNewsArticle } from "@/lib/i18n/backendI18n";
import {
  findNextFixture,
  formatDateShort,
  formatMatchDate,
  getTeamShort,
} from "@/lib/common/helpers";
import { resolvePlayerPhoto } from "@/lib/players/playerPhotos";
import {
  getLineupByRole,
  ROLE_ORDER,
  teamLineupOvr,
} from "@/ui-v2/_legacy/components/NextMatchDisplay";
import { RosterLineupV2 } from "./RosterLineupV2";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui-v2/components/ui/card";
import { Badge } from "@/ui-v2/components/ui/badge";
import { Separator } from "@/ui-v2/components/ui/separator";
import { Button } from "@/ui-v2/components/ui/button";
import { cn } from "@/ui-v2/lib/utils";

function getActiveLeague(gameState: GameStateData) {
  if (!gameState.leagues?.length) return null;
  if (gameState.user_competition_id) {
    return gameState.leagues.find((l) => l.competition_id === gameState.user_competition_id) ?? gameState.leagues[0];
  }
  return gameState.leagues[0];
}

interface Props {
  gameState: GameStateData;
  onNavigate?: (tab: string) => void;
  onSelectPlayer?: (id: string) => void;
}

export function HomeTabV2({ gameState, onNavigate, onSelectPlayer }: Props) {
  const myTeamId = gameState.manager.team_id;
  const myTeam = gameState.teams.find((tm) => tm.id === myTeamId);
  const roster = myTeam
    ? gameState.players.filter((p) => p.team_id === myTeam.id)
    : [];

  const next = useMemo(() => getNextOpponentWidgetData(gameState), [gameState]);

  const results = useMemo(
    () => (myTeamId ? getRecentResultsForTeam(gameState, myTeamId, 5) : []),
    [gameState, myTeamId],
  );

  const sortedStandings = useMemo(() => {
    const l = getActiveLeague(gameState);
    if (!l) return [];
    return [...l.standings].sort(compareStandingsByLolScore);
  }, [gameState.leagues, gameState.user_competition_id]);

  const recentMessages = useMemo(() => {
    return [...(gameState.messages ?? [])]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 4)
      .map(resolveMessage);
  }, [gameState.messages]);

  const newsArticles = useMemo(() => {
    return [...(gameState.news ?? [])]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 4)
      .map(resolveNewsArticle);
  }, [gameState.news]);

  const digestArticles = useMemo(() => getLeagueDigestArticles(gameState), [gameState]);

  // These data sources and the cards below (RecentResultsCard, FinancesCard,
  // MessagesCard, NewsCard) are intentionally retained for upcoming layout work.
  // The `void` references keep them alive so noUnusedLocals doesn't flag them.
  void results;
  void recentMessages;
  void newsArticles;
  void digestArticles;
  void RecentResultsCard;
  void FinancesCard;
  void MessagesCard;
  void NewsCard;

  const cardHover = "h-full hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5";

  return (
    <div className="relative grid auto-rows-min grid-flow-dense gap-3 p-4 sm:gap-4 sm:p-6 lg:grid-cols-4">
      {/* Noise texture background */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      {/* Today phase — full width */}
      <div className="lg:col-span-4 opacity-0 animate-fade-in-up" style={{ animationDelay: "0ms", animationFillMode: "forwards" }}>
        <TodayPhaseCard gameState={gameState} onNavigate={onNavigate} />
      </div>

      {/* Row: Next opponent (left), Standings (right) */}
      <div className="lg:col-span-4 flex gap-4 opacity-0 animate-fade-in-up" style={{ animationDelay: "25ms", animationFillMode: "forwards" }}>
        <div className="flex flex-1 flex-col gap-4 min-w-0">
          <NextOpponentCard gameState={gameState} data={next} onNavigate={onNavigate} />
        </div>
        <div className="w-72 shrink-0 hidden lg:flex lg:flex-col">
          <div className={cn(cardHover, "flex-1")}>
            <FullStandingsCard
              league={getActiveLeague(gameState) ?? undefined}
              standings={sortedStandings}
              teams={gameState.teams}
              myTeamId={myTeamId}
              onNavigate={onNavigate}
            />
          </div>
        </div>
      </div>

      {/* Row: Roster lineup */}
      <div className="lg:col-span-4 opacity-0 animate-fade-in-up" style={{ animationDelay: "50ms", animationFillMode: "forwards" }}>
        <RosterLineupV2
          roster={roster}
          championMasteries={gameState.champion_masteries}
          onNavigate={onNavigate}
          onSelectPlayer={onSelectPlayer}
        />
      </div>


    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────

function NextOpponentCard({
  gameState,
  data,
  onNavigate,
}: {
  gameState: GameStateData;
  data: ReturnType<typeof getNextOpponentWidgetData>;
  onNavigate?: (tab: string) => void;
}) {
  const { t } = useTranslation();
  const userTeamId = gameState.manager.team_id;
  const league = useMemo(() => {
    if (!gameState.leagues?.length) return null;
    if (gameState.user_competition_id) {
      return gameState.leagues.find((l) => l.competition_id === gameState.user_competition_id) ?? gameState.leagues[0];
    }
    return gameState.leagues[0];
  }, [gameState.leagues, gameState.user_competition_id]);

  const nextFixture = userTeamId && league
    ? findNextFixture(league.fixtures, userTeamId)
    : null;

  if (!data || !nextFixture || !userTeamId) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>{t("home.nextOpponent.title", { defaultValue: "Próximo partido" })}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-2 py-8">
          <CalendarDays className="size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {t("home.nextOpponent.none", { defaultValue: "No hay partidos programados." })}
          </p>
          <button
            type="button"
            onClick={() => onNavigate?.("Competitions")}
            className="text-xs text-primary hover:underline"
          >
            Ver competiciones
          </button>
        </CardContent>
      </Card>
    );
  }

  const logo =
    resolveTeamLogo(data.opponent.short_name ?? data.opponent.name, data.opponent.logo_url) ??
    resolveTeamLogo(data.opponent.name, data.opponent.logo_url);
  const myTeam = gameState.teams.find((tm) => tm.id === userTeamId);
  const myLogo =
    resolveTeamLogo(myTeam?.short_name ?? myTeam?.name, myTeam?.logo_url) ??
    resolveTeamLogo(myTeam?.name, myTeam?.logo_url);

  const homeLineup = getLineupByRole(gameState, nextFixture.home_team_id);
  const awayLineup = getLineupByRole(gameState, nextFixture.away_team_id);
  const homeOvr = teamLineupOvr(homeLineup);
  const awayOvr = teamLineupOvr(awayLineup);
  const totalOvr = Math.max(1, homeOvr + awayOvr);
  const homePct = (homeOvr / totalOvr) * 100;
  const awayPct = 100 - homePct;
  const fixtureLabel =
    nextFixture.match_type === "League"
      ? t("home.matchdayN", { n: nextFixture.matchday, defaultValue: `Jornada ${nextFixture.matchday}` })
      : nextFixture.match_type === "PreseasonTournament"
        ? t("season.preseasonTournament", { defaultValue: "Pretemporada" })
        : t("season.friendly", { defaultValue: "Amistoso" });

  const homeShort = getTeamShort(gameState.teams, nextFixture.home_team_id);
  const awayShort = getTeamShort(gameState.teams, nextFixture.away_team_id);
  const homeLogo = data.isHome ? myLogo : logo;
  const awayLogo = data.isHome ? logo : myLogo;

  return (
    <Card className="relative h-full overflow-hidden">
      {/* Accent stripe with opponent color */}
      <div
        className="absolute left-0 top-0 h-full w-1"
        style={{ backgroundColor: data.opponent.colors?.primary ?? "var(--color-border)" }}
      />
      <CardHeader className="flex-row items-center justify-between space-y-0 pl-5">
        <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
          Próximo partido
        </CardTitle>
        <Badge variant="outline" className="gap-1">
          {data.isHome ? <Home className="size-3" /> : <MapPin className="size-3" />}
          {data.isHome ? "Local" : "Visitante"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Matchup hero */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex items-center gap-3">
            {homeLogo ? (
              <img src={homeLogo} alt={homeShort} className="size-14 shrink-0 object-contain" />
            ) : (
              <div className="size-14 shrink-0 rounded-md bg-muted" />
            )}
            <div className="min-w-0">
              <div className="truncate font-heading text-xl font-bold">{homeShort}</div>
              <div className="text-xs text-muted-foreground">
                {data.isHome ? "Tu equipo" : data.fixture.match_type}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <Badge variant="secondary">{fixtureLabel}</Badge>
            <span className="text-xs text-muted-foreground">{formatMatchDate(nextFixture.date)}</span>
          </div>

          <div className="flex items-center justify-end gap-3 text-right">
            <div className="min-w-0">
              <div className="truncate font-heading text-xl font-bold">{awayShort}</div>
              <div className="text-xs text-muted-foreground">
                {!data.isHome ? "Tu equipo" : data.opponent.name}
              </div>
            </div>
            {awayLogo ? (
              <img src={awayLogo} alt={awayShort} className="size-14 shrink-0 object-contain" />
            ) : (
              <div className="size-14 shrink-0 rounded-md bg-muted" />
            )}
          </div>
        </div>

        {/* Strength bar */}
        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
          <div className="bg-emerald-500" style={{ width: `${homePct}%` }} />
          <div className="bg-red-500" style={{ width: `${awayPct}%` }} />
        </div>

        <Separator />

        {/* Lineups by role */}
        <div className="space-y-2">
          {ROLE_ORDER.map((role, i) => {
            const home = homeLineup[i];
            const away = awayLineup[i];
            const homePhoto = home ? resolvePlayerPhoto(home.id, home.match_name, home.profile_image_url) : null;
            const awayPhoto = away ? resolvePlayerPhoto(away.id, away.match_name, away.profile_image_url) : null;
            return (
              <div
                key={role}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {homePhoto ? (
                    <img
                      src={homePhoto}
                      alt=""
                      className="size-6 shrink-0 rounded-full border border-border object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="size-6 shrink-0 rounded-full bg-muted" />
                  )}
                  <span className="truncate font-medium">
                    {home?.match_name ?? "—"}
                  </span>
                </div>

                <div className="px-2 text-center font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
                  {role}
                </div>

                <div className="flex min-w-0 items-center justify-end gap-2">
                  <span className="truncate font-medium">
                    {away?.match_name ?? "—"}
                  </span>
                  {awayPhoto ? (
                    <img
                      src={awayPhoto}
                      alt=""
                      className="size-6 shrink-0 rounded-full border border-border object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="size-6 shrink-0 rounded-full bg-muted" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Footer: form + cta */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              Forma del rival
            </div>
            <div className="flex gap-1.5">
              {data.recentForm.length > 0 ? (
                data.recentForm.map((r, i) => <FormPill key={i} result={r} />)
              ) : (
                <span className="text-xs text-muted-foreground/60">Sin historial</span>
              )}
            </div>
          </div>

          <Button onClick={() => onNavigate?.("Schedule")} className="gap-1.5">
            <CalendarDays className="size-4" />
            Calendario
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FormPill({ result }: { result: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    W: { label: "W", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    L: { label: "L", cls: "bg-red-500/20 text-red-400 border-red-500/30" },
    D: { label: "D", cls: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30" },
  };
  const m = map[result] ?? map.D;
  return (
    <span
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md border text-xs font-bold",
        m.cls,
      )}
    >
      {m.label}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────

function resolveCompetitionLogo(league: GameStateData["leagues"][number] | undefined): string | null {
  if (!league) return null;
  if (league.logo) return league.logo;
  const id = league.id.toLowerCase();
  const name = league.name.toLowerCase();
  if (id.includes("lec") || name.includes("lec")) return "/lec-logo.svg";
  return null;
}

interface FullStanding {
  team_id: string;
  points: number;
  played: number;
  won?: number;
  lost?: number;
  maps_won?: number;
  maps_lost?: number;
}

function FullStandingsCard({
  league,
  standings,
  teams,
  myTeamId,
  onNavigate,
}: {
  league: GameStateData["leagues"][number] | undefined;
  standings: FullStanding[];
  teams: GameStateData["teams"];
  myTeamId: string | null;
  onNavigate?: (tab: string) => void;
}) {
  const compLogo = resolveCompetitionLogo(league);
  return (
    <Card className="h-full justify-center overflow-hidden">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-3">
          {compLogo ? (
            <img src={compLogo} alt={league?.name ?? "Competition"} className="size-10 shrink-0 object-contain" />
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
              <TrendingUp className="size-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Clasificación
            </div>
            <div className="truncate font-heading text-base font-bold uppercase tracking-wider">
              {league?.name ?? "—"}
              {league?.season ? <span className="ml-1 text-muted-foreground">· S{league.season}</span> : null}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {standings.length === 0 ? (
          <p className="flex flex-col items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
            <TrendingUp className="size-8 text-muted-foreground/30" />
            <span>Pretemporada.</span>
          </p>
        ) : (
          <table className="w-full">
            <thead className="bg-muted/30 text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="w-8 px-2 py-2 text-right">#</th>
                <th className="px-2 py-2 text-left">Equipo</th>
                <th className="w-12 px-2 py-2 text-center">G</th>
                <th className="w-12 px-3 py-2 text-center">P</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => {
                const s = standings[i];
                if (!s) {
                  return (
                    <tr key={`empty-${i}`} className="border-b border-border/30 last:border-0">
                      <td className="px-2 py-2.5 text-right font-heading text-sm text-muted-foreground tabular-nums">
                        {i + 1}
                      </td>
                      <td className="px-2 py-2.5 text-sm text-muted-foreground/40">—</td>
                      <td className="px-2 py-2.5 text-center text-muted-foreground/40">—</td>
                      <td className="px-3 py-2.5 text-center text-muted-foreground/40">—</td>
                    </tr>
                  );
                }
                const team = teams.find((tm) => tm.id === s.team_id);
                const isMe = s.team_id === myTeamId;
                const teamName = team?.short_name ?? team?.name ?? s.team_id;
                const logo =
                  resolveTeamLogo(team?.short_name ?? team?.name, team?.logo_url) ??
                  resolveTeamLogo(team?.name, team?.logo_url);
                return (
                  <tr
                    key={s.team_id}
                    onClick={() => team && onNavigate?.("Teams")}
                    className={cn(
                      "border-b border-border/30 last:border-0 transition-colors",
                      isMe ? "bg-primary/10 text-primary" : "hover:bg-muted/40",
                      team && "cursor-pointer",
                    )}
                  >
                    <td className="px-2 py-2.5 text-right font-heading text-sm text-muted-foreground tabular-nums">
                      {i + 1}
                    </td>
                    <td className="min-w-0 px-2 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {logo ? (
                          <img src={logo} alt="" className="size-6 shrink-0 object-contain" />
                        ) : (
                          <div className="size-6 shrink-0 rounded-sm bg-muted" />
                        )}
                        <span className={cn(
                          "truncate text-sm font-medium",
                          isMe && "font-bold",
                        )}>
                          {teamName}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center font-heading text-base font-semibold tabular-nums text-emerald-400">
                      {s.won ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center font-heading text-base font-semibold tabular-nums text-red-400">
                      {s.lost ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────

function RecentResultsCard({
  results,
  teams,
}: {
  results: ReturnType<typeof getRecentResultsForTeam>;
  teams: GameStateData["teams"];
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
          Resultados recientes
        </CardTitle>
        <TrendingUp className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {results.length === 0 ? (
          <p className="flex flex-col items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
            <TrendingUp className="size-8 text-muted-foreground/30" />
            <span>Sin partidos jugados aún.</span>
          </p>
        ) : (
          <ul className="divide-y divide-border/40">
            {results.map((r, i) => {
              const opp = teams.find((tm) => tm.id === r.opponentId);
              return (
                <li
                  key={`${r.fixture.id ?? i}`}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FormPill result={r.resultCode} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {opp?.name ?? r.opponentId}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.isHome ? "Casa" : "Fuera"} · {r.fixture.match_type}
                      </div>
                    </div>
                  </div>
                  <div className="font-heading text-base tabular-nums">
                    {r.myGoals}–{r.opponentGoals}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────

function formatCompactCurrency(value: number): string {
  const sign = value >= 0 ? "+" : "−";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}€${(abs / 1_000).toFixed(0)}K`;
  return `${sign}€${Math.round(abs)}`;
}

function formatBalance(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(1)}K`;
  return `€${Math.round(value)}`;
}

function FinancesCard({
  team,
  onNavigate,
}: {
  team: GameStateData["teams"][number];
  onNavigate?: (tab: string) => void;
}) {
  const monthlyNet = team.season_income - team.season_expenses;
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
          <DollarSign className="mr-1 inline size-4" />
          Finanzas
        </CardTitle>
        <button
          type="button"
          onClick={() => onNavigate?.("Finances")}
          className="text-xs text-primary hover:underline"
        >
          Detalle
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Balance</div>
          <div className="font-heading text-3xl font-bold tabular-nums">
            {formatBalance(team.finance)}
          </div>
        </div>

        {/* Budget usage bar */}
        {team.wage_budget > 0 && (
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="uppercase tracking-wider text-muted-foreground">Presupuesto salarial</span>
              <span className="tabular-nums text-muted-foreground/70">
                {((team.season_expenses / team.wage_budget) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  team.season_expenses > team.wage_budget
                    ? "bg-destructive"
                    : team.season_expenses > team.wage_budget * 0.85
                      ? "bg-amber-500"
                      : "bg-emerald-500",
                )}
                style={{
                  width: `${Math.min(100, (team.season_expenses / team.wage_budget) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        <Separator />
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Ingresos</div>
            <div className="text-emerald-400 tabular-nums">
              {formatCompactCurrency(team.season_income)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Gastos</div>
            <div className="text-red-400 tabular-nums">
              {formatCompactCurrency(-team.season_expenses)}
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Neto temporada</div>
            <div
              className={cn(
                "font-heading text-lg tabular-nums",
                monthlyNet >= 0 ? "text-emerald-400" : "text-red-400",
              )}
            >
              {formatCompactCurrency(monthlyNet)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────

function MessagesCard({
  messages,
  lang,
  onNavigate,
}: {
  messages: GameStateData["messages"];
  lang: string;
  onNavigate?: (tab: string, ctx?: { messageId?: string }) => void;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
          <Mail className="mr-1 inline size-4" />
          Mensajes
        </CardTitle>
        <button
          type="button"
          onClick={() => onNavigate?.("Inbox")}
          className="text-xs text-primary hover:underline"
        >
          Inbox
        </button>
      </CardHeader>
      <CardContent className="p-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
            <Mail className="size-8 text-muted-foreground/30" />
            <span>Sin mensajes recientes.</span>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {messages.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onNavigate?.("Inbox", { messageId: m.id })}
                  className={cn(
                    "flex w-full items-start gap-3 border-l-4 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                    m.read ? "border-l-transparent" : "border-l-primary",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg font-heading text-sm font-bold",
                      m.read
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/15 text-primary",
                    )}
                  >
                    {m.sender.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "truncate text-sm font-semibold",
                          m.read ? "text-muted-foreground" : "text-foreground",
                        )}
                      >
                        {m.subject}
                      </div>
                      {m.priority === "high" && (
                        <span className="shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-[9px] font-heading font-bold uppercase tracking-wider text-destructive">
                          Urgente
                        </span>
                      )}
                    </div>
                    <div
                      className={cn(
                        "truncate text-xs",
                        m.read ? "text-muted-foreground/70" : "text-muted-foreground",
                      )}
                    >
                      {m.body}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                    {formatDateShort(m.date, lang)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {messages.length > 0 && (
          <div className="border-t border-border/40 px-4 py-2 text-center">
            <button
              type="button"
              onClick={() => onNavigate?.("Inbox")}
              className="text-xs font-heading font-bold uppercase tracking-wider text-primary hover:underline"
            >
              Ver todos ({messages.length})
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────

function NewsCard({
  articles,
  lang,
  onNavigate,
}: {
  articles: GameStateData["news"];
  lang: string;
  onNavigate?: (tab: string) => void;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
          <Newspaper className="mr-1 inline size-4" />
          Noticias
        </CardTitle>
        <button
          type="button"
          onClick={() => onNavigate?.("News")}
          className="text-xs text-primary hover:underline"
        >
          Ver todas
        </button>
      </CardHeader>
      <CardContent className="p-0">
        {articles.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
            <Newspaper className="size-8 text-muted-foreground/30" />
            <span>No hay noticias todavía.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/40">
            {articles.slice(0, 4).map((a, i) => (
              <div
                key={a.id}
                className={cn(
                  "px-5 py-4",
                  i % 2 !== 0 && "sm:border-l-0",
                  i >= 2 && "border-t border-border/40 sm:border-t",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium leading-snug">{a.headline}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{a.source}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatDateShort(a.date, lang)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────

const NewDayIcon = (_props: { className?: string }) => (
  <img src="/ui-icons/newday.webp" alt="" className="size-full object-cover" />
);

const PHASE_META: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    title: string;
    description: string;
    accent: string;
    actionLabel: string;
    actionTab: string;
  }
> = {
  Morning: {
    icon: NewDayIcon,
    label: "Mañana",
    title: "Arranque del día",
    description: "Revisa el inbox, la plantilla y planifica el día.",
    accent: "text-amber-400",
    actionLabel: "Calendario",
    actionTab: "Schedule",
  },
  ScrimBlock: {
    icon: Swords,
    label: "Bloque de scrims",
    title: "Sesión de práctica",
    description: "El equipo está jugando scrims contra un rival.",
    accent: "text-primary",
    actionLabel: "Scrims",
    actionTab: "Scrims",
  },
  ReviewBlock: {
    icon: Eye,
    label: "Revisión",
    title: "Análisis post-scrim",
    description: "Toca decidir cómo continuar tras la sesión.",
    accent: "text-sky-400",
    actionLabel: "Scrims",
    actionTab: "Scrims",
  },
  TrainingBlock: {
    icon: Dumbbell,
    label: "Entrenamiento",
    title: "Foco de entrenamiento",
    description: "Sin scrim bloqueado: aprovecha para entrenar y recuperar.",
    accent: "text-emerald-400",
    actionLabel: "Entrenamiento",
    actionTab: "Training",
  },
  Evening: {
    icon: Moon,
    label: "Tarde-Noche",
    title: "Fin del día",
    description: "El equipo se recupera. Continúa para avanzar al día siguiente.",
    accent: "text-indigo-400",
    actionLabel: "Calendario",
    actionTab: "Schedule",
  },
};

function TodayPhaseCard({
  gameState,
  onNavigate,
}: {
  gameState: GameStateData;
  onNavigate?: (tab: string) => void;
}) {
  const teamId = gameState.manager.team_id;
  const league = getActiveLeague(gameState);
  const todayKey = String(gameState.clock.current_date).slice(0, 10);

  const todayFixture =
    league && teamId
      ? league.fixtures.find(
          (f) =>
            (f.home_team_id === teamId || f.away_team_id === teamId) &&
            String(f.date).slice(0, 10) === todayKey,
        ) ?? null
      : null;

  // Match day overrides phase meta
  if (todayFixture) {
    return (
      <Card className="overflow-hidden border-primary/30">
        <CardContent className="flex items-center gap-4 py-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Trophy className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <CalendarDays className="size-3" />
              Hoy
            </div>
            <div className="font-heading text-lg font-bold">Día de partido</div>
            <div className="truncate text-sm text-muted-foreground">
              {todayFixture.match_type}
            </div>
          </div>
          <Button onClick={() => onNavigate?.("Schedule")} className="gap-1.5">
            <Eye className="size-4" />
            Ver
          </Button>
        </CardContent>
      </Card>
    );
  }

  const phase = gameState.day_phase ?? "Morning";
  const meta = PHASE_META[phase];
  const Icon = meta.icon;

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-4 py-3">
        <div className={cn(
          "flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted",
          meta.accent,
        )}>
          <Icon className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <CalendarDays className="size-3" />
            Hoy
          </div>
          <div className="font-heading text-lg font-bold">{meta.title}</div>
          <div className="truncate text-sm text-muted-foreground">{meta.description}</div>
          <div className={cn(
            "mt-1 font-heading text-[10px] font-bold uppercase tracking-widest",
            meta.accent,
          )}>
            Fase actual · {meta.label}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}






