import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ScrimPlanningCard from "./ScrimPlanningCard";
import type { GameStateData, TeamData } from "../../store/gameStore";
import { deriveWeeklyScrimContext } from "../../lib/scrimContext";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock("../../services/trainingService", () => ({
  setWeeklyScrimPlans: vi.fn(),
}));

function team(overrides: Partial<TeamData> & Pick<TeamData, "id" | "name">): TeamData {
  const { id, name, ...rest } = overrides;
  return {
    id,
    name,
    short_name: name.slice(0, 3).toUpperCase(),
    country: "ES",
    city: "Madrid",
    stadium_name: "Arena",
    stadium_capacity: 10000,
    finance: 0,
    manager_id: null,
    reputation: 500,
    wage_budget: 0,
    transfer_budget: 0,
    season_income: 0,
    season_expenses: 0,
    draft_strategy: "Balanced",
    training_focus: "Scrims",
    training_intensity: "Medium",
    training_schedule: "Balanced",
    founded_year: 2024,
    colors: { primary: "#000", secondary: "#fff" },
    starting_xi_ids: [],
    form: [],
    history: [],
    ...rest,
  };
}

function gameState(): GameStateData {
  const mine = team({
    id: "mine",
    name: "My Team",
    weekly_scrim_plan_team_ids: [["very-long"]],
    scrim_weekly_slots: 2,
  });
  const longName = "Extremely Long Opponent Name That Should Still Render Correctly In Card Layout";
  const rival = team({ id: "very-long", name: longName, weekly_scrim_plan_team_ids: [] });
  return {
    manager: { team_id: "mine" },
    teams: [mine, rival],
    players: [],
    clock: { current_date: "2026-04-28T00:00:00Z", start_date: "2026-04-01T00:00:00Z" },
  } as unknown as GameStateData;
}

describe("ScrimPlanningCard", () => {
  it("renders long opponent names in plan options", () => {
    const state = gameState();
    const mine = state.teams.find((team) => team.id === "mine")!;
    const weeklyContext = deriveWeeklyScrimContext(state, mine);

    render(
      <ScrimPlanningCard
        gameState={state}
        weeklyContext={weeklyContext}
        isSaving={false}
        setIsSaving={() => {}}
      />,
    );

    expect(screen.getByText(/Extremely Long Opponent Name/)).toBeInTheDocument();
  });
});
