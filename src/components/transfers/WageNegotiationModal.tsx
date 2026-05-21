import { useTranslation } from "react-i18next";

import type { PlayerData, TeamData, TransferOfferData } from "../../store/gameStore";
import { formatVal, getTeamName, positionBadgeVariant } from "../../lib/helpers";
import type { WageNegotiationResponseData } from "../../services/transfersService";
import NegotiationFeedbackPanel, {
  type NegotiationFeedbackPanelData,
} from "../NegotiationFeedbackPanel";
import { Badge } from "../ui";
import { getLolRoleForPlayer } from "../squad/SquadTab.helpers";
import TransferNegotiationHistory from "./TransferNegotiationHistory";

interface WageNegotiationTarget {
  player: PlayerData;
  offerId: string;
  fromTeamId: string | null;
  fee: number;
  destinationTeamId: string;
}

interface WageNegotiationModalProps {
  target: WageNegotiationTarget;
  teams: TeamData[];
  wageAmount: string;
  onWageAmountChange: (value: string) => void;
  contractYears: number;
  onContractYearsChange: (years: number) => void;
  feedback: NegotiationFeedbackPanelData | null;
  activeOffer: TransferOfferData | null;
  result: WageNegotiationResponseData["decision"] | "error" | null;
  error: string | null;
  loading: boolean;
  onSubmit: () => void;
  onClose: () => void;
  annualWageBudget: number;
}

export default function WageNegotiationModal({
  target,
  teams,
  wageAmount,
  onWageAmountChange,
  contractYears,
  onContractYearsChange,
  feedback,
  activeOffer,
  result,
  error,
  loading,
  onSubmit,
  onClose,
  annualWageBudget,
}: WageNegotiationModalProps) {
  const { t } = useTranslation();
  const lolRole = getLolRoleForPlayer(target.player);
  const wageValue = Number.parseFloat(wageAmount);
  const isWageValid = Number.isFinite(wageValue) && wageValue > 0;
  const exceedsBudget = isWageValid && wageValue > annualWageBudget;

  const fromTeamName = target.fromTeamId
    ? getTeamName(teams, target.fromTeamId)
    : null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div
        className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl border border-gray-200 dark:border-navy-600 p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t("transfers.wageNegotiation")}
          </h3>
          <button
            onClick={onClose}
            disabled={loading || result === "accepted"}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <Badge variant={positionBadgeVariant(target.player.position)} size="sm">
            {lolRole === "JUNGLE" ? "JG" : lolRole}
          </Badge>
          <div>
            <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">
              {target.player.match_name || target.player.full_name}
            </p>
            <p className="text-xs text-gray-400">
              {fromTeamName
                ? `${fromTeamName} \u2022 ${t("transfers.transferFee", { fee: formatVal(target.fee) })}`
                : t("common.freeAgent")}
            </p>
          </div>
        </div>

        <label
          htmlFor="wage-amount"
          className="text-xs font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 block"
        >
          {t("transfers.annualWage", { defaultValue: "Salario anual" })}
        </label>
        <div className="relative mb-3">
          <input
            id="wage-amount"
            type="number"
            step="5000"
            min="0"
            value={wageAmount}
            onChange={(event) => onWageAmountChange(event.target.value)}
            className={`w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-navy-700 border text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/50 ${
              exceedsBudget
                ? "border-red-500"
                : "border-gray-200 dark:border-navy-600"
            }`}
          />
        </div>

        {isWageValid && target.player.wage > 0 && (
          <div className="mb-3 rounded-lg border border-gray-200 dark:border-navy-700 bg-white/70 dark:bg-navy-900/40 p-3 space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("transfers.currentAnnualWage", {
                wage: formatVal(target.player.wage),
                defaultValue: "Salario anual actual: {{wage}}",
              })}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("transfers.proposedWeekly", {
                weekly: formatVal(Math.round(wageValue / 52)),
                defaultValue: "Equivalente semanal: {{weekly}}/sem",
              })}
            </p>
            {wageValue > target.player.wage && (
              <p className="text-xs text-green-600 dark:text-green-400">
                {t("transfers.wageIncrease", {
                  pct: Math.round(((wageValue / target.player.wage) - 1) * 100),
                  defaultValue: "Aumento: +{{pct}}%",
                })}
              </p>
            )}
          </div>
        )}

        {annualWageBudget > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{t("transfers.wageBudgetUsage")}</span>
              <span>
                {isWageValid
                  ? Math.round((wageValue / annualWageBudget) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 dark:bg-navy-600 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  exceedsBudget ? "bg-red-500" : "bg-primary-500"
                }`}
                style={{
                  width: `${Math.min(
                    isWageValid ? (wageValue / annualWageBudget) * 100 : 0,
                    100,
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        <label
          htmlFor="contract-years"
          className="text-xs font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 block"
        >
          {t("transfers.contractLength")}
        </label>
        <select
          id="contract-years"
          value={contractYears}
          onChange={(event) => onContractYearsChange(Number(event.target.value))}
          className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-navy-700 border border-gray-200 dark:border-navy-600 text-sm text-gray-800 dark:text-gray-200 mb-3 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        >
          {[1, 2, 3, 4, 5].map((y) => (
            <option key={y} value={y}>
              {t("transfers.contractYears", { count: y })}
            </option>
          ))}
        </select>

        <NegotiationFeedbackPanel
          feedback={feedback}
          titleKey="transfers.negotiationPulse"
          roundKey="transfers.negotiationRound"
          patienceKey="transfers.negotiationPatience"
          tensionKey="transfers.negotiationTension"
          className="mb-3"
        />

        <TransferNegotiationHistory offer={activeOffer} mode="outgoing" />

        {result ? (
          <div
            className={`text-xs font-heading font-bold uppercase tracking-wider mb-3 ${
              result === "accepted"
                ? "text-green-500"
                : result === "rejected"
                  ? "text-red-500"
                  : "text-amber-500"
            }`}
          >
            {result === "accepted"
              ? t("transfers.wageAccepted")
              : result === "rejected"
                ? t("transfers.wageRejected")
                : t("transfers.wageCountered")}
          </div>
        ) : null}

        {error ? (
          <div className="text-xs font-heading font-bold uppercase tracking-wider mb-3 text-red-500">
            {error}
          </div>
        ) : null}

        <div className="flex gap-2">
          <button
            onClick={onSubmit}
            disabled={loading || !isWageValid || result === "accepted"}
            className="flex-1 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-heading font-bold text-sm uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            {loading
              ? t("transfers.submitting")
              : t("transfers.submitWageOffer")}
          </button>
          <button
            onClick={onClose}
            disabled={loading || result === "accepted"}
            className="px-4 py-2 bg-gray-200 dark:bg-navy-700 text-gray-600 dark:text-gray-300 rounded-lg font-heading font-bold text-sm uppercase tracking-wider hover:bg-gray-300 dark:hover:bg-navy-600 transition-colors disabled:opacity-50"
          >
            {t("transfers.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
