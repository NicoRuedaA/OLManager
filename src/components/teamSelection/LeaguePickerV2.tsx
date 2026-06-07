import { useTranslation } from "react-i18next";
import { ArrowLeft, Globe, Users } from "lucide-react";
import type { CompetitionSummary } from "@/store/gameStore";

interface LeaguePickerV2Props {
  competitions: CompetitionSummary[];
  onSelect: (id: string) => void;
  onBack: () => void;
}

export function LeaguePickerV2({ competitions, onSelect, onBack }: LeaguePickerV2Props) {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
        <button
          type="button"
          onClick={onBack}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 className="font-heading text-sm font-bold uppercase tracking-widest text-foreground">
            {t("teamSelect.selectLeague", "Select League")}
          </h1>
          <p className="text-[10px] text-muted-foreground">
            {t("teamSelect.selectLeagueSubtitle", "Choose a competition to get started")}
          </p>
        </div>
      </header>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-v2">
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-2">
          {competitions.map((comp) => (
            <button
              key={comp.id}
              type="button"
              onClick={() => onSelect(comp.id)}
              className="group rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/50 hover:bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                  {comp.logo ? (
                    <img src={comp.logo} alt={comp.name} className="size-8 object-contain" />
                  ) : (
                    <Globe className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-heading text-sm font-bold uppercase tracking-wide text-foreground">
                    {comp.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">{comp.region}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="size-3.5" />
                <span>
                  {comp.team_count} {t("teamSelect.teams", "teams")}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
