import { useState } from "react";
import { useTranslation } from "react-i18next";

import type {
  PlayerData,
  TeamData,
} from "../../store/gameStore";
import { formatVal, getTeamName, positionBadgeVariant, calcAge } from "../../lib/helpers";
import type { TransferNegotiationResponseData } from "../../services/transfersService";
import NegotiationFeedbackPanel, {
  type NegotiationFeedbackPanelData,
} from "../NegotiationFeedbackPanel";
import { Badge } from "../ui";
import { getLolRoleForPlayer } from "../squad/SquadTab.helpers";
import TransferNegotiationHistory from "./TransferNegotiationHistory";

interface TransferCounterTarget {
  player: PlayerData;
  offerId: string;
  fromTeamId: string;
  fee: number;
}

interface TransferCounterOfferModalProps {
  counterTarget: TransferCounterTarget;
  teams: TeamData[];
  counterAmount: string;
  onCounterAmountChange: (value: string) => void;
  counterFeedback: NegotiationFeedbackPanelData | null;
  activeCounterOffer: any | null;
  counterResult: TransferNegotiationResponseData["decision"] | "error" | null;
  counterError: string | null;
  counterLoading: boolean;
  userPlayers: PlayerData[];
  selectedPlayerIds: string[];
  onSelectedPlayersChange: (ids: string[]) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export default function TransferCounterOfferModal({
  counterTarget,
  teams,
  counterAmount,
  onCounterAmountChange,
  counterFeedback,
  activeCounterOffer,
  counterResult,
  counterError,
  counterLoading,
  userPlayers,
  selectedPlayerIds,
  onSelectedPlayersChange,
  onSubmit,
  onClose,
}: TransferCounterOfferModalProps) {
  const { t } = useTranslation();
  const lolRole = getLolRoleForPlayer(counterTarget.player);

  const togglePlayer = (playerId: string) => {
    if (selectedPlayerIds.includes(playerId)) {
      onSelectedPlayersChange(selectedPlayerIds.filter((id) => id !== playerId));
    } else if (selectedPlayerIds.length < 2) {
      onSelectedPlayersChange([...selectedPlayerIds, playerId]);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl border border-gray-200 dark:border-navy-600 p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
          {t("transfers.counterOffer")}
        </h3>
        <div className="flex items-center gap-3 mb-4">
          <Badge
            variant={positionBadgeVariant(counterTarget.player.position)}
            size="sm"
          >
            {lolRole === "JUNGLE" ? "JG" : lolRole}
          </Badge>
          <div>
            <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">
              {counterTarget.player.match_name || counterTarget.player.full_name}
            </p>
            <p className="text-xs text-gray-400">
              {getTeamName(teams, counterTarget.fromTeamId)} •
              {t("transfers.currentOffer", {
                fee: formatVal(counterTarget.fee),
              })}
            </p>
          </div>
        </div>
        {counterFeedback ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {t("transfers.resumeNegotiationHint")}
          </p>
        ) : null}
        <label
          htmlFor="counter-offer-amount"
          className="text-xs font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 block"
        >
          {t("transfers.counterAmount")}
        </label>
        <input
          id="counter-offer-amount"
          type="number"
          step="1000"
          min="0"
          value={counterAmount}
          onChange={(event) => onCounterAmountChange(event.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-navy-700 border border-gray-200 dark:border-navy-600 text-sm text-gray-800 dark:text-gray-200 mb-3 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        />

        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t("transfers.includePlayers")}
            </label>
            <span className="text-xs text-gray-400">
              {selectedPlayerIds.length}/2 {t("transfers.playersSelected")}
            </span>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {userPlayers.map((p) => {
              const isSelected = selectedPlayerIds.includes(p.id);
              const age = calcAge(p.date_of_birth);
              const role = getLolRoleForPlayer(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={!isSelected && selectedPlayerIds.length >= 2}
                  onClick={() => togglePlayer(p.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                    isSelected
                      ? "bg-primary-500/20 border border-primary-500/50"
                      : "bg-gray-50 dark:bg-navy-700 border border-transparent hover:border-gray-300 dark:hover:border-navy-500 disabled:opacity-40"
                  }`}
                >
                  <Badge variant={positionBadgeVariant(p.position)} size="sm">
                    {role === "JUNGLE" ? "JG" : role}
                  </Badge>
                  <span className="flex-1 text-left text-gray-800 dark:text-gray-200 truncate">
                    {p.match_name || p.full_name}
                  </span>
                  <span className="text-gray-400">{age}yo</span>
                  <span className="font-semibold text-gray-600 dark:text-gray-300">
                    {formatVal(p.market_value)}
                  </span>
                </button>
              );
            })}
            {userPlayers.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">
                {t("transfers.noPlayersAvailable")}
              </p>
            )}
          </div>
        </div>

        <NegotiationFeedbackPanel
          feedback={counterFeedback}
          titleKey="transfers.negotiationPulse"
          roundKey="transfers.negotiationRound"
          patienceKey="transfers.negotiationPatience"
          tensionKey="transfers.negotiationTension"
          className="mb-3"
        />
        <TransferNegotiationHistory offer={activeCounterOffer} mode="incoming" />
        {counterResult ? (
          <div
            className={`text-xs font-heading font-bold uppercase tracking-wider mb-3 ${counterResult === "accepted" ? "text-green-500" : counterResult === "rejected" ? "text-red-500" : "text-amber-500"}`}
          >
            {counterResult === "accepted"
              ? t("transfers.counterAccepted")
              : counterResult === "rejected"
                ? t("transfers.counterRejected")
                : t("transfers.counterCountered")}
          </div>
        ) : null}
        {counterError ? (
          <div className="text-xs font-heading font-bold uppercase tracking-wider mb-3 text-red-500">
            {counterError}
          </div>
        ) : null}
        <div className="flex gap-2">
          <button
            onClick={onSubmit}
            disabled={counterLoading || counterResult === "accepted"}
            className="flex-1 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-heading font-bold text-sm uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            {counterLoading
              ? t("transfers.submitting")
              : t("transfers.submitCounter")}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-navy-700 text-gray-600 dark:text-gray-300 rounded-lg font-heading font-bold text-sm uppercase tracking-wider hover:bg-gray-300 dark:hover:bg-navy-600 transition-colors"
          >
            {t("transfers.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
