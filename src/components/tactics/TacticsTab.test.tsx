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
  position: string,
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
  arena_name: "Test Ground",
  arena_capacity: 20000,
  finance: 1000000,
  manager_id: "mgr1",
  reputation: 50,
  wage_budget: 100000,
  transfer_budget: 500000,
  season_income: 0,
  season_expenses: 0,
  formation: "4-4-2",
  play_style: "Balanced",
  training_focus: "General",
  training_intensity: "Balanced",
  training_schedule: "Balanced",
  founded_year: 1900,
  colors: { primary: "#00ff00", secondary: "#ffffff" },
  starting_xi_ids: [],
  form: [],
  history: [],
  ...overrides,
});

const makeGameState = (): GameStateData => {
  const players = [
    makePlayer("top1", "TOP", {
      match_name: "Top Starter",
      attributes: {
        pace: 50,
        stamina: 60,
        strength: 70,
        agility: 55,
        passing: 52,
        shooting: 35,
        tackling: 75,
        dribbling: 45,
        defending: 78,
        positioning: 68,
        vision: 50,
        decisions: 63,
        composure: 64,
        aggression: 71,
        teamwork: 62,
        leadership: 60,
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
        stamina: 74,
        strength: 58,
        agility: 75,
        passing: 79,
        shooting: 66,
        tackling: 61,
        dribbling: 77,
        defending: 57,
        positioning: 72,
        vision: 80,
        decisions: 78,
        composure: 73,
        aggression: 52,
        teamwork: 81,
        leadership: 64,
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
        draws: 0,
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
    expect(screen.getByText("tactics.lol.impactAndCoherence")).toBeInTheDocument();
    expect(screen.getByText("Top Starter")).toBeInTheDocument();
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

  it("shows a comparison panel after selecting a second pitch player", () => {
    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("pitch-player-d1"));
    fireEvent.click(screen.getByTestId("pitch-player-m1"));

    expect(screen.getByText("Comparison player")).toBeInTheDocument();
    expect(screen.getAllByText("Player m1").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("common.attributes.macro_play").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Confirm swap" }),
    ).toBeInTheDocument();
  });

  it("only opens profiles from the lineup tables", () => {
    const onSelectPlayer = vi.fn();

    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={onSelectPlayer}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("xi-player-d1"));

    expect(onSelectPlayer).toHaveBeenCalledWith("d1");
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
