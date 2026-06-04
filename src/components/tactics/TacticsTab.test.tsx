import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import type { GameStateData, PlayerData, TeamData } from "../../store/gameStore";
import TacticsTab from "./TacticsTab";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === "string" ? fallback : key,
    i18n: { language: "en" },
  }),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);

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
    mental_resilience: 60,
    strength: 60,
    champion_pool: 60,
    passing: 60,
    laning: 60,
    tackling: 60,
    mechanics: 60,
    defending: 60,
    positioning: 60,
    macro_play: 60,
    consistency: 60,
    discipline: 60,
    aggression: 60,
    teamfighting: 60,
    shotcalling: 60,
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
  active_lineup_ids: [],
  form: [],
  history: [],
  ...overrides,
});

const makeGameState = (): GameStateData => {
  const players = [
    makePlayer("top1", "TOP", {
      match_name: "Top Starter",
      attributes: {
        pace: 30,
        mental_resilience: 80,
        strength: 30,
        champion_pool: 80,
        passing: 30,
        laning: 80,
        tackling: 30,
        mechanics: 80,
        defending: 30,
        positioning: 30,
        macro_play: 80,
        consistency: 80,
        discipline: 80,
        aggression: 30,
        teamfighting: 80,
        shotcalling: 80,
        handling: 10,
        reflexes: 10,
        aerial: 15,
      },
    }),
    makePlayer("jng1", "JUNGLE", { match_name: "Jungle Starter" }),
    makePlayer("mid1", "MID", {
      match_name: "Mid Starter",
      attributes: {
        pace: 70,
        mental_resilience: 74,
        strength: 58,
        champion_pool: 75,
        passing: 79,
        laning: 66,
        tackling: 61,
        mechanics: 77,
        defending: 57,
        positioning: 72,
        macro_play: 80,
        consistency: 78,
        discipline: 73,
        aggression: 52,
        teamfighting: 81,
        shotcalling: 64,
        handling: 10,
        reflexes: 10,
        aerial: 10,
      },
    }),
    makePlayer("adc1", "ADC", { match_name: "ADC Starter" }),
    makePlayer("sup1", "SUPPORT", { match_name: "Support Starter" }),
    makePlayer("bench1", "TOP", { match_name: "Bench Top" }),
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
        active_lineup_ids: [
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
    leagues: [],
    scouting_assignments: [],
    board_objectives: [],
  };
};

describe("TacticsTab", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
    mockedInvoke.mockResolvedValue(makeGameState());
  });

  it("renders the current LoL game-plan controls and role impact panel", () => {
    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("tactics.lol.gamePlan")).toBeInTheDocument();
    expect(screen.getByText("Game timing")).toBeInTheDocument();
    expect(screen.getByText("Strong side")).toBeInTheDocument();
    expect(screen.getByText("Jungle style")).toBeInTheDocument();
    expect(screen.getByText("Support roaming")).toBeInTheDocument();
    expect(screen.getAllByText("tactics.lol.impactAndCoherence").length).toBeGreaterThan(0);
    expect(screen.getByText("Top Starter")).toBeInTheDocument();
    expect(screen.getByText("80 OVR · Top lane")).toBeInTheDocument();
    expect(screen.getByText("Support Starter")).toBeInTheDocument();
  });

  it("persists game timing changes through the LoL tactics command", async () => {
    const onGameUpdate = vi.fn();

    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={onGameUpdate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Early game/ }));

    await waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("set_lol_tactics", {
        lolTactics: expect.objectContaining({
          game_timing: "Early",
        }),
      });
    });

    await waitFor(() => {
      expect(onGameUpdate).toHaveBeenCalledWith(makeGameState());
    });
  });

  it("persists support roaming changes with the current tactics payload", async () => {
    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Roam mid/ }));

    await waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("set_lol_tactics", {
        lolTactics: expect.objectContaining({
          support_roaming: "RoamMid",
        }),
      });
    });
  });

  it("uses legacy starting_xi_ids when active_lineup_ids is absent", () => {
    const gameState = makeGameState();
    gameState.teams[0] = makeTeam({
      active_lineup_ids: undefined,
      starting_xi_ids: ["top1", "jng1", "mid1", "adc1", "sup1"],
    });

    render(
      <TacticsTab
        gameState={gameState}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("Top Starter")).toBeInTheDocument();
    expect(screen.getByText("Support Starter")).toBeInTheDocument();
  });

  it("prefers active_lineup_ids over legacy starting_xi_ids", () => {
    const gameState = makeGameState();
    gameState.teams[0] = makeTeam({
      active_lineup_ids: ["bench1", "jng1", "mid1", "adc1", "sup1"],
      starting_xi_ids: ["top1", "jng1", "mid1", "adc1", "sup1"],
    });

    render(
      <TacticsTab
        gameState={gameState}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("Bench Top")).toBeInTheDocument();
  });

  it("persists default set piece and team role assignments from the roles tab", async () => {
    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("Game timing")).toBeInTheDocument();
    expect(screen.queryByTestId("pitch-player-top1")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set pieces & roles" })).not.toBeInTheDocument();
  });
});
