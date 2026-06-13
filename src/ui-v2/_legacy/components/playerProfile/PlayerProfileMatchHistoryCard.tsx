import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { PlayerMatchHistoryEntryData, GameStateData } from "@/store/gameStore";
import { resolveChampionTile } from "@/lib/champions/championImages";
import { formatDateShort } from "@/lib/common/helpers";
import { getTeamLogoPath } from "@/lib/schedule/helpers";

interface Props {
  history: PlayerMatchHistoryEntryData[];
  gameState: GameStateData;
  t: (key: string, options?: Record<string, string | number>) => string;
  language: string;
}

function kdaRatio(kills: number, deaths: number, assists: number): string {
  if (deaths === 0) return "∞";
  return ((kills + assists) / deaths).toFixed(1);
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m${s}s`;
}

function csPerMin(cs: number, seconds: number): string {
  if (seconds <= 0) return "0.0";
  return (cs / (seconds / 60)).toFixed(1);
}

export default function PlayerProfileMatchHistoryCard({ history, gameState, t, language }: Props) {
  const [collapsed, setCollapsed] = useState(true);

  const sorted = useMemo(
    () => [...history].sort((a, b) => b.date.localeCompare(a.date)),
    [history],
  );

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col h-full rounded-xl border border-border bg-card p-5">
        <h4 className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {t("playerProfile.seasonStats", { defaultValue: "Estadísticas de la temporada" })}
        </h4>
        <p className="mt-4 text-sm text-muted-foreground/70 italic">
          {t("playerProfile.noMatchesThisSeason", { defaultValue: "No matches played this season" })}
        </p>
      </div>
    );
  }

  const wins = sorted.filter((e) => e.result === "Win").length;
  const losses = sorted.length - wins;
  const winRate = ((wins / sorted.length) * 100).toFixed(0);

  const visible = collapsed ? sorted.slice(0, 10) : sorted;

  return (
    <div className="flex flex-col h-full rounded-xl border border-border bg-card p-5">
      <h4 className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">
        {t("playerProfile.seasonStats", { defaultValue: "Estadísticas de la temporada" })}
      </h4>

      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="mt-1 flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-1.5 text-xs tabular-nums">
          <span className="font-semibold text-emerald-400">{wins}W</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="font-semibold text-red-400">{losses}L</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-muted-foreground/70">{winRate}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground/70">{sorted.length}</span>
          {collapsed ? <ChevronRight className="size-4 text-muted-foreground/70" /> : <ChevronDown className="size-4 text-muted-foreground/70" />}
        </div>
      </button>

      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${(wins / sorted.length) * 100}%` }}
        />
      </div>

      <div className="mt-4 space-y-1.5">
        {visible.map((entry) => {
          const isWin = entry.result === "Win";
          const championTile = entry.championId ? resolveChampionTile(entry.championId) : null;
          const ratio = kdaRatio(entry.kills, entry.deaths, entry.assists);
          const ratioNum = entry.deaths === 0 ? 99 : (entry.kills + entry.assists) / entry.deaths;
          const ratioColor =
            ratioNum >= 5 ? "text-emerald-400" :
            ratioNum >= 3 ? "text-cyan-300" :
            ratioNum >= 1.5 ? "text-yellow-300" :
            "text-red-400";
          return (
            <div
              key={entry.fixtureId}
              className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/30 px-3 py-2"
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-heading font-bold tabular-nums ${
                  isWin
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-red-500/15 text-red-400"
                }`}
              >
                {isWin ? "W" : "L"}
              </span>

              <div className="size-7 shrink-0 overflow-hidden rounded object-cover bg-muted">
                {championTile ? (
                  <img src={championTile} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-[9px] font-bold text-muted-foreground">
                    ?
                  </div>
                )}
              </div>

              <div className="size-7 shrink-0 overflow-hidden rounded object-cover bg-muted">
                <img
                  src={getTeamLogoPath(gameState.teams, entry.opponentTeamId) ?? ""}
                  alt=""
                  className="size-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-muted-foreground">
                  {formatDateShort(entry.date, language)} · {formatDuration(entry.gameDurationSeconds)}
                </p>
              </div>

              <div className="hidden sm:block shrink-0 text-right">
                <p className="text-[11px] tabular-nums text-muted-foreground/70">
                  {csPerMin(entry.cs, entry.gameDurationSeconds)} CS/m
                </p>
                <p className="text-[10px] tabular-nums text-muted-foreground/50">{entry.cs} CS</p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-xs tabular-nums whitespace-nowrap">
                  <span className="text-emerald-400 font-medium">{entry.kills}</span>
                  <span className="text-muted-foreground/50"> / </span>
                  <span className="text-red-400 font-medium">{entry.deaths}</span>
                  <span className="text-muted-foreground/50"> / </span>
                  <span className="text-sky-400 font-medium">{entry.assists}</span>
                </p>
                <p className={`text-[11px] tabular-nums font-semibold ${ratioColor}`}>
                  {ratio}:1 KDA
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {collapsed && sorted.length > 10 && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="mt-3 text-xs font-heading font-bold uppercase tracking-wider text-primary hover:text-primary transition-colors"
        >
          {t("common.showMore", { defaultValue: "Ver más ({count})", count: sorted.length - 10 })}
        </button>
      )}
    </div>
  );
}
