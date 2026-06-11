import type { FinancialTransactionData, PlayerData, StaffData, TeamData } from "../../store/gameStore";

export type FinanceHealthLevel = "stable" | "watch" | "warning" | "critical";

export interface TeamFinanceSnapshot {
  annualWageBill: number;
  annualWageBudget: number;
  annualSponsorIncome: number;
  monthlyWageBudget: number;
  projectedAnnualNet: number;
  cashRunwayMonths: number | null;
  wageBudgetUsagePercent: number;
  wageBudgetStatus: FinanceHealthLevel;
  runwayStatus: FinanceHealthLevel;
  overallStatus: FinanceHealthLevel;
}

export interface TransferBudgetSummary {
  spend: number;
  remaining: number;
  total: number;
  usagePercent: number;
}

export interface SeasonNetSummary {
  income: number;
  expenses: number;
  net: number;
}

const HEALTH_PRIORITY: Record<FinanceHealthLevel, number> = {
  stable: 0,
  watch: 1,
  warning: 2,
  critical: 3,
};

export function safeFinanceNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function getFinancialLedger(team: Pick<TeamData, "financial_ledger">): FinancialTransactionData[] {
  return team.financial_ledger ?? [];
}

export function getSeasonNetSummary(team: Pick<TeamData, "season_income" | "season_expenses">): SeasonNetSummary {
  const income = safeFinanceNumber(team.season_income);
  const expenses = safeFinanceNumber(team.season_expenses);

  return {
    income,
    expenses,
    net: income - expenses,
  };
}

export function getTransferBudgetSummary(
  team: Pick<TeamData, "transfer_budget" | "financial_ledger">,
): TransferBudgetSummary {
  const remaining = Math.max(0, safeFinanceNumber(team.transfer_budget));
  const spend = getFinancialLedger(team).reduce((total, entry) => {
    if (entry.kind !== "TransferPurchase") {
      return total;
    }

    return total + Math.max(0, -safeFinanceNumber(entry.amount));
  }, 0);
  const total = spend + remaining;

  return {
    spend,
    remaining,
    total,
    usagePercent: total > 0 ? Math.round((spend / total) * 100) : 0,
  };
}

export function getAnnualWageBill(
  players: PlayerData[],
  staff: StaffData[] = [],
): number {
  return [...players, ...staff].reduce((sum, person) => {
    return sum + Math.max(0, safeFinanceNumber(person.wage));
  }, 0);
}
export function annualAmountToMonthlyCommitment(amount: unknown): number {
  return Math.floor(Math.max(0, safeFinanceNumber(amount)) / 12);
}
export function getCashRunwayMonths(
  balance: unknown,
  projectedAnnualNet: unknown,
): number | null {
  const safeBalance = safeFinanceNumber(balance);
  const projectedMonthlyNet = safeFinanceNumber(projectedAnnualNet) / 12;
  if (projectedMonthlyNet >= 0) {
    return null;
  }

  return Math.max(0, Math.floor(safeBalance / Math.abs(projectedMonthlyNet)));
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
  runwayMonths: number | null,
): FinanceHealthLevel {
  if (balance < 0) {
    return "critical";
  }

  if (runwayMonths === null) {
    return "stable";
  }

  if (runwayMonths <= 4) {
    return "critical";
  }

  if (runwayMonths <= 8) {
    return "warning";
  }

  if (runwayMonths <= 12) {
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
  const annualWageBudget = safeFinanceNumber(team.wage_budget);
  const annualSponsorIncome = safeFinanceNumber(team.sponsorship?.base_value);
  const projectedAnnualNet = annualSponsorIncome - annualWageBill;
  const finance = safeFinanceNumber(team.finance);
  const monthlyWageBudget = annualAmountToMonthlyCommitment(annualWageBudget);
  const cashRunwayMonths = getCashRunwayMonths(finance, projectedAnnualNet);
  const wageBudgetUsagePercent = Math.round(
    (annualWageBill / Math.max(1, annualWageBudget)) * 100,
  );
  const wageBudgetStatus = getWageBudgetStatus(wageBudgetUsagePercent);
  const runwayStatus = getRunwayStatus(finance, cashRunwayMonths);

  return {
    annualWageBill,
    annualWageBudget,
    annualSponsorIncome,
    monthlyWageBudget,
    projectedAnnualNet,
    cashRunwayMonths,
    wageBudgetUsagePercent,
    wageBudgetStatus,
    runwayStatus,
    overallStatus: getMostSevereLevel(wageBudgetStatus, runwayStatus),
  };
}
