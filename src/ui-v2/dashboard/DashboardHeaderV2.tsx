import { ArrowLeft, Calendar as CalendarIcon, Loader2, Play, Save, Search, Swords } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui-v2/components/ui/button";
import { Separator } from "@/ui-v2/components/ui/separator";

interface Props {
  activeTabLabel: string;
  currentDate: string;
  hasProfileHistory: boolean;
  isAdvancing: boolean;
  isSaving: boolean;
  saveFlash: boolean;
  hasMatchToday: boolean;
  onBack: () => void;
  onSave: () => void;
  onContinue: () => void;
}

export function DashboardHeaderV2({
  activeTabLabel,
  currentDate,
  hasProfileHistory,
  isAdvancing,
  isSaving,
  saveFlash,
  hasMatchToday,
  onBack,
  onSave,
  onContinue,
}: Props) {
  const { t } = useTranslation();

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
      {/* Back button */}
      {hasProfileHistory && (
        <>
          <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back">
            <ArrowLeft className="size-4" />
          </Button>
          <Separator orientation="vertical" className="h-5" />
        </>
      )}

      {/* Active tab label */}
      <h1 className="truncate font-heading text-sm font-bold uppercase tracking-widest text-foreground">
        {activeTabLabel}
      </h1>

      {/* Date */}
      <div className="ml-4 flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1">
        <CalendarIcon className="size-3.5 text-primary" />
        <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
          {currentDate}
        </span>
      </div>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="ghost" size="icon-sm" aria-label="Search">
          <Search className="size-4" />
        </Button>

        <Button variant="outline" size="sm" onClick={onSave} disabled={isSaving} className="h-7 gap-1.5 text-xs">
          {isSaving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          <span>
            {saveFlash
              ? t("dashboard.saved", { defaultValue: "Saved" })
              : t("dashboard.save", { defaultValue: "Save" })}
          </span>
        </Button>

        <Button onClick={onContinue} disabled={isAdvancing} size="sm" className="h-7 gap-1.5 text-xs">
          {isAdvancing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : hasMatchToday ? (
            <Swords className="size-3.5" />
          ) : (
            <Play className="size-3.5" />
          )}
          <span>
            {hasMatchToday
              ? t("continueMenu.goToField", { defaultValue: "Match" })
              : t("dashboard.continue", { defaultValue: "Continue" })}
          </span>
        </Button>
      </div>
    </header>
  );
}
