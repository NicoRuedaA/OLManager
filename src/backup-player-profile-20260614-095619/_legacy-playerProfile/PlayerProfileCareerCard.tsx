import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { CareerEntry, GameStateData } from "@/store/gameStore";

interface Props {
  career: CareerEntry[];
  gameState: GameStateData;
  t: (key: string, options?: Record<string, string | number>) => string;
}

export default function PlayerProfileCareerCard({ career, gameState, t }: Props) {
  const [collapsed, setCollapsed] = useState(true);

  const sorted = useMemo(
    () => [...career].sort((a, b) => b.season - a.season),
    [career],
  );

  if (sorted.length === 0) return null;

  const visible = collapsed ? sorted.slice(0, 3) : sorted;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between"
      >
        <h4 className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {t("playerProfile.career", { defaultValue: "Historial de carrera" })}
        </h4>
        {collapsed ? <ChevronRight className="size-4 text-muted-foreground/70" /> : <ChevronDown className="size-4 text-muted-foreground/70" />}
      </button>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] font-heading font-bold uppercase tracking-wider text-muted-foreground">
              <th className="pb-2 pr-3">{t("common.season")}</th>
              <th className="pb-2 pr-3">{t("common.team")}</th>
              <th className="pb-2 pr-3 text-center">{t("common.appearances", { defaultValue: "PJ" })}</th>
              <th className="pb-2 pr-3 text-center">{t("common.kills")}</th>
              <th className="pb-2 pr-3 text-center">{t("common.assists")}</th>
              <th className="pb-2 text-center">{t("common.rating")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {visible.map((entry, idx) => {
              const team = gameState.teams.find((t) => t.id === entry.team_id);
              return (
                <tr key={`${entry.season}-${entry.team_id}-${idx}`} className="text-sm text-foreground/80">
                  <td className="py-2.5 pr-3 font-heading tabular-nums">{entry.season}</td>
                  <td className="py-2.5 pr-3">{team?.name ?? entry.team_name}</td>
                  <td className="py-2.5 pr-3 text-center tabular-nums">{entry.appearances}</td>
                  <td className="py-2.5 pr-3 text-center tabular-nums">{entry.kills}</td>
                  <td className="py-2.5 pr-3 text-center tabular-nums">{entry.assists}</td>
                  <td className="py-2.5 text-center tabular-nums">
                    <span className="font-heading font-bold">{entry.avg_rating.toFixed(1)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {collapsed && sorted.length > 3 && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="mt-3 text-xs font-heading font-bold uppercase tracking-wider text-primary hover:text-primary transition-colors"
        >
          {t("common.showMore", { defaultValue: "Ver más ({count})", count: sorted.length - 3 })}
        </button>
      )}
    </div>
  );
}


