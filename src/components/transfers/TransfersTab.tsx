import { useEffect, useState } from "react";
import {
  GameStateData,
  PlayerData,
  PlayerSelectionOptions,
  TransferOfferData,
} from "../../store/gameStore";
import { Card, CardBody, Badge, CountryFlag, RoleBadge } from "../ui";
import {
  Search,
  TrendingUp,
  ShoppingCart,
  Handshake,
  ArrowRightLeft,
  Gavel,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Globe,
} from "lucide-react";
import {
  getTeamName,
  calcAge,
  formatVal,
  formatWeeklyAmount,
} from "../../lib/helpers";
import { calculateLolOvr } from "../../lib/lolPlayerStats";
import { resolvePlayerPhoto } from "../../lib/playerPhotos";
import {
  annualAmountToWeeklyCommitment,
} from "../../lib/finance";
import { useTranslation } from "react-i18next";
import { countryName } from "../../lib/countries";
import {
  getLolRoleForPlayer,
} from "../squad/SquadTab.helpers";
import { resolveSeasonContext } from "../../lib/seasonContext";
import { type NegotiationFeedbackPanelData } from "../NegotiationFeedbackPanel";
import TransferBidModal from "./TransferBidModal";
import TransferCounterOfferModal from "./TransferCounterOfferModal";
import {
  counterOffer,
  makeTransferBid,
  previewTransferBidFinancialImpact,
  respondToOffer,
  type TransferDestinationData,
  type TransferBidProjectionData,
  type TransferNegotiationResponseData,
} from "../../services/transfersService";
import {
  buildResumedBidFeedback,
  buildResumedCounterFeedback,
  getOutgoingNegotiationOffer,
  getTransferOfferBadgeVariant,
  getTransferOfferStatusLabel,
  mapTransferNegotiationError,
} from "./TransfersTab.helpers";
import {
  deriveTransferCollections,
  filterTransferPlayers,
  getCurrentTransferList,
  sortTransferPlayers,
  type TransferSortKey,
  type TransferSortState,
  type TransferTabView,
} from "./TransfersTab.model";

interface TransfersTabProps {
  gameState: GameStateData;
  onSelectPlayer: (id: string, options?: PlayerSelectionOptions) => void;
  onSelectTeam: (id: string) => void;
  onGameUpdate?: (game: GameStateData) => void;
}

type CounterTarget = {
  player: PlayerData;
  offerId: string;
  fromTeamId: string;
  fee: number;
};

type TransferNegotiationFeedbackData = NegotiationFeedbackPanelData;

export default function TransfersTab({
  gameState,
  onSelectPlayer,
  onSelectTeam,
  onGameUpdate,
}: TransfersTabProps) {
  const { t, i18n } = useTranslation();
  const weeklySuffix = t("finances.perWeekSuffix", "/wk");
  const userTeamId = gameState.manager.team_id;
  const [view, setView] = useState<TransferTabView>("my_list");
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<TransferSortState | null>(null);

  const toggleSort = (key: TransferSortKey) => {
    setSort((current) => {
      if (!current || current.key !== key) {
        return { key, direction: "desc" };
      }
      if (current.direction === "desc") {
        return { key, direction: "asc" };
      }
      return null;
    });
  };

  const renderSortIcon = (key: TransferSortKey) => {
    if (!sort || sort.key !== key) {
      return (
        <ArrowUpDown className="w-3 h-3 text-gray-400 dark:text-gray-500 opacity-60 group-hover/sort:opacity-100 transition-opacity" />
      );
    }
    return sort.direction === "desc" ? (
      <ArrowDown className="w-3 h-3 text-primary-500" />
    ) : (
      <ArrowUp className="w-3 h-3 text-primary-500" />
    );
  };
  const [bidTarget, setBidTarget] = useState<PlayerData | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [bidResult, setBidResult] = useState<
    TransferNegotiationResponseData["decision"] | "error" | null
  >(null);
  const [bidDestination, setBidDestination] =
    useState<TransferDestinationData>("main");
  const [bidLoading, setBidLoading] = useState(false);
  const [bidFeedback, setBidFeedback] =
    useState<TransferNegotiationFeedbackData | null>(null);
  const [bidProjection, setBidProjection] =
    useState<TransferBidProjectionData["projection"] | null>(null);
  const [counterTarget, setCounterTarget] = useState<CounterTarget | null>(
    null,
  );
  const [counterAmount, setCounterAmount] = useState("");
  const [counterLoading, setCounterLoading] = useState(false);
  const [counterError, setCounterError] = useState<string | null>(null);
  const [counterResult, setCounterResult] = useState<
    TransferNegotiationResponseData["decision"] | "error" | null
  >(null);
  const [counterFeedback, setCounterFeedback] =
    useState<TransferNegotiationFeedbackData | null>(null);

  const openBidNegotiation = (player: PlayerData) => {
    const existingOffer = getOutgoingNegotiationOffer(player, userTeamId);
    const userAcademyTeamId = gameState.teams.find(
      (team) => team.id === userTeamId,
    )?.academy_team_id ?? gameState.teams.find(
      (team) => team.team_kind === "Academy" && team.parent_team_id === userTeamId,
    )?.id;

    setBidTarget(player);
    setBidDestination(
      existingOffer?.destination_team_id === userAcademyTeamId
        ? "academy"
        : "main",
    );
    setBidAmount(
      String(
        Math.round(
          existingOffer?.suggested_counter_fee ??
            existingOffer?.fee ??
            player.market_value,
        ),
      ),
    );
    setBidResult(null);
    setBidFeedback(buildResumedBidFeedback(existingOffer));
    setBidProjection(null);
  };

  const openCounterNegotiation = (
    player: PlayerData,
    offer: TransferOfferData,
  ) => {
    setCounterTarget({
      player,
      offerId: offer.id,
      fromTeamId: offer.from_team_id,
      fee: offer.fee,
    });
    setCounterAmount(String(Math.round(offer.suggested_counter_fee ?? offer.fee)));
    setCounterError(null);
    setCounterResult(null);
    setCounterFeedback(buildResumedCounterFeedback(offer));
  };

  const handleMakeBid = async () => {
    if (!bidTarget || !bidAmount) return;
    setBidLoading(true);
    setBidResult(null);
    setBidFeedback(null);
    try {
      const fee = Math.round(parseFloat(bidAmount));
      const res = await makeTransferBid(bidTarget.id, fee, bidDestination);
      setBidResult(res.decision);
      setBidFeedback(res.feedback);
      if (onGameUpdate) onGameUpdate(res.game);
      if (res.suggested_fee !== null) {
        setBidAmount(String(Math.round(res.suggested_fee)));
      }
      if (res.decision === "accepted") {
        setTimeout(() => {
          setBidTarget(null);
          setBidResult(null);
          setBidFeedback(null);
        }, 2000);
      }
    } catch (err: any) {
      setBidResult(err?.toString() || "error");
      setBidFeedback(null);
    } finally {
      setBidLoading(false);
    }
  };

  const handleRespondOffer = async (
    playerId: string,
    offerId: string,
    accept: boolean,
  ) => {
    try {
      const game = await respondToOffer(playerId, offerId, accept);
      if (onGameUpdate) onGameUpdate(game);
    } catch (err) {
      console.error("Failed to respond to offer:", err);
    }
  };

  const handleCounterOffer = async () => {
    if (!counterTarget || !counterAmount) return;

    setCounterLoading(true);
    setCounterError(null);
    setCounterResult(null);
    setCounterFeedback(null);

    try {
      const requestedFee = Math.round(parseFloat(counterAmount));
      const response = await counterOffer(
        counterTarget.player.id,
        counterTarget.offerId,
        requestedFee,
      );

      if (onGameUpdate) onGameUpdate(response.game);
      setCounterResult(response.decision);
      setCounterFeedback(response.feedback);
      if (response.suggested_fee !== null) {
        setCounterAmount(String(Math.round(response.suggested_fee)));
      }
      if (response.decision === "accepted") {
        setTimeout(() => {
          setCounterTarget(null);
          setCounterAmount("");
          setCounterResult(null);
          setCounterFeedback(null);
        }, 1500);
      }
    } catch (err: any) {
      setCounterError(
        mapTransferNegotiationError(t, err?.toString() || "error"),
      );
    } finally {
      setCounterLoading(false);
    }
  };

  const myTeam = gameState.teams.find(
    (team) => team.id === gameState.manager.team_id,
  );
  const myRoster = myTeam ? gameState.players.filter((p) => p.team_id === myTeam.id) : [];
  const totalWages = myRoster.reduce((sum, p) => sum + annualAmountToWeeklyCommitment(p.wage), 0);
  const academyTeam = gameState.teams.find(
    (team) => team.id === myTeam?.academy_team_id,
  ) ?? gameState.teams.find(
    (team) => team.team_kind === "Academy" && team.parent_team_id === myTeam?.id,
  ) ?? null;
  const activeBidOffer = bidTarget
    ? getOutgoingNegotiationOffer(bidTarget, userTeamId)
    : null;
  const activeCounterOffer = counterTarget
    ? counterTarget.player.transfer_offers.find(
      (offer) => offer.id === counterTarget.offerId,
    ) ?? null
    : null;
  const seasonContext = resolveSeasonContext(gameState);
  const transferWindow = seasonContext.transfer_window;
  const transferWindowVariant =
    transferWindow.status === "DeadlineDay"
      ? "danger"
      : transferWindow.status === "Open"
        ? "success"
        : "neutral";
  const transferWindowSummary =
    transferWindow.status === "DeadlineDay"
      ? t("season.windowClosesToday")
      : transferWindow.status === "Open" &&
        transferWindow.days_remaining !== null
        ? t("season.windowClosesInDays", {
          count: transferWindow.days_remaining,
        })
        : transferWindow.status === "Closed" &&
          transferWindow.days_until_opens !== null
          ? t("season.windowOpensInDays", {
            count: transferWindow.days_until_opens,
          })
          : t("season.windowClosed");

  const transferCollections = deriveTransferCollections(gameState, userTeamId);
  const {
    myTransferList,
    myLoanList,
    marketPlayers,
    erlPlayers,
    loanPlayers,
    playersWithOffers,
  } = transferCollections;

  const positions = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"] as const;

  const tabs: {
    id: TransferTabView;
    label: string;
    icon: React.ReactNode;
    count: number;
  }[] = [
      {
        id: "my_list",
        label: t("transfers.myTransferList"),
        icon: <ShoppingCart className="w-4 h-4" />,
        count: myTransferList.length + myLoanList.length,
      },
      {
        id: "market",
        label: t("transfers.transferMarket"),
        icon: <TrendingUp className="w-4 h-4" />,
        count: marketPlayers.length,
      },
      {
        id: "erl",
        label: t("transfers.erlMarket", "Mercado ERL"),
        icon: <Globe className="w-4 h-4" />,
        count: (erlPlayers ?? []).length,
      },
      {
        id: "loans",
        label: t("transfers.loanMarket"),
        icon: <ArrowRightLeft className="w-4 h-4" />,
        count: loanPlayers.length,
      },
      {
        id: "offers",
        label: t("transfers.offers"),
        icon: <Handshake className="w-4 h-4" />,
        count: playersWithOffers.length,
      },
    ];

  const currentList = getCurrentTransferList(view, transferCollections);
  const filteredList = sortTransferPlayers(
    filterTransferPlayers(currentList, search, posFilter),
    sort,
  );
  const weeklyWageBudget = myTeam
    ? annualAmountToWeeklyCommitment(myTeam.wage_budget)
    : 0;
  const bidAmountValue = Number.parseFloat(bidAmount);
  const bidFee = Number.isFinite(bidAmountValue)
    ? Math.round(bidAmountValue)
    : null;

  useEffect(() => {
    if (!bidTarget || bidFee === null || bidFee <= 0) {
      setBidProjection(null);
      return;
    }

    let cancelled = false;

    const loadProjection = async (): Promise<void> => {
      try {
        const result = await previewTransferBidFinancialImpact(
          bidTarget.id,
          bidFee,
          bidDestination,
        );

        if (!cancelled) {
          setBidProjection(result.projection ?? null);
        }
      } catch {
        if (!cancelled) {
          setBidProjection(null);
        }
      }
    };

    loadProjection();

    return () => {
      cancelled = true;
    };
  }, [bidDestination, bidFee, bidTarget]);

  const bidSubmitDisabled =
    bidLoading ||
    bidResult === "accepted" ||
    bidFee === null ||
    bidFee <= 0 ||
    bidProjection === null ||
    bidProjection.exceeds_transfer_budget ||
    bidProjection.exceeds_finance;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Budget header */}
      {myTeam && (
        <Card accent="primary" className="mb-5">
          <div className="bg-gradient-to-r from-navy-700 to-navy-800 p-5 rounded-t-xl flex items-center gap-6">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-heading font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-accent-400" />
                  {t("transfers.centre")}
                </h2>
                <Badge variant={transferWindowVariant} size="sm">
                  {t(`season.transferWindowStatus.${transferWindow.status}`)}
                </Badge>
              </div>
              <p className="text-gray-400 text-xs mt-0.5">
                {t("transfers.transferWindow", { team: myTeam.name })}
              </p>
              <p className="text-gray-500 text-xs mt-1 flex items-center gap-2">
                {transferWindowSummary}
                {transferWindow.status === "Open" && transferWindow.days_remaining !== null && (
                  <span className="inline-flex items-center gap-1">
                    <span className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <span className="block h-full rounded-full bg-accent-400" style={{ width: `${Math.max(5, (transferWindow.days_remaining / 30) * 100)}%` }} />
                    </span>
                  </span>
                )}
              </p>
            </div>
            <div className="hidden md:flex gap-4">
              <div className="bg-white/5 rounded-xl px-4 py-2 text-center min-w-[110px]">
                <p className="text-xs text-gray-400 font-heading uppercase tracking-wider">
                  {t("finances.transferBudget")}
                </p>
                <p className="font-heading font-bold text-lg text-accent-400">
                  {formatVal(myTeam.transfer_budget)}
                </p>
                {myTeam.season_expenses > 0 && (
                  <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden mt-1">
                    <div className="h-full rounded-full bg-accent-400/60" style={{ width: `${Math.min(100, (myTeam.season_expenses / Math.max(1, myTeam.transfer_budget)) * 100)}%` }} />
                  </div>
                )}
              </div>
              <div className="bg-white/5 rounded-xl px-4 py-2 text-center min-w-[110px]">
                <p className="text-xs text-gray-400 font-heading uppercase tracking-wider">
                  {t("finances.wageBudget")}
                </p>
                <p className="font-heading font-bold text-lg text-white">
                  {formatWeeklyAmount(formatVal(weeklyWageBudget), weeklySuffix)}
                </p>
                {totalWages > 0 && (
                  <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden mt-1">
                    <div className="h-full rounded-full bg-success-400/60" style={{ width: `${Math.min(100, (totalWages / Math.max(1, weeklyWageBudget)) * 100)}%` }} />
                  </div>
                )}
              </div>
              <div className="bg-white/5 rounded-xl px-4 py-2 text-center min-w-[80px]">
                <p className="text-xs text-gray-400 font-heading uppercase tracking-wider">
                  {t("transfers.listed")}
                </p>
                <p className="font-heading font-bold text-lg text-white">
                  {myTransferList.length + myLoanList.length}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Tab navigation */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`px-4 py-2 rounded-lg font-heading font-bold text-sm uppercase tracking-wider transition-all flex items-center gap-1.5 ${view === tab.id
              ? "bg-primary-500 text-white shadow-md shadow-primary-500/20"
              : "bg-white dark:bg-navy-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-navy-600 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
          >
            {tab.icon} {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder={t("transfers.searchByName")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-lg bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-600 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-heading font-bold tabular-nums text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-navy-700 px-1.5 py-0.5 rounded">
            {filteredList.length}
          </span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setPosFilter(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold uppercase tracking-wider transition-all ${!posFilter ? "bg-primary-500 text-white shadow-sm" : "bg-white dark:bg-navy-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-navy-600"}`}
            title="All roles"
          >
            <img src="/role-icons/allroles.png" alt="All roles" className="h-3.5 w-3.5" />
          </button>
          {positions.map((pos) => (
            <button
              key={pos}
              onClick={() => setPosFilter(posFilter === pos ? null : pos)}
              className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold uppercase tracking-wider transition-all ${posFilter === pos ? "bg-primary-500 text-white shadow-sm" : "bg-white dark:bg-navy-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-navy-600"}`}
              title={pos}
            >
              <RoleBadge role={pos} size="sm" />
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {view === "my_list" && filteredList.length === 0 && (
        <Card>
          <CardBody>
            <div className="text-center py-8">
              <ShoppingCart className="w-10 h-10 text-gray-300 dark:text-navy-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("transfers.noPlayersListed")}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4">
                {t("transfers.goToProfile")}
              </p>
              <button
                onClick={() => setView("market")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-heading font-bold text-xs uppercase tracking-wider bg-primary-500 text-white shadow-md hover:bg-primary-600 transition-colors"
              >
                <TrendingUp className="w-3.5 h-3.5" /> {t("transfers.browseMarket", "Ir al mercado")}
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      {view === "offers" && filteredList.length === 0 && (
        <Card>
          <CardBody>
            <div className="text-center py-8">
              <Handshake className="w-10 h-10 text-gray-300 dark:text-navy-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("transfers.noOffers")}
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {filteredList.length > 0 && (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-navy-800 border-b border-gray-200 dark:border-navy-600 text-xs">
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t("common.photo", "Foto")}
                    </th>
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <button
                        type="button"
                        onClick={() => toggleSort("position")}
                        className="group/sort inline-flex items-center gap-1.5 hover:text-primary-500 transition-colors"
                        aria-label={t("transfers.sortByPosition", "Ordenar por posición")}
                      >
                        {t("common.position")}
                        {renderSortIcon("position")}
                      </button>
                    </th>
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <button
                        type="button"
                        onClick={() => toggleSort("name")}
                        className="group/sort inline-flex items-center gap-1.5 hover:text-primary-500 transition-colors"
                        aria-label={t("transfers.sortByName", "Ordenar por nombre")}
                      >
                        {t("common.player")}
                        {renderSortIcon("name")}
                      </button>
                    </th>
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <button
                        type="button"
                        onClick={() => toggleSort("age")}
                        className="group/sort inline-flex items-center gap-1.5 hover:text-primary-500 transition-colors"
                        aria-label={t("transfers.sortByAge", "Ordenar por edad")}
                      >
                        {t("common.age")}
                        {renderSortIcon("age")}
                      </button>
                    </th>
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <button
                        type="button"
                        onClick={() => toggleSort("team")}
                        className="group/sort inline-flex items-center gap-1.5 hover:text-primary-500 transition-colors"
                        aria-label={t("transfers.sortByTeam", "Ordenar por equipo")}
                      >
                        {t("common.team")}
                        {renderSortIcon("team")}
                      </button>
                    </th>
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <button
                        type="button"
                        onClick={() => toggleSort("value")}
                        className="group/sort inline-flex items-center gap-1.5 hover:text-primary-500 transition-colors"
                        aria-label={t("transfers.sortByValue", "Ordenar por valor")}
                      >
                        {t("common.value")}
                        {renderSortIcon("value")}
                      </button>
                    </th>
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <button
                        type="button"
                        onClick={() => toggleSort("wage")}
                        className="group/sort inline-flex items-center gap-1.5 hover:text-primary-500 transition-colors"
                        aria-label={t("transfers.sortByWage", "Ordenar por salario")}
                      >
                        {t("common.wage")}
                        {renderSortIcon("wage")}
                      </button>
                    </th>
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <button
                        type="button"
                        onClick={() => toggleSort("ovr")}
                        className="group/sort inline-flex items-center gap-1.5 hover:text-primary-500 transition-colors"
                        aria-label={t("transfers.sortByOvr", "Ordenar por OVR")}
                      >
                        {t("common.ovr")}
                        {renderSortIcon("ovr")}
                      </button>
                    </th>
                    <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <button
                        type="button"
                        onClick={() => toggleSort("status")}
                        className="group/sort inline-flex items-center gap-1.5 hover:text-primary-500 transition-colors"
                        aria-label={t("transfers.sortByStatus", "Ordenar por estado")}
                      >
                        {t("common.status")}
                        {renderSortIcon("status")}
                      </button>
                    </th>
                    {view === "offers" && (
                      <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        {t("transfers.offers")}
                      </th>
                    )}
                    {(view === "market" || view === "erl" || view === "loans") && (
                      <th className="py-3 px-4 font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        {t("common.action")}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-navy-600">
                  {filteredList.map((player) => {
                    const ovr = calculateLolOvr(player);
                    const age = calcAge(player.date_of_birth, gameState.clock.current_date);
                    const offersForThisPlayer = player.transfer_offers;
                    const lolRole = getLolRoleForPlayer(player);
                    const photoSrc = resolvePlayerPhoto(player.id, player.match_name);
                    return (
                      <tr
                        key={player.id}
                        className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors cursor-pointer group"
                        onClick={() => onSelectPlayer(player.id)}
                      >
                        <td className="py-2.5 px-4">
                          <img
                            src={photoSrc ?? "/player-photos/107455908655055017.webp"}
                            alt={player.match_name}
                            className="w-8 h-8 rounded-full object-cover bg-gray-200 dark:bg-navy-600"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/player-photos/107455908655055017.webp";
                            }}
                          />
                        </td>
                        <td className="py-2.5 px-4">
                          <RoleBadge role={lolRole} size="sm" />
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="font-semibold text-sm text-gray-800 dark:text-gray-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                            {player.match_name || player.full_name}
                          </span>
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
                            <CountryFlag
                              code={player.nationality}
                              locale={i18n.language}
                              className="text-sm leading-none"
                            />
                            <span>
                              {countryName(player.nationality, i18n.language)}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                          {age}
                        </td>
                      <td className="py-2.5 px-4">
                        {player.team_id ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTeam(player.team_id!);
                            }}
                            className="text-left hover:text-primary-500 transition-colors font-medium text-gray-900 dark:text-gray-100"
                          >
                            {getTeamName(gameState.teams, player.team_id!)}
                          </button>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400 italic">
                            {t("common.freeAgent")}
                          </span>
                        )}
                      </td>
                        <td className="py-2.5 px-4 text-sm text-gray-600 dark:text-gray-400 font-medium tabular-nums">
                          {formatVal(player.market_value)}
                        </td>
                        <td className="py-2.5 px-4 text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                          {formatVal(player.wage)}/yr
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`font-heading font-bold text-base tabular-nums ${ovr >= 75 ? "text-primary-500" : ovr >= 55 ? "text-accent-500" : "text-gray-400"}`}
                          >
                            {ovr}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex gap-1">
                            {player.transfer_listed && (
                              <Badge variant="accent" size="sm">
                                {t("transfers.transfer")}
                              </Badge>
                            )}
                            {player.loan_listed && (
                              <Badge variant="primary" size="sm">
                                {t("transfers.loan")}
                              </Badge>
                            )}
                          </div>
                        </td>
                        {view === "offers" && (
                          <td className="py-2.5 px-4">
                            <div className="flex flex-col gap-1">
                              {offersForThisPlayer.length === 0 ? (
                                <span className="text-xs text-gray-400">
                                  {t("transfers.none")}
                                </span>
                              ) : (
                                offersForThisPlayer.map((offer) => (
                                  <div
                                    key={offer.id}
                                    className="flex items-center gap-2"
                                  >
                                    <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                                      {getTeamName(
                                        gameState.teams,
                                        offer.from_team_id,
                                      )}
                                    </span>
                                    <Badge
                                      variant={getTransferOfferBadgeVariant(
                                        offer.status,
                                      )}
                                      size="sm"
                                    >
                                      {formatVal(offer.fee)} — {getTransferOfferStatusLabel(t, offer.status)}
                                    </Badge>
                                    {offer.status === "Pending" &&
                                      player.team_id === userTeamId && (
                                        <div className="flex gap-1 ml-1">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRespondOffer(
                                                player.id,
                                                offer.id,
                                                true,
                                              );
                                            }}
                                            className="p-1 rounded bg-green-500/20 hover:bg-green-500/30 text-green-500"
                                            title={t("transfers.acceptOffer")}
                                          >
                                            <Check className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRespondOffer(
                                                player.id,
                                                offer.id,
                                                false,
                                              );
                                            }}
                                            className="p-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-500"
                                            title={t("transfers.rejectOffer")}
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openCounterNegotiation(player, offer);
                                            }}
                                            aria-label={t("transfers.counterOffer")}
                                            className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 text-xs font-heading font-bold uppercase tracking-wider"
                                            title={t("transfers.counterOffer")}
                                          >
                                            <Gavel className="w-3 h-3" />{" "}
                                            {t("transfers.counter")}
                                          </button>
                                        </div>
                                      )}
                                  </div>
                                ))
                              )}
                            </div>
                          </td>
                        )}
                        {(view === "market" || view === "erl" || view === "loans") && (
                          <td className="py-2.5 px-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openBidNegotiation(player);
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 bg-primary-500/10 hover:bg-primary-500/20 text-primary-500 rounded-lg text-xs font-heading font-bold uppercase tracking-wider transition-colors"
                            >
                              <Gavel className="w-3 h-3" /> {t("transfers.bid")}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {(view === "market" || view === "erl" || view === "loans") && filteredList.length === 0 && (
        <Card>
          <CardBody>
            <div className="text-center py-8">
              <TrendingUp className="w-10 h-10 text-gray-300 dark:text-navy-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {view === "market"
                  ? t("transfers.noTransferMarket")
                  : view === "erl"
                    ? t("transfers.noErlMarket", "Sin jugadores ERL disponibles para fichar.")
                  : t("transfers.noLoanMarket")}
              </p>
            </div>
          </CardBody>
        </Card>
      )}
      {/* Bid Modal */}
      {bidTarget && (
        <TransferBidModal
          bidTarget={bidTarget}
          teams={gameState.teams}
          bidAmount={bidAmount}
          onBidAmountChange={setBidAmount}
          destination={bidDestination}
          onDestinationChange={setBidDestination}
          academyTeam={academyTeam}
          myTeam={myTeam ?? null}
          bidFee={bidFee}
          bidProjection={bidProjection}
          bidFeedback={bidFeedback}
          activeBidOffer={activeBidOffer}
          hasExistingOffer={activeBidOffer !== null}
          bidResult={bidResult}
          bidLoading={bidLoading}
          bidSubmitDisabled={bidSubmitDisabled}
          onSubmit={handleMakeBid}
          onClose={() => {
            setBidTarget(null);
            setBidFeedback(null);
            setBidResult(null);
            setBidProjection(null);
          }}
        />
      )}
      {counterTarget && (
        <TransferCounterOfferModal
          counterTarget={counterTarget}
          teams={gameState.teams}
          counterAmount={counterAmount}
          onCounterAmountChange={setCounterAmount}
          counterFeedback={counterFeedback}
          activeCounterOffer={activeCounterOffer}
          counterResult={counterResult}
          counterError={counterError}
          counterLoading={counterLoading}
          onSubmit={handleCounterOffer}
          onClose={() => {
            setCounterTarget(null);
            setCounterAmount("");
            setCounterError(null);
            setCounterResult(null);
            setCounterFeedback(null);
          }}
        />
      )}
    </div>
  );
}
