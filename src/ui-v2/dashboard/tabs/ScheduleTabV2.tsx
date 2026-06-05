import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  ChevronRight,
  Trophy,
} from "lucide-react";

import {
  type FixtureData,
  type GameStateData,
} from "@/store/gameStore";
import { formatMatchDate, getTeamName } from "@/lib/common/helpers";
import { resolveSeasonContext } from "@/lib/season/seasonContext";
import { resolveTeamLogo } from "@/lib/teams/teamLogos";
import {
  buildBestOfContext,
  inferBestOf,
  normalizeLolScore,
  readStoredFixtureDraftResult,
  type StoredFixtureDraftResult,
} from "@/components/schedule/ScheduleTab.helpers";
import DraftResultScreen from "@/components/match/DraftResultScreen";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui-v2/components/ui/card";
import { Badge } from "@/ui-v2/components/ui/badge";
import { Button } from "@/ui-v2/components/ui/button";
import { cn } from "@/ui-v2/lib/utils";

interface Props {
  gameState: GameStateData;
  onSelectTeam: (id: string) => void;
}

type ViewMode = "fixtures";

export function ScheduleTabV2({ gameState, onSelectTeam }: Props) {
  const { t } = useTranslation();
  const [view, setView] = useState<ViewMode>("fixtures");
  const [draftView, setDraftView] = useState<StoredFixtureDraftResult | null>(null);

  const league = gameState.leagues?.[0];
  const userTeamId = gameState.manager.team_id;
  const seasonContext = resolveSeasonContext(gameState);
  const isPreseason = seasonContext.phase === "Preseason";
  const fixtures = league?.fixtures ?? [];
  const bestOfContext = useMemo(() => buildBestOfContext(fixtures), [fixtures]);

  const groupedMatchdays = useMemo(() => {
    const map = new Map<string, FixtureData[]>();
    fixtures.forEach((f) => {
      const key =
        f.match_type === "League"
          ? `league-${f.matchday}`
          : f.match_type === "Playoffs"
            ? `playoffs-${f.matchday}`
            : `${f.match_type}-${f.date}`;
      const list = map.get(key) ?? [];
      list.push(f);
      map.set(key, list);
    });
    return Array.from(map.entries()).sort(
      ([, a], [, b]) =>
        a[0].date.localeCompare(b[0].date) || a[0].matchday - b[0].matchday,
    );
  }, [fixtures]);

  /* standings removed — tab deleted */

  if (draftView) {
    return (
      <DraftResultScreen
        snapshot={draftView.snapshot}
        controlledSide={draftView.controlledSide}
        result={draftView.result}
        seriesGames={draftView.seriesGames}
        seriesLength={draftView.seriesLength}
        seriesGameIndex={draftView.seriesGameIndex}
        userSeriesWins={draftView.userSeriesWins}
        opponentSeriesWins={draftView.opponentSeriesWins}
        onContinue={() => setDraftView(null)}
      />
    );
  }

  if (!league) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="space-y-3 py-12 text-center">
            <Trophy className="mx-auto size-8 text-muted-foreground/40" />
            <p className="font-heading text-sm font-bold uppercase tracking-wider">
              Sin liga activa
            </p>
            <p className="mx-auto max-w-md text-xs text-muted-foreground">
              Este save no tiene liga registrada. Si lo creaste con una versión
              anterior, la migración de 0.3 no se aplicó. Inicia partida nueva
              desde el menú principal y se generarán las ligas automáticamente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeLeague = league;

  function groupLabel(f: FixtureData): string {
    if (f.match_type === "League") {
      return `${t("schedule.matchday", { number: f.matchday, defaultValue: `Jornada ${f.matchday}` })} · ${formatMatchDate(f.date)}`;
    }
    if (f.match_type === "Playoffs") {
      const playoffStart = activeLeague.fixtures
        .filter((c) => c.match_type === "Playoffs")
        .map((c) => c.matchday)
        .reduce((min, v) => Math.min(min, v), Number.POSITIVE_INFINITY);
      const round = Number.isFinite(playoffStart) ? f.matchday - (playoffStart ?? 0) + 1 : f.matchday;
      return `${t("schedule.playoffs", { defaultValue: "Playoffs" })} · ${t("schedule.round", { number: round, defaultValue: `Ronda ${round}` })} · ${formatMatchDate(f.date)}`;
    }
    if (f.match_type === "PreseasonTournament") {
      return `${t("season.preseasonTournament", { defaultValue: "Pretemporada" })} · ${formatMatchDate(f.date)}`;
    }
    return `${t("season.friendly", { defaultValue: "Amistoso" })} · ${formatMatchDate(f.date)}`;
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Header: title + view switcher */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" />
            <span className="font-heading text-base font-bold uppercase tracking-wider">
              {league.name}
            </span>
            <Badge variant="secondary">S{league.season}</Badge>
            {isPreseason && (
              <Badge className="bg-amber-500/15 text-amber-400">Pretemporada</Badge>
            )}
          </div>

          <div className="ml-auto flex gap-1.5">
            <ViewButton active={view === "fixtures"} onClick={() => setView("fixtures")}>
              <CalendarDays className="size-3.5" />
              Partidos
            </ViewButton>

          </div>
        </CardContent>
      </Card>

      {view === "fixtures" && (
        <div className="flex flex-col gap-4 overflow-y-auto">
          {groupedMatchdays.map(([key, fxs]) => (
            <Card key={key}>
              <CardHeader className="bg-muted/30 py-2.5">
                <CardTitle className="font-heading text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {groupLabel(fxs[0])}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/40">
                  {fxs.map((f) => (
                    <FixtureRow
                      key={f.id}
                      fixture={f}
                      bestOf={inferBestOf(f, bestOfContext)}
                      userTeamId={userTeamId}
                      teams={gameState.teams}
                      onSelectTeam={onSelectTeam}
                      onOpenDraft={() => {
                        const stored = readStoredFixtureDraftResult(f.id);
                        if (stored) setDraftView(stored);
                      }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}


    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className="gap-1.5"
    >
      {children}
    </Button>
  );
}

function FixtureRow({
  fixture,
  bestOf,
  userTeamId,
  teams,
  onSelectTeam,
  onOpenDraft,
}: {
  fixture: FixtureData;
  bestOf: 1 | 3 | 5;
  userTeamId: string | null;
  teams: GameStateData["teams"];
  onSelectTeam: (id: string) => void;
  onOpenDraft: () => void;
}) {
  const completed = fixture.status === "Completed";
  const isUserMatch =
    fixture.home_team_id === userTeamId || fixture.away_team_id === userTeamId;
  const stored = readStoredFixtureDraftResult(fixture.id);
  const score = userTeamId ? normalizeLolScore(fixture, stored, userTeamId, bestOf) : null;
  const home = teams.find((t) => t.id === fixture.home_team_id);
  const away = teams.find((t) => t.id === fixture.away_team_id);
  const homeLogo =
    resolveTeamLogo(home?.short_name ?? home?.name, home?.logo_url) ??
    resolveTeamLogo(home?.name, home?.logo_url);
  const awayLogo =
    resolveTeamLogo(away?.short_name ?? away?.name, away?.logo_url) ??
    resolveTeamLogo(away?.name, away?.logo_url);

  const userWon = (() => {
    if (!isUserMatch || !completed || !score) return null;
    const userIsHome = fixture.home_team_id === userTeamId;
    return userIsHome ? score.home > score.away : score.away > score.home;
  })();

  const rowAccent =
    userWon === true
      ? "bg-emerald-500/8"
      : userWon === false
        ? "bg-red-500/8"
        : isUserMatch
          ? "bg-primary/8"
          : "";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition-colors",
        rowAccent || "hover:bg-muted/30",
      )}
    >
      <Badge variant="outline" className="w-12 shrink-0 justify-center text-[10px]">
        BO{bestOf}
      </Badge>

      <button
        type="button"
        onClick={() => onSelectTeam(fixture.home_team_id)}
        className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right text-sm hover:underline"
      >
        <span
          className={cn(
            "truncate font-semibold",
            fixture.home_team_id === userTeamId && "text-primary",
          )}
        >
          {getTeamName(teams, fixture.home_team_id)}
        </span>
        {homeLogo ? (
          <img src={homeLogo} alt="" className="size-6 shrink-0 object-contain" />
        ) : (
          <div className="size-6 shrink-0 rounded-sm bg-muted" />
        )}
      </button>

      <div className="w-20 shrink-0 text-center font-heading text-base font-bold tabular-nums">
        {score ? `${score.home} - ${score.away}` : "VS"}
      </div>

      <button
        type="button"
        onClick={() => onSelectTeam(fixture.away_team_id)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm hover:underline"
      >
        {awayLogo ? (
          <img src={awayLogo} alt="" className="size-6 shrink-0 object-contain" />
        ) : (
          <div className="size-6 shrink-0 rounded-sm bg-muted" />
        )}
        <span
          className={cn(
            "truncate font-semibold",
            fixture.away_team_id === userTeamId && "text-primary",
          )}
        >
          {getTeamName(teams, fixture.away_team_id)}
        </span>
      </button>

      <div className="w-8 shrink-0 text-right">
        {completed && stored ? (
          <button
            type="button"
            onClick={onOpenDraft}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Ver resultado"
          >
            <ChevronRight className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}






