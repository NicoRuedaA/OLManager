import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Dumbbell,
  DollarSign,
  Eye,
  Heart,
  Home,
  Mail,
  MapPin,
  Moon,
  Newspaper,
  ShieldAlert,
  Star,
  Sun,
  Swords,
  TrendingUp,
  Trophy,
} from "lucide-react";

import { compareStandingsByLolScore, type GameStateData } from "@/store/gameStore";
import { resolveTeamLogo } from "@/lib/teamLogos";
import {
  getHomeRosterOverview,
  getLeagueDigestArticles,
  getNextOpponentWidgetData,
  getRecentResultsForTeam,
} from "@/components/home/HomeTab.helpers";
import { resolveMessage, resolveNewsArticle } from "@/utils/backendI18n";
import {
  findNextFixture,
  formatDateShort,
  formatMatchDate,
  getTeamShort,
} from "@/lib/helpers";
import { calculateLolOvr } from "@/lib/lolPlayerStats";
import {
  daysUntil,
  getLineupByRole,
  playerPhotoUrl,
  ROLE_ORDER,
  teamLineupOvr,
} from "@/components/NextMatchDisplay";
import { RosterLineupV2 } from "./RosterLineupV2";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui-v2/components/ui/card";
import { Badge } from "@/ui-v2/components/ui/badge";
import { Separator } from "@/ui-v2/components/ui/separator";
import { Button } from "@/ui-v2/components/ui/button";
import { cn } from "@/ui-v2/lib/utils";

interface Props {
  gameState: GameStateData;
  onNavigate?: (tab: string) => void;
}

export function HomeTabV2({ gameState, onNavigate }: Props) {
  const { i18n } = useTranslation();
  const myTeamId = gameState.manager.team_id;
  const myTeam = gameState.teams.find((tm) => tm.id === myTeamId);
  const roster = myTeam
    ? gameState.players.filter((p) => p.team_id === myTeam.id)
    : [];

  const next = useMemo(() => getNextOpponentWidgetData(gameState), [gameState]);
  const overview = useMemo(() => getHomeRosterOverview(roster), [roster]);
  const results = useMemo(
    () => (myTeamId ? getRecentResultsForTeam(gameState, myTeamId, 5) : []),
    [gameState, myTeamId],
  );

  const sortedStandings = useMemo(() => {
    if (!gameState.league) return [];
    return [...gameState.league.standings].sort(compareStandingsByLolScore);
  }, [gameState.league]);

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

  return (
    <div className="grid auto-rows-min grid-flow-dense gap-4 p-6 lg:grid-cols-4">
      {/* Row 0: today's phase — full width */}
      <div className="lg:col-span-4">
        <TodayPhaseCard gameState={gameState} onNavigate={onNavigate} />
      </div>

      {/* Row 1: hero (3 cols) + standings starts (col 4, spans 2 rows) */}
      <div className="lg:col-span-3">
        <NextOpponentCard gameState={gameState} data={next} onNavigate={onNavigate} />
      </div>
      <div className="lg:col-span-1 lg:row-span-2">
        <FullStandingsCard
          league={gameState.league}
          standings={sortedStandings}
          teams={gameState.teams}
          myTeamId={myTeamId}
          onNavigate={onNavigate}
        />
      </div>

      {/* Row 2: roster (3 cols) — standings still spanning */}
      <div className="lg:col-span-3">
        <RosterLineupV2
          roster={roster}
          championMasteries={gameState.champion_masteries}
          onNavigate={onNavigate}
        />
      </div>

      {/* Row 3+: standings has ended, content uses all 4 cols */}
      <div className="lg:col-span-2">
        <WeekScheduleCard gameState={gameState} onNavigate={onNavigate} />
      </div>
      <div className="lg:col-span-2">
        <KpiGroup overview={overview} squadSize={roster.length} />
      </div>

      {/* Row 4+: standings has ended, content flows full 4-col width */}
      {myTeam && (
        <div className="lg:col-span-2">
          <FinancesCard team={myTeam} onNavigate={onNavigate} />
        </div>
      )}
      <div className="lg:col-span-2">
        <MessagesCard
          messages={recentMessages}
          lang={i18n.language}
          onNavigate={onNavigate}
        />
      </div>

      <div className="lg:col-span-2">
        <RecentResultsCard results={results} teams={gameState.teams} />
      </div>
      <div className="lg:col-span-2">
        <UnavailableCard
          players={overview.unavailablePlayers}
          onNavigate={onNavigate}
        />
      </div>

      <div className="lg:col-span-4">
        <NewsCard
          articles={newsArticles.length > 0 ? newsArticles : digestArticles}
          lang={i18n.language}
          onNavigate={onNavigate}
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
  const league = gameState.league;

  const nextFixture = userTeamId && league
    ? findNextFixture(league.fixtures, userTeamId)
    : null;

  if (!data || !nextFixture || !userTeamId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("home.nextOpponent.title", { defaultValue: "Próximo partido" })}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("home.nextOpponent.none", { defaultValue: "No hay partidos programados." })}
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
  const countdown = daysUntil(nextFixture.date);

  const fixtureLabel =
    nextFixture.competition === "League"
      ? t("home.matchdayN", { n: nextFixture.matchday, defaultValue: `Jornada ${nextFixture.matchday}` })
      : nextFixture.competition === "PreseasonTournament"
        ? t("season.preseasonTournament", { defaultValue: "Pretemporada" })
        : t("season.friendly", { defaultValue: "Amistoso" });

  const homeShort = getTeamShort(gameState.teams, nextFixture.home_team_id);
  const awayShort = getTeamShort(gameState.teams, nextFixture.away_team_id);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0">
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
            {myLogo ? (
              <img src={myLogo} alt={myTeam?.name ?? ""} className="size-14 shrink-0 object-contain" />
            ) : (
              <div className="size-14 shrink-0 rounded-md bg-muted" />
            )}
            <div className="min-w-0">
              <div className="truncate font-heading text-xl font-bold">{homeShort}</div>
              <div className="text-xs text-muted-foreground">
                {data.isHome ? "Tu equipo" : data.fixture.competition}
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
            {logo ? (
              <img src={logo} alt={data.opponent.name} className="size-14 shrink-0 object-contain" />
            ) : (
              <div className="size-14 shrink-0 rounded-md bg-muted" />
            )}
          </div>
        </div>

        {/* Strength bar */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <span className="font-heading text-sm font-bold text-emerald-400 tabular-nums">
            {homeOvr.toFixed(1)}
          </span>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            <div className="bg-emerald-500" style={{ width: `${homePct}%` }} />
            <div className="bg-red-500" style={{ width: `${awayPct}%` }} />
          </div>
          <span className="font-heading text-sm font-bold text-red-400 tabular-nums">
            {awayOvr.toFixed(1)}
          </span>
        </div>

        <Separator />

        {/* Lineups by role */}
        <div className="space-y-2">
          {ROLE_ORDER.map((role, i) => {
            const home = homeLineup[i];
            const away = awayLineup[i];
            const homeOvrVal = home ? calculateLolOvr(home) : null;
            const awayOvrVal = away ? calculateLolOvr(away) : null;
            const homePhoto = home ? playerPhotoUrl(home.id) : null;
            const awayPhoto = away ? playerPhotoUrl(away.id) : null;
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
                  {homeOvrVal !== null && (
                    <span className="font-heading font-bold text-emerald-400 tabular-nums">
                      {homeOvrVal}
                    </span>
                  )}
                </div>

                <div className="px-2 text-center font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t(`tactics.lol.roles.${role}`, { defaultValue: role })}
                </div>

                <div className="flex min-w-0 items-center justify-end gap-2">
                  {awayOvrVal !== null && (
                    <span className="font-heading font-bold text-red-400 tabular-nums">
                      {awayOvrVal}
                    </span>
                  )}
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

        {/* Footer: form + countdown + cta */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              Forma del rival
            </div>
            <div className="flex gap-1.5">
              {data.recentForm.length > 0 ? (
                data.recentForm.map((r, i) => <FormPill key={i} result={r} />)
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-right">
              <div className="font-heading text-xl font-bold tabular-nums leading-none">
                {countdown}d
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                Días
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNavigate?.("Schedule")}>
              Calendario <ArrowRight className="size-3" />
            </Button>
          </div>
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

function KpiGroup({
  overview,
  squadSize,
}: {
  overview: ReturnType<typeof getHomeRosterOverview>;
  squadSize: number;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
          Equipo
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <Kpi icon={<Star className="size-4" />} label="OVR medio" value={overview.avgOvr || "—"} />
        <Kpi icon={<Heart className="size-4" />} label="Condición" value={`${overview.avgCondition}%`} />
        <Kpi
          icon={<ShieldAlert className="size-4" />}
          label="Lesionados"
          value={overview.unavailablePlayers.length}
          danger={overview.unavailablePlayers.length > 0}
        />
        <Kpi icon={<Activity className="size-4" />} label="Plantilla" value={squadSize} />
      </CardContent>
    </Card>
  );
}

function Kpi({
  icon,
  label,
  value,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "font-heading text-2xl font-bold tabular-nums",
          danger && "text-destructive",
        )}
      >
        {value}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────

function resolveCompetitionLogo(league: GameStateData["league"]): string | null {
  if (!league) return null;
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
  league: GameStateData["league"];
  standings: FullStanding[];
  teams: GameStateData["teams"];
  myTeamId: string | null;
  onNavigate?: (tab: string) => void;
}) {
  const compLogo = resolveCompetitionLogo(league);
  return (
    <Card className="h-full overflow-hidden">
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
          <p className="px-6 py-4 text-sm text-muted-foreground">Pretemporada.</p>
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
              {standings.map((s, i) => {
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
          <p className="text-sm text-muted-foreground">Sin partidos jugados aún.</p>
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
                        {r.isHome ? "Casa" : "Fuera"} · {r.fixture.competition}
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
          <p className="px-6 py-4 text-sm text-muted-foreground">Sin mensajes recientes.</p>
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
                    <div
                      className={cn(
                        "truncate text-sm font-semibold",
                        m.read ? "text-muted-foreground" : "text-foreground",
                      )}
                    >
                      {m.subject}
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
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────

function WeekScheduleCard({
  gameState,
  onNavigate,
}: {
  gameState: GameStateData;
  onNavigate?: (tab: string) => void;
}) {
  const { i18n } = useTranslation();
  const league = gameState.league;
  const teamId = gameState.manager.team_id;

  const todayKey = String(gameState.clock.current_date).slice(0, 10);
  const todayParts = todayKey.split("-").map(Number);
  const today = new Date(todayParts[0], (todayParts[1] || 1) - 1, todayParts[2] || 1);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const fixture =
      league && teamId
        ? league.fixtures.find(
            (f) =>
              (f.home_team_id === teamId || f.away_team_id === teamId) &&
              String(f.date).slice(0, 10) === dKey,
          ) ?? null
        : null;
    const label = new Intl.DateTimeFormat(i18n.language, { weekday: "short" })
      .format(d)
      .replace(".", "")
      .toUpperCase();
    return { date: d, label, isToday: dKey === todayKey, fixture };
  });

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
          Esta semana
        </CardTitle>
        <button
          type="button"
          onClick={() => onNavigate?.("Schedule")}
          className="text-xs text-primary hover:underline"
        >
          Calendario
        </button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1.5">
          {week.map((d) => {
            const isMatch = !!d.fixture;
            const opponentId =
              d.fixture &&
              (d.fixture.home_team_id === teamId
                ? d.fixture.away_team_id
                : d.fixture.home_team_id);
            const opp = opponentId
              ? gameState.teams.find((t) => t.id === opponentId)
              : null;
            const oppLogo = opp
              ? resolveTeamLogo(opp.short_name ?? opp.name, opp.logo_url) ??
                resolveTeamLogo(opp.name, opp.logo_url)
              : null;
            return (
              <div
                key={d.date.toISOString()}
                className={cn(
                  "rounded-md border p-2 text-center transition-colors",
                  d.isToday
                    ? "border-primary/60 bg-primary/10"
                    : "border-border bg-card/60",
                  isMatch && "border-primary/40",
                )}
              >
                <div className="font-heading text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {d.label}
                </div>
                <div
                  className={cn(
                    "mt-1 font-heading text-base font-bold tabular-nums",
                    d.isToday && "text-primary",
                  )}
                >
                  {d.date.getDate()}
                </div>
                <div className="mt-2 flex h-7 items-center justify-center">
                  {isMatch ? (
                    oppLogo ? (
                      <img src={oppLogo} alt="" className="size-7 object-contain" />
                    ) : (
                      <span className="font-heading text-[10px] font-bold text-primary">
                        PARTIDO
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                      ·
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
          <p className="px-6 py-4 text-sm text-muted-foreground">No hay noticias todavía.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {articles.map((a) => (
              <li key={a.id} className="px-6 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-sm font-medium leading-snug">{a.headline}</div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateShort(a.date, lang)}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{a.source}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────

function UnavailableCard({
  players,
  onNavigate,
}: {
  players: GameStateData["players"];
  onNavigate?: (tab: string) => void;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
          <ShieldAlert className="mr-1 inline size-4" />
          Bajas
        </CardTitle>
        <button
          type="button"
          onClick={() => onNavigate?.("Squad")}
          className="text-xs text-primary hover:underline"
        >
          Plantilla
        </button>
      </CardHeader>
      <CardContent>
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin bajas.</p>
        ) : (
          <ul className="space-y-2">
            {players.slice(0, 5).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{p.full_name}</span>
                <Badge variant="outline" className="shrink-0 border-destructive/40 text-destructive">
                  {p.injury?.days_remaining ?? "?"}d
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────

const PHASE_META: Record<
  NonNullable<GameStateData["day_phase"]>,
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
    icon: Sun,
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
  const league = gameState.league;
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
              {todayFixture.competition}
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
          "flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted",
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
        <Button
          variant="default"
          onClick={() => onNavigate?.(meta.actionTab)}
          className="gap-1.5"
        >
          <Icon className="size-4" />
          {meta.actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
