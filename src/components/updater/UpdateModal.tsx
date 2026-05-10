import { useTranslation } from "react-i18next";
import { UpdateInfo } from "../../services/updaterService";
import { Download, X, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

interface UpdateModalProps {
  updateInfo: UpdateInfo;
  downloading: boolean;
  progress: { percent: number; contentLength?: number } | null;
  error: string | null;
  onInstall: () => void;
  onDismiss: () => void;
}

export default function UpdateModal({
  updateInfo,
  downloading,
  progress,
  error,
  onInstall,
  onDismiss,
}: UpdateModalProps) {
  const { t } = useTranslation();

  const percent = progress?.percent ?? (downloading ? 0 : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-navy-800 rounded-2xl border border-gray-200 dark:border-navy-700 shadow-xl max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-navy-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary-500" />
            <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
              {t("updater.title")}
            </h2>
          </div>
          {!downloading && (
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              aria-label={t("common.close")}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t("updater.description", { version: updateInfo.version })}
            </p>
            {updateInfo.notes && (
              <div className="mt-3 max-h-32 overflow-y-auto rounded-lg bg-gray-50 dark:bg-navy-700/50 p-3 text-xs text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                {updateInfo.notes}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/10 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {downloading && percent !== null && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{t("updater.downloading")}</span>
                <span>{percent}%</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-navy-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}

          {downloading && percent === null && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{t("updater.preparing")}</span>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-navy-700 flex justify-end gap-3">
          {!downloading && (
            <button
              onClick={onDismiss}
              className="px-4 py-2 rounded-lg text-xs font-heading font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors"
            >
              {t("updater.playWithoutUpdating")}
            </button>
          )}
          <button
            onClick={onInstall}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-white text-xs font-heading font-bold uppercase tracking-wider hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {downloading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {downloading ? t("updater.installing") : t("updater.installAndRestart")}
          </button>
        </div>
      </div>
    </div>
  );
}
