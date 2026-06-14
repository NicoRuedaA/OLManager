import { useMemo } from "react";
import type { PlayerMatchHistoryEntryData, GameStateData } from "@/store/gameStore";
import { asset } from "@/lib/asset";
import { formatDateShort } from "@/lib/common/helpers";
import { getTeamLogoPath } from "@/lib/schedule/helpers";
import ProfileCardShell from "@/ui-v2/pages/ProfileCardShell";

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
  const sorted = useMemo(
    () => [...history].sort((a, b) => b.date.localeCompare(a.date)),
    [history],
  );

  if (sorted.length === 0) {
    return (
      <ProfileCardShell title={t("playerProfile.seasonStats", { defaultValue: "Estadísticas de la temporada" })}>
        <p className="text-sm text-muted-foreground/70 italic">
          {t("playerProfile.noMatchesThisSeason", { defaultValue: "No matches played this season" })}
        </p>
      </ProfileCardShell>
    );
  }

  const wins = sorted.filter((e) => e.result === "Win").length;
  const losses = sorted.length - wins;
  const winRate = ((wins / sorted.length) * 100).toFixed(0);

  return (
    <ProfileCardShell title={t("playerProfile.seasonStats", { defaultValue: "Estadísticas de la temporada" })}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-1.5 text-xs tabular-nums">
          <span className="font-semibold text-emerald-400">{wins}W</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="font-semibold text-red-400">{losses}L</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-muted-foreground/70">{winRate}%</span>
        </div>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-muted mb-4">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${(wins / sorted.length) * 100}%` }}
          />
        </div>

        <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border/40 text-[10px] font-heading font-bold uppercase tracking-wider text-muted-foreground/60">
              <th className="px-2 py-1.5 w-10 text-center"></th>
              <th className="px-2 py-1.5 w-8"></th>
              <th className="px-2 py-1.5 w-8"></th>
              <th className="px-2 py-1.5">{t("common.date", { defaultValue: "Date" })}</th>
              <th className="px-2 py-1.5">{t("common.duration", { defaultValue: "Duration" })}</th>
              <th className="px-2 py-1.5 text-right">{t("common.cs", { defaultValue: "CS" })}</th>
              <th className="px-2 py-1.5 text-right">CS/m</th>
              <th className="px-2 py-1.5 text-right text-emerald-400/80">{t("common.kills", { defaultValue: "K" })}</th>
              <th className="px-2 py-1.5 text-right text-red-400/80">{t("common.deaths", { defaultValue: "D" })}</th>
              <th className="px-2 py-1.5 text-right text-sky-400/80">{t("common.assists", { defaultValue: "A" })}</th>
              <th className="px-2 py-1.5 text-right">{t("common.kda", { defaultValue: "KDA" })}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry) => {
              const isWin = entry.result === "Win";
              const championTile = entry.championId ? asset(`/champion-tiles/${entry.championId}.webp`, "champion") : null;
              const ratio = kdaRatio(entry.kills, entry.deaths, entry.assists);
              const ratioNum = entry.deaths === 0 ? 99 : (entry.kills + entry.assists) / entry.deaths;
              const ratioColor =
                ratioNum >= 5 ? "text-emerald-400" :
                ratioNum >= 3 ? "text-cyan-300" :
                ratioNum >= 1.5 ? "text-yellow-300" :
                "text-red-400";
              return (
                <tr
                  key={entry.fixtureId}
                  className="border-b border-border/20 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-2 py-2 text-center">
                    <span
                      className={`inline-flex size-7 items-center justify-center rounded-md text-[11px] font-heading font-bold tabular-nums ${
                        isWin
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {isWin ? "W" : "L"}
                    </span>
                  </td>

                  <td className="px-2 py-2">
                    <div className="size-7 overflow-hidden rounded object-cover bg-muted">
                      {championTile ? (
                        <img src={championTile} alt="" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center text-[9px] font-bold text-muted-foreground">
                          ?
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-2 py-2">
                    <div className="size-7 overflow-hidden rounded object-cover bg-muted">
                      <img
                        src={getTeamLogoPath(gameState.teams, entry.opponentTeamId) ?? ""}
                        alt=""
                        className="size-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  </td>

                  <td className="px-2 py-2 text-muted-foreground tabular-nums whitespace-nowrap">
                    {formatDateShort(entry.date, language)}
                  </td>

                  <td className="px-2 py-2 text-muted-foreground/70 tabular-nums whitespace-nowrap">
                    {formatDuration(entry.gameDurationSeconds)}
                  </td>

                  <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">
                    {entry.cs}
                  </td>

                  <td className="px-2 py-2 text-right text-muted-foreground/70 tabular-nums whitespace-nowrap">
                    {csPerMin(entry.cs, entry.gameDurationSeconds)}
                  </td>

                  <td className="px-2 py-2 text-right text-emerald-400 font-medium tabular-nums">
                    {entry.kills}
                  </td>

                  <td className="px-2 py-2 text-right text-red-400 font-medium tabular-nums">
                    {entry.deaths}
                  </td>

                  <td className="px-2 py-2 text-right text-sky-400 font-medium tabular-nums">
                    {entry.assists}
                  </td>

                  <td className={`px-2 py-2 text-right text-[11px] font-semibold tabular-nums whitespace-nowrap ${ratioColor}`}>
                    {ratio}:1
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ProfileCardShell>
  );
}
