import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Lock,
  RefreshCw,
  User,
} from "lucide-react";

import type { GameStateData, MessageAction, MessageData, PlayerSelectionOptions } from "@/store/gameStore";
import { resolveMessage } from "@/lib/i18n/backendI18n";
import {
  formatVal,
  getContractRiskLevel,
  getContractYearsRemaining,
} from "@/lib/common/helpers";
import { safeFinanceNumber, getTeamFinanceSnapshot } from "@/lib/finances/finance";
import type { FacilityUpgradeId } from "@/lib/finances/lolFinanceContracts";
import {
  getClubInstallationContract,
  getSponsorshipContractView,
} from "@/lib/finances/lolFinanceContracts";
import { getLolRoleForPlayer } from "@/components/squad/SquadTab.helpers";
import { resolvePlayerPhoto } from "@/lib/players/playerPhotos";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui-v2/components/ui/card";
import { Badge } from "@/ui-v2/components/ui/badge";
import { cn } from "@/ui-v2/lib/utils";

interface FinancesTabV2Props {
  gameState: GameStateData;
  onGameUpdate: (state: GameStateData) => void;
  onSelectPlayer?: (id: string, options?: PlayerSelectionOptions) => void;
}

function formatCurrencyAmountParam(value: number): string {
  return value.toLocaleString();
}

function getFacilityUpgradeCost(level: number): number {
  return level * 250_000;
}

function getMainHubExpansionCost(level: number): number {
  return level * 500_000;
}

function isChooseOptionAction(actionType: MessageAction["action_type"]) {
  return typeof actionType === "object" && "ChooseOption" in actionType;
}

function isPendingSponsorOffer(message: MessageData): boolean {
  return (
    message.id.startsWith("sponsor_") &&
    message.category === "Finance" &&
    message.actions.some((a) => !a.resolved && isChooseOptionAction(a.action_type))
  );
}

type SortKey = "name" | "position" | "wage" | "value" | "contract";

export function FinancesTabV2({ gameState, onGameUpdate, onSelectPlayer }: FinancesTabV2Props) {
  const { t } = useTranslation();
  const annualSuffix = t("finances.perYearSuffix", "/yr");

  const myTeam = gameState.teams.find((tm) => tm.id === gameState.manager.team_id);
  const roster = myTeam ? gameState.players.filter((p) => p.team_id === myTeam.id) : [];
  const teamStaff = myTeam
    ? gameState.staff.filter((s) => s.team_id === myTeam.id)
    : [];

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [delegatedRenewalsSummary, setDelegatedRenewalsSummary] = useState<string | null>(null);
  const [selectedRiskPlayerIds, setSelectedRiskPlayerIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("wage");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "wage" || key === "value" ? "desc" : "asc");
    }
  };

  const teamBalance = safeFinanceNumber(myTeam?.finance);
  const teamWageBudget = safeFinanceNumber(myTeam?.wage_budget);
  const teamTransferBudget = safeFinanceNumber(myTeam?.transfer_budget);
  const teamSeasonIncome = safeFinanceNumber(myTeam?.season_income);
  const teamSeasonExpenses = safeFinanceNumber(myTeam?.season_expenses);
  const totalValue = roster.reduce((s, p) => s + safeFinanceNumber(p.market_value), 0);

  const financeSnapshot = myTeam
    ? getTeamFinanceSnapshot(myTeam, roster, teamStaff)
    : {
        annualWageBill: 0, annualWageBudget: 0, annualSponsorIncome: 0,
        weeklyWageBudget: 0, projectedAnnualNet: 0, cashRunwayMonths: null,
        wageBudgetUsagePercent: 0, wageBudgetStatus: "stable" as const,
        runwayStatus: "stable" as const, overallStatus: "stable" as const,
      };
  const totalWages = financeSnapshot.annualWageBill;
  const annualWageBudget = financeSnapshot.annualWageBudget;
  const annualSponsorIncome = financeSnapshot.annualSponsorIncome;
  const projectedAnnualNet = financeSnapshot.projectedAnnualNet;
  const cashRunwayMonths = financeSnapshot.cashRunwayMonths;
  const installationContract = myTeam ? getClubInstallationContract(myTeam) : [];
  const mainHubLevel = installationContract.reduce((max, m) => Math.max(max, m.level), 1);
  const nextHubExpansionCost = getMainHubExpansionCost(mainHubLevel);
  const canExpandMainHub = teamBalance >= nextHubExpansionCost;
  const activeSponsorship = getSponsorshipContractView(myTeam?.sponsorship);
  const sponsorOffers = gameState.messages.filter(isPendingSponsorOffer).map(resolveMessage);

  const contractRiskPlayers = useMemo(
    () =>
      roster
        .map((player) => {
          const riskLevel = getContractRiskLevel(player.contract_end, gameState.clock.current_date);
          return { player, riskLevel };
        })
        .filter(({ riskLevel, player }) => player.contract_end && riskLevel !== "stable")
        .sort((a, b) => (a.player.contract_end ?? "9999-12-31").localeCompare(b.player.contract_end ?? "9999-12-31")),
    [roster, gameState.clock.current_date],
  );
  const atRiskWages = contractRiskPlayers.reduce((s, { player }) => s + safeFinanceNumber(player.wage), 0);
  const allRiskPlayerIds = contractRiskPlayers.map(({ player }) => player.id);
  const selectedRiskPlayers = contractRiskPlayers.filter(({ player }) => selectedRiskPlayerIds.includes(player.id));

  useEffect(() => {
    setSelectedRiskPlayerIds((current) => {
      const available = new Set(allRiskPlayerIds);
      const next = current.filter((id) => available.has(id));
      return next.length > 0 ? next : allRiskPlayerIds;
    });
  }, [allRiskPlayerIds.join("|")]);

  const handleToggleRiskPlayer = (playerId: string) =>
    setSelectedRiskPlayerIds((current) =>
      current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId],
    );

  const handleToggleAllRiskPlayers = () =>
    setSelectedRiskPlayerIds((current) =>
      current.length === allRiskPlayerIds.length ? [] : allRiskPlayerIds,
    );

  const handleUpgradeFacility = async (facility: FacilityUpgradeId) => {
    setActionLoading(facility);
    try {
      const updated = await invoke<GameStateData>("upgrade_main_facility_module", { module: facility });
      onGameUpdate(updated);
    } catch (err) {
      console.error("Failed to upgrade facility:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleExpandMainHub = async () => {
    setActionLoading("expand-main-hub");
    try {
      const updated = await invoke<GameStateData>("expand_main_facility_hub");
      onGameUpdate(updated);
    } catch (err) {
      console.error("Failed to expand hub:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelegateRenewals = async () => {
    if (selectedRiskPlayers.length === 0) return;
    const loadingKey = "delegate-renewals";
    setActionLoading(loadingKey);
    setDelegatedRenewalsSummary(null);
    try {
      const result = await invoke<{
        game: GameStateData;
        report: { success_count: number; failure_count: number; stalled_count: number };
      }>("delegate_renewals", {
        playerIds: selectedRiskPlayers.map(({ player }) => player.id),
        maxWageIncreasePct: 35,
        maxContractYears: 3,
      });
      onGameUpdate(result.game);
      setDelegatedRenewalsSummary(
        t("finances.delegatedRenewalsSummary", {
          successes: result.report.success_count,
          stalled: result.report.stalled_count,
          failures: result.report.failure_count,
        }),
      );
    } catch (err) {
      console.error("Failed to delegate renewals:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSponsorOption = async (messageId: string, actionId: string, optionId: string) => {
    const loadingKey = `sponsor:${messageId}:${optionId}`;
    setActionLoading(loadingKey);
    try {
      const result = await invoke<{ game: GameStateData }>("resolve_message_action", {
        messageId,
        actionId,
        optionId,
      });
      onGameUpdate(result.game);
    } catch (err) {
      console.error("Failed to resolve sponsor offer:", err);
    } finally {
      setActionLoading(null);
    }
  };

  if (!myTeam) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="font-heading text-sm uppercase tracking-wider text-muted-foreground">
          {t("common.noTeam")}
        </p>
      </div>
    );
  }

  const sortedRoster = [...roster].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "name": return dir * a.match_name.localeCompare(b.match_name);
      case "position": return dir * getLolRoleForPlayer(a).localeCompare(getLolRoleForPlayer(b));
      case "wage": return dir * (safeFinanceNumber(a.wage) - safeFinanceNumber(b.wage));
      case "value": return dir * (safeFinanceNumber(a.market_value) - safeFinanceNumber(b.market_value));
      case "contract": return dir * (a.contract_end || "").localeCompare(b.contract_end || "");
      default: return 0;
    }
  });

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      {/* Overview */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
            {t("finances.overview")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {[
              { label: t("finances.clubBalance"), value: teamBalance, color: teamBalance >= 0 ? "text-emerald-400" : "text-red-400" },
              { label: t("finances.wageBudget"), value: teamWageBudget, color: "text-foreground" },
              { label: t("finances.transferBudget"), value: teamTransferBudget, color: "text-foreground" },
              { label: t("finances.seasonIncome"), value: teamSeasonIncome, color: "text-emerald-400" },
              { label: t("finances.seasonExpenses"), value: teamSeasonExpenses, color: "text-red-400" },
              { label: t("finances.squadValue"), value: totalValue, color: "text-foreground" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="font-heading text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
                <p className={cn("mt-1 font-heading text-lg font-bold tabular-nums", item.color)}>
                  {formatVal(item.value)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Wage Bill + Cash Flow */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-0">
            <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
              {t("finances.wageBill")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="font-heading text-2xl font-bold tabular-nums text-foreground">
              €{totalWages.toLocaleString()}{annualSuffix}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("finances.budget")}: €{annualWageBudget.toLocaleString()}{annualSuffix}
              {totalWages <= annualWageBudget ? (
                <span className="ml-1 text-emerald-400">— {t("finances.underBudget")}</span>
              ) : (
                <span className="ml-1 inline-flex items-center gap-1 text-red-400">
                  <AlertTriangle className="size-3" /> {t("finances.overBudget")}
                </span>
              )}
            </p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all", totalWages <= annualWageBudget ? "bg-emerald-400" : "bg-red-400")}
                style={{ width: `${Math.min(100, Math.round((totalWages / Math.max(1, annualWageBudget)) * 100))}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0">
            <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
              {t("finances.cashFlow")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="font-heading text-[10px] uppercase tracking-wider text-muted-foreground">{t("finances.annualWageSpend")}</p>
                <p className="mt-1 font-heading text-lg font-bold text-red-400 tabular-nums">€{totalWages.toLocaleString()}{annualSuffix}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="font-heading text-[10px] uppercase tracking-wider text-muted-foreground">{t("finances.annualSponsorIncome")}</p>
                <p className="mt-1 font-heading text-lg font-bold text-emerald-400 tabular-nums">€{annualSponsorIncome.toLocaleString()}{annualSuffix}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="font-heading text-[10px] uppercase tracking-wider text-muted-foreground">{t("finances.projectedAnnualNet")}</p>
                <p className={cn("mt-1 font-heading text-lg font-bold tabular-nums", projectedAnnualNet >= 0 ? "text-emerald-400" : "text-red-400")}>
                  €{projectedAnnualNet.toLocaleString()}{annualSuffix}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="font-heading text-[10px] uppercase tracking-wider text-muted-foreground">{t("finances.cashRunway")}</p>
                <p className={cn("mt-1 font-heading text-sm font-bold tabular-nums", cashRunwayMonths !== null && cashRunwayMonths < 52 ? "text-red-400" : "text-foreground")}>
                  {cashRunwayMonths === null ? t("finances.runwayStable") : t("finances.runwayMonths", { count: cashRunwayMonths })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contract Risk */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
            {t("finances.contractRisk")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("finances.atRiskWages", { amount: formatVal(atRiskWages) })}
            </p>
            {contractRiskPlayers.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleToggleAllRiskPlayers}
                  className="rounded-md border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted"
                >
                  {t("finances.selectAllAtRisk")}
                </button>
                <button
                  type="button"
                  disabled={actionLoading === "delegate-renewals" || selectedRiskPlayers.length === 0}
                  onClick={handleDelegateRenewals}
                  className="rounded-md border border-primary bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20 disabled:pointer-events-none disabled:opacity-50"
                >
                  {actionLoading === "delegate-renewals" ? (
                    <RefreshCw className="mr-1 inline size-3 animate-spin" />
                  ) : null}
                  {t("finances.delegateSelectedRenewals")}
                </button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {delegatedRenewalsSummary && (
            <p className="mb-3 text-xs text-emerald-400">{delegatedRenewalsSummary}</p>
          )}
          {contractRiskPlayers.length > 0 ? (
            <div className="space-y-2">
              {contractRiskPlayers.map(({ player, riskLevel }) => (
                <div
                  key={player.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <input
                    type="checkbox"
                    checked={selectedRiskPlayerIds.includes(player.id)}
                    onChange={() => handleToggleRiskPlayer(player.id)}
                    className="size-4 accent-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{player.match_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("finances.contractExpiresOn", { date: player.contract_end })} —{" "}
                      {t("playerProfile.yearsRemaining")}:{" "}
                      {getContractYearsRemaining(player.contract_end, gameState.clock.current_date)}
                    </p>
                  </div>
                  <Badge variant={riskLevel === "critical" ? "destructive" : "secondary"} className="text-[10px]">
                    {riskLevel === "critical" ? t("finances.contractRiskCritical") : t("finances.contractRiskWarning")}
                  </Badge>
                  <p className="text-xs font-medium tabular-nums text-foreground">
                    €{safeFinanceNumber(player.wage).toLocaleString()}{annualSuffix}
                  </p>
                  {onSelectPlayer && (
                    <button
                      type="button"
                      onClick={() => onSelectPlayer(player.id, { openRenewal: true })}
                      className="rounded-md border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted"
                    >
                      {t("common.renewContract")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("finances.noContractRisks")}</p>
          )}
        </CardContent>
      </Card>

      {/* Sponsors */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-0">
            <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
              {t("finances.activeSponsor")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeSponsorship ? (
              <div className="space-y-1">
                <h3 className="font-heading text-base font-bold uppercase tracking-wide text-foreground">
                  {activeSponsorship.sponsorName}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("finances.sponsorWeeklyValue", { amount: Math.round(activeSponsorship.baseValue / 12) })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("finances.sponsorRemainingMonths", { count: activeSponsorship.remainingMonths })}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("finances.noActiveSponsor")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0">
            <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
              {t("finances.pendingSponsorOffers")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sponsorOffers.length > 0 ? (
              <div className="space-y-3">
                {sponsorOffers.map((message) => {
                  const sponsorAction = message.actions.find(
                    (a) => !a.resolved && isChooseOptionAction(a.action_type),
                  );
                  if (!sponsorAction || !isChooseOptionAction(sponsorAction.action_type)) return null;
                  return (
                    <div key={message.id} className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="mb-1 text-sm font-medium text-foreground">{message.subject}</p>
                      <p className="mb-3 text-xs text-muted-foreground">{message.body}</p>
                      <div className="flex flex-wrap gap-2">
                        {sponsorAction.action_type.ChooseOption.options.map((option) => {
                          const loadingKey = `sponsor:${message.id}:${option.id}`;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              disabled={actionLoading === loadingKey}
                              onClick={() => handleSponsorOption(message.id, sponsorAction.id, option.id)}
                              className={cn(
                                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                                option.id === "decline"
                                  ? "border-border text-muted-foreground hover:bg-muted"
                                  : "border-primary bg-primary/10 text-primary hover:bg-primary/20",
                                actionLoading === loadingKey && "pointer-events-none opacity-50",
                              )}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("finances.noPendingSponsorOffers")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Facilities */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
            {t("finances.facilities")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-heading text-sm font-bold text-foreground">
                {t("finances.facilityLevel", { level: mainHubLevel })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("finances.nextUpgradeCost", { amount: nextHubExpansionCost.toLocaleString() })}
              </p>
            </div>
            <button
              type="button"
              disabled={!canExpandMainHub || actionLoading === "expand-main-hub"}
              onClick={handleExpandMainHub}
              className="rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:pointer-events-none disabled:opacity-50"
            >
              {t("finances.expandOffices")}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {installationContract.map((facility) => {
              const level = facility.level;
              const nextCost = getFacilityUpgradeCost(level);
              const unlocksNextLevel = level + 1 <= mainHubLevel;
              const canUpgrade = Boolean(facility.upgradeFacility) && unlocksNextLevel && teamBalance >= nextCost;
              const isLoading = actionLoading === facility.upgradeFacility;

              return (
                <div key={facility.key} className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
                  <div>
                    <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-foreground">
                      {t(facility.labelKey, facility.label)}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("finances.facilityLevel", { level })} — {t(facility.effectKey)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("finances.monthlyUpkeep", {
                        amount: formatCurrencyAmountParam(facility.monthlyUpkeep),
                      })}
                    </p>
                  </div>
                  <div className="mt-auto space-y-1">
                    <p className="font-heading text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t("finances.nextUpgradeCost", { amount: nextCost.toLocaleString() })}
                    </p>
                    <button
                      type="button"
                      disabled={!canUpgrade || isLoading}
                      onClick={() => facility.upgradeFacility && handleUpgradeFacility(facility.upgradeFacility)}
                      className="rounded-md border border-primary bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {isLoading ? <RefreshCw className="mr-1 inline size-3 animate-spin" /> : null}
                      {t("finances.upgradeFacility")}
                    </button>
                    {(!facility.upgradeFacility || !unlocksNextLevel) && (
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Lock className="size-3" /> {t("finances.hubExpansionRequired")}
                      </p>
                    )}
                    {canUpgrade === false && facility.upgradeFacility && unlocksNextLevel && (
                      <p className="text-[10px] text-red-400">{t("finances.insufficientFunds")}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Payroll */}
      <Card>
        <CardHeader className="space-y-0">
          <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
            {t("finances.payroll")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="w-14 px-4 py-3" />
                {(["name", "position", "wage", "value", "contract"] as const).map((key) => (
                  <th
                    key={key}
                    onClick={() => toggleSort(key)}
                    className="cursor-pointer px-4 py-3 font-heading font-bold uppercase tracking-wider hover:text-foreground"
                  >
                    <span className="inline-flex items-center gap-1">
                      {key === "name" && t("common.player")}
                      {key === "position" && t("common.position")}
                      {key === "wage" && t("finances.wagePerWeek")}
                      {key === "value" && t("finances.marketValue")}
                      {key === "contract" && t("common.contract")}
                      {sortKey === key ? (
                        sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                      ) : (
                        <ArrowUpDown className="size-3 opacity-40" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {sortedRoster.map((p) => {
                const role = getLolRoleForPlayer(p);
                const photo = resolvePlayerPhoto(p.id, p.match_name, p.profile_image_url);
                return (
                  <tr
                    key={p.id}
                    onClick={() => onSelectPlayer?.(p.id)}
                    className="cursor-pointer transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5">
                      {photo ? (
                        <img src={photo} alt={p.match_name} className="size-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                          <User className="size-4 text-muted-foreground" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-sm font-medium text-foreground">{p.match_name}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 font-heading text-[10px] uppercase tracking-wider text-muted-foreground">
                        {role}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm tabular-nums text-foreground">€{safeFinanceNumber(p.wage).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-sm tabular-nums text-muted-foreground">{formatVal(safeFinanceNumber(p.market_value))}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">
                      {p.contract_end ? t("finances.until", { year: p.contract_end.substring(0, 4) }) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
