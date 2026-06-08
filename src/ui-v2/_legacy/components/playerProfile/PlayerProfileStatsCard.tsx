import { useMemo } from "react";
import type { PlayerSeasonStats } from "@/store/gameStore";
import { Swords, Skull, Handshake, Star, Pickaxe, TrendingUp, Eye, Crosshair } from "lucide-react";

interface Props {
  stats: PlayerSeasonStats;
  t: (key: string, options?: Record<string, string>) => string;
}

export default function PlayerProfileStatsCard({ stats, t }: Props) {
  const games = stats.games_played ?? 0;
  const wins = stats.wins ?? 0;
  const losses = stats.losses ?? 0;
  const kda = useMemo(() => {
    if (games === 0 || (stats.kills ?? 0) === 0) return null;
    const deaths = stats.deaths ?? 0;
    const assists = stats.assists ?? 0;
    const d = deaths || 1;
    return (((stats.kills ?? 0) + assists) / d).toFixed(1);
  }, [stats, games]);

  const items = [
    { icon: Swords, label: t("common.games"), value: String(games) },
    { icon: TrendingUp, label: t("common.wins"), value: String(wins), color: "text-emerald-400" },
    { icon: Crosshair, label: t("common.losses"), value: String(losses), color: "text-red-400" },
    { icon: Star, label: "KDA", value: kda ?? "—" },
    { icon: Pickaxe, label: "CS", value: String(stats.cs ?? 0) },
    { icon: Eye, label: t("common.vision"), value: String(stats.vision_score ?? 0) },
    { icon: Skull, label: t("common.kills"), value: String(stats.kills ?? 0) },
    { icon: Handshake, label: t("common.assists"), value: String(stats.assists ?? 0) },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h4 className="mb-4 font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">
        {t("playerProfile.seasonStats", { defaultValue: "Estadísticas de temporada" })}
      </h4>
      {games === 0 ? (
        <p className="text-sm text-muted-foreground/70 italic">
          {t("playerProfile.noStats", { defaultValue: "Sin partidos jugados esta temporada." })}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {items.map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <Icon className="size-5 shrink-0 text-muted-foreground/70" />
              <div className="min-w-0">
                <p className="text-[11px] font-heading font-bold uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <p className={`font-heading text-lg font-bold tabular-nums ${color ?? "text-foreground"}`}>
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


