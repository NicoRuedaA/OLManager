import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GameStateData, PlayerData, TeamData } from "../../store/gameStore";
import SquadTab from "./SquadTab";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) => {
      if (key === "common.renewContract") return "Renew Contract";
      if (key === "playerProfile.yearsRemaining") return "Years Remaining";
      if (key === "finances.contractRisk") return "Contract Risk";
      if (key === "finances.contractRiskCritical") return "Critical";
      if (key === "finances.contractRiskWarning") return "Warning";
      if (key === "finances.contractExpiresOn")
        return `Expires ${String((fallback as Record<string, unknown> | undefined)?.date ?? "")}`;
      if (typeof fallback === "object" && typeof fallback.defaultValue === "string") {
        return fallback.defaultValue;
      }
      return typeof fallback === "string" ? fallback : key;
    },
    i18n: { language: "en" },
  }),
}));

const makePlayer = (
  id: string,
  position: PlayerData["position"],
  overrides: Partial<PlayerData> = {},
): PlayerData => ({
  id,
  match_name: id.toUpperCase(),
  full_name: `Player ${id}`,
  date_of_birth: "1998-01-01",
  nationality: "GB",
  position,
  natural_position: position,
  alternate_positions: [],
  training_focus: null,
  attributes: {
    pace: 60,
    stamina: 60,
    strength: 60,
    agility: 60,
    passing: 60,
    shooting: 60,
    tackling: 60,
    dribbling: 60,
    defending: 60,
    positioning: 60,
    vision: 60,
    decisions: 60,
    composure: 60,
    aggression: 60,
    teamwork: 60,
    leadership: 60,
    handling: 60,
    reflexes: 60,
    aerial: 60,
  },
  condition: 100,
  morale: 80,
  injury: null,
  team_id: "team1",
  contract_end: "2027-06-30",
  wage: 1000,
  market_value: 100000,
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
});

const makeTeam = (overrides: Partial<TeamData> = {}): TeamData => ({
  id: "team1",
  name: "Test FC",
  short_name: "TFC",
  country: "England",
  city: "Test City",
  stadium_name: "Test Ground",
  stadium_capacity: 20000,
  finance: 1000000,
  manager_id: "mgr1",
  reputation: 50,
  wage_budget: 100000,
  transfer_budget: 500000,
  season_income: 0,
  season_expenses: 0,
  draft_strategy: "Balanced",
  training_focus: "General",
  training_intensity: "Balanced",
  training_schedule: "Balanced",
  founded_year: 1900,
  colors: { primary: "#00ff00", secondary: "#ffffff" },
  starting_xi_ids: [
    "top1",
    "jng1",
    "mid1",
    "adc1",
    "sup1",
  ],
  form: [],
  history: [],
  ...overrides,
});

const makeGameState = (): GameStateData => {
  const players = [
    makePlayer("top1", "TOP"),
    makePlayer("jng1", "JUNGLE"),
    makePlayer("mid1", "MID"),
    makePlayer("adc1", "ADC"),
    makePlayer("sup1", "SUPPORT"),
    makePlayer("adc2", "ADC", { match_name: "Bench ADC" }),
  ];

  return {
    clock: {
      current_date: "2026-08-01",
      start_date: "2026-08-01",
    },
    manager: {
      id: "mgr1",
      first_name: "Test",
      last_name: "Manager",
      date_of_birth: "1980-01-01",
      nationality: "GB",
      reputation: 50,
      satisfaction: 50,
      fan_approval: 50,
      team_id: "team1",
      career_stats: {
        matches_managed: 0,
        wins: 0,
        losses: 0,
        trophies: 0,
        best_finish: null,
      },
      career_history: [],
    },
    teams: [
      makeTeam({
        starting_xi_ids: [
          "top1",
          "jng1",
          "mid1",
          "adc1",
          "sup1",
        ],
      }),
    ],
    players,
    staff: [],
    messages: [],
    news: [],
    league: null,
    scouting_assignments: [],
    board_objectives: [],
  };
};

describe("SquadTab", () => {
  it("renders a five-role LoL active lineup and keeps bench players visible", () => {
    render(
      <SquadTab
        gameState={makeGameState()}
        managerId="mgr1"
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("Active Lineup")).toBeInTheDocument();
    expect(screen.getByText("Bench / Substitutes")).toBeInTheDocument();
    expect(screen.getByText("Bench ADC")).toBeInTheDocument();

    const activeLineup = screen.getByTestId("active-lineup");
    for (const role of ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"]) {
      expect(within(activeLineup).getByText(role)).toBeInTheDocument();
    }

    expect(screen.queryByText(/Starting XI/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pitch/i)).not.toBeInTheDocument();
    expect(screen.queryByText("4-4-2")).not.toBeInTheDocument();
    expect(screen.queryByText("GK")).not.toBeInTheDocument();
    expect(screen.queryByText("DEF")).not.toBeInTheDocument();
    expect(screen.queryByText("FWD")).not.toBeInTheDocument();
    expect(screen.queryByText("What this changes")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pitch-slot-1")).not.toBeInTheDocument();
  });

  it("shows missing role coverage clearly in the active lineup", () => {
    const gameState = makeGameState();
    gameState.players = gameState.players.filter((player) => player.natural_position !== "SUPPORT");

    render(
      <SquadTab
        gameState={gameState}
        managerId="mgr1"
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    const supportSlot = screen.getByTestId("active-lineup-role-SUPPORT");
    expect(within(supportSlot).getByText("SUPPORT")).toBeInTheDocument();
    expect(within(supportSlot).getByText("Missing role coverage")).toBeInTheDocument();
  });

  it("keeps substitute player cards usable from the bench roster", () => {
    const onSelectPlayer = vi.fn();
    const gameState = makeGameState();

    render(
      <SquadTab
        gameState={gameState}
        managerId="mgr1"
        onSelectPlayer={onSelectPlayer}
        onGameUpdate={vi.fn()}
      />,
    );

    const benchCard = screen.getByText("Bench ADC").closest("button");
    expect(benchCard).not.toBeNull();
    fireEvent.click(benchCard as HTMLButtonElement);

    expect(onSelectPlayer).toHaveBeenCalledWith("adc2");
  });
});
