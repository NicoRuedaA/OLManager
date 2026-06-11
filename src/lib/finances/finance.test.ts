import { describe, expect, it } from "vitest";

import type { PlayerData, StaffData, TeamData } from "../../store/gameStore";
import {
  annualAmountToMonthlyCommitment,
  getFinancialLedger,
  getAnnualWageBill,
  getCashRunwayMonths,
  getSeasonNetSummary,
  getTeamFinanceSnapshot,
  getTransferBudgetSummary,
  safeFinanceNumber,
} from "./finance";

function createTeam(overrides: Partial<TeamData> = {}): TeamData {
  return {
    id: "team-1",
    name: "Alpha FC",
    short_name: "ALP",
    country: "BR",
    city: "Rio",
    stadium_name: "Alpha Arena",
    stadium_capacity: 50000,
    finance: 180000,
    manager_id: "manager-1",
    reputation: 50,
    wage_budget: 520000,
    transfer_budget: 300000,
    season_income: 0,
    season_expenses: 0,
    draft_strategy: "Balanced",
    training_focus: "Physical",
    training_intensity: "Medium",
    training_schedule: "Balanced",
    founded_year: 1900,
    colors: {
      primary: "#111111",
      secondary: "#ffffff",
    },
    starting_xi_ids: [],
    form: [],
    history: [],
    ...overrides,
  };
}

function createPlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    id: "player-1",
    match_name: "J. Smith",
    full_name: "John Smith",
    date_of_birth: "2000-01-01",
    nationality: "BR",
    position: "Forward",
    natural_position: "Forward",
    alternate_positions: [],
    training_focus: null,
    attributes: {
      pace: 10,
      stamina: 10,
      strength: 10,
      agility: 10,
      passing: 10,
      shooting: 10,
      tackling: 10,
      dribbling: 10,
      defending: 10,
      positioning: 10,
      vision: 10,
      decisions: 10,
      composure: 10,
      aggression: 10,
      teamwork: 10,
      leadership: 10,
      handling: 10,
      reflexes: 10,
      aerial: 10,
    },
    condition: 80,
    morale: 80,
    team_id: "team-1",
    contract_end: null,
    wage: 0,
    market_value: 0,
    stats: {
      appearances: 0,
      goals: 0,
      assists: 0,
      clean_sheets: 0,
      yellow_cards: 0,
      red_cards: 0,
      avg_rating: 0,
      minutes_played: 0,
    },
    career: [],
    transfer_listed: false,
    loan_listed: false,
    transfer_offers: [],
    traits: [],
    ...overrides,
  };
}

function createStaff(overrides: Partial<StaffData> = {}): StaffData {
  return {
    id: "staff-1",
    first_name: "Pat",
    last_name: "Coach",
    date_of_birth: "1980-01-01",
    nationality: "BR",
    role: "Coach",
    attributes: {
      coaching: 10,
      judging_ability: 10,
      judging_potential: 10,
      physiotherapy: 10,
    },
    team_id: "team-1",
    specialization: null,
    wage: 0,
    contract_end: null,
    ...overrides,
  };
}

describe("finance helpers", () => {
  it("computes annual wage bill from players and staff", () => {
    const players = [
      createPlayer({ wage: 51 }),
      createPlayer({ id: "player-2", wage: 51 }),
    ];
    const staff = [createStaff({ wage: 103 })];

    expect(getAnnualWageBill(players, staff)).toBe(205);
  });

  it("computes runway from projected annual net", () => {
    expect(getCashRunwayMonths(200000, -30000 * 12)).toBe(6);
    expect(getCashRunwayMonths(200000, 5000 * 12)).toBeNull();
  });

  it("builds a finance snapshot with the worst status carried forward", () => {
    const team = createTeam({
      finance: 25000,
      wage_budget: 500000,
    });
    const players = [
      createPlayer({ wage: 300000 }),
      createPlayer({ id: "player-2", wage: 300000 }),
    ];

    const snapshot = getTeamFinanceSnapshot(team, players);

    expect(snapshot.annualWageBill).toBe(600000);
    expect(snapshot.annualWageBudget).toBe(500000);
    expect(snapshot.annualSponsorIncome).toBe(0);
    expect(snapshot.projectedAnnualNet).toBe(-600000);
    expect(snapshot.cashRunwayMonths).toBe(0);
    expect(snapshot.wageBudgetUsagePercent).toBe(120);
    expect(snapshot.wageBudgetStatus).toBe("critical");
    expect(snapshot.runwayStatus).toBe("critical");
    expect(snapshot.overallStatus).toBe("critical");
  });

  it("compares annual wage bill against annual wage budget for usage", () => {
    const team = createTeam({ wage_budget: 120000 });
    const players = [createPlayer({ wage: 60000 })];
    const staff = [createStaff({ wage: 60000 })];

    const snapshot = getTeamFinanceSnapshot(team, players, staff);

    expect(snapshot.annualWageBill).toBe(120000);
    expect(snapshot.annualWageBudget).toBe(120000);
    expect(snapshot.wageBudgetUsagePercent).toBe(100);
    expect(snapshot.wageBudgetStatus).toBe("watch");
  });

  it("exposes annual wage budget as a monthly commitment without weekly naming", () => {
    const snapshot = getTeamFinanceSnapshot(createTeam({ wage_budget: 120000 }), []);

    expect(snapshot.monthlyWageBudget).toBe(10000);
    expect("weeklyWageBudget" in snapshot).toBe(false);
  });

  it("normalizes incomplete imported finance values", () => {
    const team = createTeam({
      finance: undefined as unknown as number,
      wage_budget: undefined as unknown as number,
      sponsorship: {
        sponsor_name: "Import Sponsor",
        base_value: undefined as unknown as number,
        remaining_months: undefined as unknown as number,
        bonus_criteria: [],
      },
    });
    const players = [createPlayer({ wage: undefined as unknown as number })];
    const staff = [createStaff({ wage: Number.NaN })];

    expect(safeFinanceNumber(undefined)).toBe(0);
    expect(annualAmountToMonthlyCommitment(undefined)).toBe(0);

    const snapshot = getTeamFinanceSnapshot(team, players, staff);

    expect(snapshot.annualWageBill).toBe(0);
    expect(snapshot.annualWageBudget).toBe(0);
    expect(snapshot.annualSponsorIncome).toBe(0);
    expect(snapshot.cashRunwayMonths).toBeNull();
  });

  it("exposes readable financial ledger entries from team data", () => {
    const team = createTeam({
      financial_ledger: [
        {
          date: "2026-01-03",
          description: "Signed mid laner",
          amount: -250000,
          kind: "TransferPurchase",
        },
        {
          date: "2026-01-04",
          description: "Sold academy player",
          amount: 125000,
          kind: "TransferSale",
        },
      ],
    });

    expect(getFinancialLedger(team)).toEqual([
      {
        date: "2026-01-03",
        description: "Signed mid laner",
        amount: -250000,
        kind: "TransferPurchase",
      },
      {
        date: "2026-01-04",
        description: "Sold academy player",
        amount: 125000,
        kind: "TransferSale",
      },
    ]);
  });

  it("normalizes missing financial ledger to an empty readable history", () => {
    expect(getFinancialLedger(createTeam())).toEqual([]);
  });

  it("summarizes transfer spending against transfer budget remaining", () => {
    const summary = getTransferBudgetSummary(
      createTeam({
        transfer_budget: 750000,
        season_expenses: 2_000_000,
        financial_ledger: [
          { date: "2026-01-03", description: "Purchase", amount: -250000, kind: "TransferPurchase" },
          { date: "2026-01-04", description: "Sale", amount: 100000, kind: "TransferSale" },
          { date: "2026-01-05", description: "Wages", amount: -999999, kind: "Salary" },
        ],
      }),
    );

    expect(summary.spend).toBe(250000);
    expect(summary.remaining).toBe(750000);
    expect(summary.total).toBe(1_000_000);
    expect(summary.usagePercent).toBe(25);
  });

  it("does not compare all season expenses against transfer budget", () => {
    const summary = getTransferBudgetSummary(
      createTeam({
        transfer_budget: 750000,
        season_expenses: 2_000_000,
        financial_ledger: [],
      }),
    );

    expect(summary.spend).toBe(0);
    expect(summary.remaining).toBe(750000);
    expect(summary.total).toBe(750000);
    expect(summary.usagePercent).toBe(0);
  });

  it("summarizes season net from season income and season expenses", () => {
    expect(getSeasonNetSummary(createTeam({ season_income: 900000, season_expenses: 650000 }))).toEqual({
      income: 900000,
      expenses: 650000,
      net: 250000,
    });
  });
});
