import { useTranslation } from "react-i18next";

import type {
  PlayerData,
  TeamData,
  TransferOfferData,
} from "../../store/gameStore";
import {
  formatVal,
  getTeamName,
  positionBadgeVariant,
  calcAge,
} from "../../lib/helpers";
import type {
  TransferDestinationData,
  TransferBidProjectionData,
  TransferNegotiationResponseData,
} from "../../services/transfersService";
import NegotiationFeedbackPanel, {
  type NegotiationFeedbackPanelData,
} from "../NegotiationFeedbackPanel";
import { Badge } from "../ui";
import { getLolRoleForPlayer } from "../squad/SquadTab.helpers";
import TransferNegotiationHistory from "./TransferNegotiationHistory";

interface TransferBidModalProps {
  bidTarget: PlayerData;
  teams: TeamData[];
  currentDate: string;
  bidAmount: string;
  onBidAmountChange: (value: string) => void;
  destination: TransferDestinationData;
  onDestinationChange: (value: TransferDestinationData) => void;
  academyTeam: TeamData | null;
  myTeam: TeamData | null;
  bidFee: number | null;
  bidProjection: TransferBidProjectionData["projection"] | null;
  bidFeedback: NegotiationFeedbackPanelData | null;
  activeBidOffer: TransferOfferData | null;
  hasExistingOffer: boolean;
  userPlayers: PlayerData[];
  selectedPlayerIds: string[];
  onSelectedPlayersChange: (ids: string[]) => void;
  bidResult: TransferNegotiationResponseData["decision"] | "error" | null;
  bidLoading: boolean;
  bidSubmitDisabled: boolean;
  onSubmit: () => void;
  onClose: () => void;
  isFreeAgent: boolean;
}

export default function TransferBidModal({
  bidTarget,
  teams,
  currentDate,
  bidAmount,
  onBidAmountChange,
  destination,
  onDestinationChange,
  academyTeam,
  myTeam,
  bidFee,
  bidProjection,
  bidFeedback,
  activeBidOffer,
  hasExistingOffer,
  userPlayers,
  selectedPlayerIds,
  onSelectedPlayersChange,
  bidResult,
  bidLoading,
  bidSubmitDisabled,
  onSubmit,
  onClose,
  isFreeAgent,
}: TransferBidModalProps) {
  const { t } = useTranslation();
  const lolRole = getLolRoleForPlayer(bidTarget);

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
          {t("transfers.makeBid")}
        </h3>
        <div className="flex items-center gap-3 mb-4">
          <Badge variant={positionBadgeVariant(bidTarget.position)} size="sm">
            {lolRole === "JUNGLE" ? "JG" : lolRole}
          </Badge>
          <div>
            <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">
              {bidTarget.match_name || bidTarget.full_name}
            </p>
            <p className="text-xs text-gray-400">
              {getTeamName(teams, bidTarget.team_id)} •{" "}
              {t("transfers.playerValue", {
                value: formatVal(bidTarget.market_value),
              })}
            </p>
          </div>
        </div>
        {hasExistingOffer ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {t("transfers.resumeNegotiationHint")}
          </p>
        ) : null}
        <label
          htmlFor="transfer-destination"
          className="text-xs font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 block"
        >
          {t("transfers.destination", {
            defaultValue: "Destination",
          })}
        </label>
        <select
          id="transfer-destination"
          value={destination}
          onChange={(event) =>
            onDestinationChange(event.target.value as TransferDestinationData)
          }
          className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-navy-700 border border-gray-200 dark:border-navy-600 text-sm text-gray-800 dark:text-gray-200 mb-3 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        >
          <option value="main">
            {myTeam?.name ??
              t("transfers.mainTeamDestination", {
                defaultValue: "Main team",
              })}
          </option>
          {academyTeam ? (
            <option value="academy">
              {academyTeam.name}
            </option>
          ) : null}
        </select>
        {!isFreeAgent && (
          <>
            <label
              htmlFor="bid-amount"
              className="text-xs font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 block"
            >
              {t("transfers.bidAmount")}
            </label>
            <input
              id="bid-amount"
              type="number"
              step="1000"
              min="0"
              value={bidAmount}
              onChange={(event) => onBidAmountChange(event.target.value)}
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
                  const age = calcAge(p.date_of_birth, currentDate);
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

            {myTeam && bidFee !== null && bidProjection ? (
              <div className="rounded-lg border border-gray-200 dark:border-navy-700 bg-white/70 dark:bg-navy-900/40 p-3 mb-3 space-y-2">
                <p className="text-[11px] font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t("transfers.bidImpactTitle", {
                    defaultValue: "Projected impact",
                  })}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {t("transfers.bidImpactTransferBudget", {
                    before: formatVal(bidProjection.transfer_budget_before),
                    after: formatVal(bidProjection.transfer_budget_after),
                    defaultValue: "Transfer budget {{before}} -> {{after}}",
                  })}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {t("transfers.bidImpactBalance", {
                    before: formatVal(bidProjection.finance_before),
                    after: formatVal(bidProjection.finance_after),
                    defaultValue: "Club balance {{before}} -> {{after}}",
                  })}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {t("transfers.bidImpactWagePressure", {
                    percent: bidProjection.projected_wage_budget_usage_pct,
                    defaultValue: "Projected wage budget usage {{percent}}%",
                  })}
                </p>
                {bidProjection.exceeds_transfer_budget ? (
                  <p className="text-xs text-red-500">
                    {t("transfers.bidImpactOverTransferBudget", {
                      defaultValue: "This bid exceeds your transfer budget",
                    })}
                  </p>
                ) : null}
                {bidProjection.exceeds_finance ? (
                  <p className="text-xs text-red-500">
                    {t("transfers.bidImpactOverBalance", {
                      defaultValue: "This bid would push the club into debt",
                    })}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}
        <NegotiationFeedbackPanel
          feedback={bidFeedback}
          titleKey="transfers.negotiationPulse"
          roundKey="transfers.negotiationRound"
          patienceKey="transfers.negotiationPatience"
          tensionKey="transfers.negotiationTension"
          className="mb-3"
        />
        <TransferNegotiationHistory offer={activeBidOffer} mode="outgoing" />
        {bidResult ? (
          <div
            className={`text-xs font-heading font-bold uppercase tracking-wider mb-3 ${bidResult === "accepted" ? "text-green-500" : bidResult === "rejected" ? "text-red-500" : "text-amber-500"}`}
          >
            {bidResult === "accepted"
              ? t("transfers.bidAccepted")
              : bidResult === "rejected"
                ? t("transfers.bidRejected")
                : bidResult === "counter_offer"
                  ? t("transfers.bidCountered")
                  : bidResult}
          </div>
        ) : null}
        <div className="flex gap-2">
          <button
            onClick={onSubmit}
            disabled={bidSubmitDisabled}
            className="flex-1 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-heading font-bold text-sm uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            {bidLoading ? t("transfers.submitting") : t("transfers.submitBid")}
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
