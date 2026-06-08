import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Swords } from "lucide-react";
import type { PlayerMatchHistoryEntryData, GameStateData } from "@/store/gameStore";
import { resolveChampionTile } from "@/lib/champions/championImages";
import { formatDateShort } from "@/lib/common/helpers";

interface Props {
  history: PlayerMatchHistoryEntryData[];
  gameState: GameStateData;
  t: (key: string, options?: Record<string, string | number>) => string;
  language: string;
}

export default function PlayerProfileMatchHistoryCard({ history, t, language }: Props) {
  const [collapsed, setCollapsed] = useState(true);

  const sorted = useMemo(
    () => [...history].sort((a, b) => b.date.localeCompare(a.date)),
    [history],
  );

  if (sorted.length === 0) return null;

  const visible = collapsed ? sorted.slice(0, 10) : sorted;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between"
      >
        <h4 className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {t("playerProfile.matchHistory", { defaultValue: "Historial de partidos" })}
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground/70">{sorted.length}</span>
          {collapsed ? <ChevronRight className="size-4 text-muted-foreground/70" /> : <ChevronDown className="size-4 text-muted-foreground/70" />}
        </div>
      </button>

      <div className="mt-4 space-y-1.5">
        {visible.map((entry) => {
          const isWin = entry.result === "Win";
          const championTile = entry.championId ? resolveChampionTile(entry.championId) : null;
          return (
            <div
              key={entry.fixtureId}
              className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/30 px-3 py-2"
            >
              {/* Result badge */}
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-heading font-bold tabular-nums ${
                  isWin
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-red-500/15 text-red-400"
                }`}
              >
                {isWin ? "W" : "L"}
              </span>

              {/* Champion icon */}
              {championTile ? (
                <img src={championTile} alt="" className="size-7 shrink-0 rounded object-cover bg-muted" />
              ) : (
                <Swords className="size-5 shrink-0 text-muted-foreground" />
              )}

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  vs {entry.opponentName}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDateShort(entry.date, language)}
                </p>
              </div>

              {/* KDA */}
              <span className="shrink-0 text-xs tabular-nums text-foreground/70">
                {entry.kills}/{entry.deaths}/{entry.assists}
              </span>
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



