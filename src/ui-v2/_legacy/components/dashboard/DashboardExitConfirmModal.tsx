import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { LogOut, Save, X } from "lucide-react";

interface DashboardExitConfirmModalProps {
  onCancel: () => void;
  onConfirm: () => void;
  onExitWithoutSave?: () => void;
}

export default function DashboardExitConfirmModal({
  onCancel,
  onConfirm,
  onExitWithoutSave,
}: DashboardExitConfirmModalProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h3 className="font-heading text-lg font-bold uppercase tracking-wide text-foreground">
            {t("exitConfirm.title")}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("exitConfirm.message")}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-heading font-bold uppercase tracking-wider text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Save className="size-4" />
            {t("exitConfirm.saveExit")}
          </button>
          {onExitWithoutSave && (
            <button
              type="button"
              onClick={onExitWithoutSave}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-heading font-bold uppercase tracking-wider text-destructive-foreground transition-colors hover:bg-destructive/90"
            >
              <LogOut className="size-4" />
              {t("exitConfirm.exitNoSave", "Salir sin guardar")}
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
