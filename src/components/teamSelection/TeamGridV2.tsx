import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Landmark, Loader2, Star, Trophy, Users } from "lucide-react";
import type { TeamSummary } from "@/store/gameStore";
import { Badge } from "@/ui-v2/components/ui/badge";
import { formatFinance, getReputationLabel, getTeamLogoPath } from "./teamSelection.helpers";

interface TeamGridV2Props {
  leagueName: string;
  teams: TeamSummary[];
  onSelectTeam: (id: string) => void;
  onBack: () => void;
  selectedTeamId: string | null;
  onConfirm: () => void;
  isConfirming: boolean;
}

export function TeamGridV2({
  leagueName,
  teams,
  onSelectTeam,
  onBack,
  selectedTeamId,
  onConfirm,
  isConfirming,
}: TeamGridV2Props) {
  const { t } = useTranslation();
  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="font-heading text-sm font-bold uppercase tracking-widest text-foreground">
              {leagueName}
            </h1>
            <p className="text-[10px] text-muted-foreground">
              {t("teamSelect.subtitle", "Select your team")}
            </p>
          </div>
        </div>

        {selectedTeam && (
          <button
            type="button"
            disabled={isConfirming}
            onClick={onConfirm}
            className="flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {isConfirming ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trophy className="size-3.5" />
            )}
            <span>{t("teamSelect.confirm", "Confirm")}</span>
          </button>
        )}
      </header>

      {/* Team grid */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-v2">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-2">
          {teams.map((team) => {
            const isSelected = team.id === selectedTeamId;
            const rep = getReputationLabel(team.reputation ?? 0);
            const logo = getTeamLogoPath(team.id, team.logo_url);

            return (
              <button
                key={team.id}
                type="button"
                onClick={() => onSelectTeam(team.id)}
                className={`
                  group relative rounded-xl border-2 p-4 text-left transition-all
                  ${isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/50 hover:bg-muted/20"
                  }
                `}
              >
                {/* Team header */}
                <div className="flex items-start gap-4">
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border bg-muted">
                    {logo && (
                      <img src={logo} alt={team.name} className="size-10 object-contain" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="flex items-center gap-2 truncate font-heading text-sm font-bold uppercase tracking-wide text-foreground">
                      {team.name}
                      {isSelected && (
                        <Badge variant="default" className="text-[9px]">
                          {t("teamSelect.selected", "Selected")}
                        </Badge>
                      )}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {team.short_name} · {team.country}
                    </p>
                  </div>

                  {/* OVR badge */}
                  {team.ovr != null && (
                    <div className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1.5 text-center">
                      <p className="font-heading text-lg font-bold text-primary tabular-nums">
                        {team.ovr}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-primary/70">
                        OVR
                      </p>
                    </div>
                  )}
                </div>

                {/* Stats row */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-md bg-muted/50 px-2.5 py-1.5 text-center">
                    <Users className="mx-auto mb-0.5 size-3.5 text-muted-foreground" />
                    <p className="font-heading text-xs font-bold tabular-nums text-foreground">
                      {team.player_count ?? "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {t("teamSelect.players", "Players")}
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/50 px-2.5 py-1.5 text-center">
                    <Star className="mx-auto mb-0.5 size-3.5 text-muted-foreground" />
                    <p className="font-heading text-xs font-bold text-foreground">{team.short_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {t("teamSelect.team", "Team")}
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/50 px-2.5 py-1.5 text-center">
                    <Landmark className="mx-auto mb-0.5 size-3.5 text-muted-foreground" />
                    <p className="font-heading text-xs font-bold tabular-nums text-emerald-400">
                      {formatFinance(team.finance ?? 0)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {t("teamSelect.budget", "Budget")}
                    </p>
                  </div>
                </div>

                {/* Reputation */}
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant={rep.variant} className="text-[10px]">
                    {rep.label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {t("teamSelect.reputation", "Reputation")}: {team.reputation}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
