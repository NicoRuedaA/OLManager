import type { PlayerData, StaffData, TeamData } from "../store/gameStore";

export type FinanceHealthLevel = "stable" | "watch" | "warning" | "critical";

export interface TeamFinanceSnapshot {
  annualWageBill: number;
  annualWageBudget: number;
  annualSponsorIncome: number;
  weeklyWageBudget: number;
  projectedAnnualNet: number;
  cashRunwayWeeks: number | null;
  wageBudgetUsagePercent: number;
  wageBudgetStatus: FinanceHealthLevel;
  runwayStatus: FinanceHealthLevel;
  overallStatus: FinanceHealthLevel;
}

const HEALTH_PRIORITY: Record<FinanceHealthLevel, number> = {
  stable: 0,
  watch: 1,
  warning: 2,
  critical: 3,
};

export function getAnnualWageBill(
  players: PlayerData[],
  staff: StaffData[] = [],
): number {
  return [...players, ...staff].reduce((sum, person) => {
    return sum + Math.max(0, person.wage);
  }, 0);
}
export function annualAmountToWeeklyCommitment(amount: number): number {
  return Math.floor(Math.max(0, amount) / 52);
}
export function getCashRunwayWeeks(
  balance: number,
  projectedAnnualNet: number,
): number | null {
  const projectedWeeklyNet = projectedAnnualNet / 52;
  if (projectedWeeklyNet >= 0) {
    return null;
  }

  return Math.max(0, Math.floor(balance / Math.abs(projectedWeeklyNet)));
}

function getWageBudgetStatus(usagePercent: number): FinanceHealthLevel {
  if (usagePercent > 110) {
    return "critical";
  }

  if (usagePercent > 100) {
    return "warning";
  }

  if (usagePercent >= 85) {
    return "watch";
  }

  return "stable";
}

function getRunwayStatus(
  balance: number,
  runwayWeeks: number | null,
): FinanceHealthLevel {
  if (balance < 0) {
    return "critical";
  }

  if (runwayWeeks === null) {
    return "stable";
  }

  if (runwayWeeks <= 4) {
    return "critical";
  }

  if (runwayWeeks <= 8) {
    return "warning";
  }

  if (runwayWeeks <= 12) {
    return "watch";
  }

  return "stable";
}

function getMostSevereLevel(
  left: FinanceHealthLevel,
  right: FinanceHealthLevel,
): FinanceHealthLevel {
  return HEALTH_PRIORITY[left] >= HEALTH_PRIORITY[right] ? left : right;
}

export function getTeamFinanceSnapshot(
  team: TeamData,
  players: PlayerData[],
  staff: StaffData[] = [],
): TeamFinanceSnapshot {
  const annualWageBill = getAnnualWageBill(players, staff);
  const annualWageBudget = team.wage_budget;
  const annualSponsorIncome = (team.sponsorship?.base_value ?? 0) * 52;
  const projectedAnnualNet = annualSponsorIncome - annualWageBill;
  const cashRunwayWeeks = getCashRunwayWeeks(team.finance, projectedAnnualNet);
  const wageBudgetUsagePercent = Math.round(
    (annualWageBill / Math.max(1, team.wage_budget)) * 100,
  );
  const wageBudgetStatus = getWageBudgetStatus(wageBudgetUsagePercent);
  const runwayStatus = getRunwayStatus(team.finance, cashRunwayWeeks);

  return {
    annualWageBill,
    annualWageBudget,
    annualSponsorIncome,
    projectedAnnualNet,
    cashRunwayWeeks,
    wageBudgetUsagePercent,
    wageBudgetStatus,
    runwayStatus,
    overallStatus: getMostSevereLevel(wageBudgetStatus, runwayStatus),
  };
}