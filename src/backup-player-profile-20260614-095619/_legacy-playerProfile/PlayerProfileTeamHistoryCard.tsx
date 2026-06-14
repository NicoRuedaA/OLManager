import { useMemo } from "react";
import type { CareerEntry, GameStateData } from "@/store/gameStore";
import { getTeamLogoPath } from "@/lib/schedule/helpers";
import ProfileCardShell from "@/ui-v2/pages/ProfileCardShell";

interface Props {
  gameState: GameStateData;
  t: (key: string, options?: Record<string, string | number>) => string;
  career?: CareerEntry[];
  currentTeamName?: string | null;
}

export default function PlayerProfileTeamHistoryCard({ gameState, t, career, currentTeamName }: Props) {
  const sorted = useMemo(
    () => [...(career ?? [])].sort((a, b) => b.season - a.season || b.split_index - a.split_index),
    [career],
  );

  return (
    <ProfileCardShell title={t("playerProfile.teamHistory", { defaultValue: "Historial de equipos" })}>
        {sorted.length === 0 ? (
        currentTeamName ? (
          <p className="mt-4 text-sm text-foreground/80">
            {t("playerProfile.currentTeam", { defaultValue: "Current team: {{team}}", team: currentTeamName })}
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground/70 italic">
            {t("playerProfile.noCareer", { defaultValue: "Sin historial de equipos" })}
          </p>
        )
      ) : (
        <div className="mt-4 space-y-3">
          {sorted.map((entry, idx) => {
            const team = gameState.teams.find((t) => t.id === entry.team_id);
            const logoUrl = entry.team_id ? getTeamLogoPath(gameState.teams, entry.team_id) : null;
            return (
              <div
                key={`${entry.season}-${entry.split_index}-${entry.team_id}-${idx}`}
                className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/30 px-3 py-2"
              >
                {/* Team logo */}
                <div className="size-8 shrink-0 overflow-hidden rounded object-cover bg-muted">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="size-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="flex size-full items-center justify-center text-[9px] font-bold text-muted-foreground">?</div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {team?.name ?? entry.team_name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("common.season", { n: entry.season })} · {entry.split_name || t("common.split", { defaultValue: `Split ${entry.split_index + 1}` })}
                  </p>
                </div>

                {/* Stats */}
                {entry.appearances > 0 ? (
                  <div className="shrink-0 text-right">
                    <p className="text-xs tabular-nums text-muted-foreground/70">
                      {entry.appearances} {t("common.apps", { defaultValue: "apps" })} · {entry.kills}/{entry.assists}
                    </p>
                    <p className="text-[11px] tabular-nums font-semibold text-foreground/80">
                      {entry.avg_rating.toFixed(1)} {t("common.rating")}
                    </p>
                  </div>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground/50 italic">
                    {t("playerProfile.noApps", { defaultValue: "sin apps" })}
                  </span>
                )}
              </div>
            );
          })}
          </div>
        )}
    </ProfileCardShell>
  );
}
