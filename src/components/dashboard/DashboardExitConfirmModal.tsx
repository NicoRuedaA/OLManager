import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import DashboardModalFrame from "./DashboardModalFrame";

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
    <DashboardModalFrame maxWidthClassName="max-w-sm">
      <h3 className="text-lg font-heading font-bold uppercase tracking-wide text-gray-900 dark:text-white">
        {t("exitConfirm.title")}
      </h3>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {t("exitConfirm.message")}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <button
          onClick={onConfirm}
          className="w-full rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-heading font-bold uppercase tracking-wider text-white transition-colors hover:bg-primary-600"
        >
          {t("exitConfirm.saveExit")}
        </button>
        {onExitWithoutSave && (
          <button
            onClick={onExitWithoutSave}
            className="w-full rounded-lg bg-red-500 px-4 py-2.5 text-sm font-heading font-bold uppercase tracking-wider text-white transition-colors hover:bg-red-600"
          >
            {t("exitConfirm.exitNoSave", "Salir sin guardar")}
          </button>
        )}
        <button
          onClick={onCancel}
          className="w-full rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-heading font-bold uppercase tracking-wider text-gray-700 transition-colors hover:bg-gray-200 dark:bg-navy-700 dark:text-gray-300 dark:hover:bg-navy-600"
        >
          {t("common.cancel")}
        </button>
      </div>
    </DashboardModalFrame>
  );
}
