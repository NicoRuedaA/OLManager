import { describe, expect, it } from "vitest";

import type { GameStateData, PlayerData, TeamData } from "../../store/gameStore";
import { buildScrimPlanSignals, buildStaffSuggestions, deriveWeeklyScrimContext } from "../../lib/scrimContext";

const t = ((_: string, fallback?: string) => fallback ?? "") as any;

function player(id: string, teamId: string, ovr: number): PlayerData {
  return {
    id,
    match_name: id,
    full_name: id,
    date_of_birth: "2000-01-01",
    nationality: "ES",
    position: "Midfielder",
    natural_position: "Midfielder",
    alternate_positions: [],
    training_focus: null,
    attributes: {
      pace: ovr,
      stamina: ovr,
      strength: ovr,
      agility: ovr,
      passing: ovr,
      shooting: ovr,
      tackling: ovr,
      dribbling: ovr,
      defending: ovr,
      positioning: ovr,
      vision: ovr,
      decisions: ovr,
      composure: ovr,
      aggression: ovr,
      teamwork: ovr,
      leadership: ovr,
      handling: ovr,
      reflexes: ovr,
      aerial: ovr,
    },
    condition: 100,
    morale: 100,
    injury: null,
    team_id: teamId,
    contract_end: null,
    wage: 0,
    market_value: 0,
    stats: { assists: 0 },
    career: [],
    transfer_listed: false,
    loan_listed: false,
    transfer_offers: [],
    traits: [],
  };
}

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
  const teams = [
    team({
      id: "mine",
      name: "Mine",
      scrim_reputation: 50,
      weekly_scrim_plan_team_ids: [["weak"], ["strong"]],
    }),
    team({ id: "weak", name: "Weak", scrim_reputation: 45 }),
    team({ id: "strong", name: "Strong", scrim_reputation: 72 }),
  ];

  return {
    manager: { team_id: "mine" },
    teams,
    players: [
      ...Array.from({ length: 5 }, (_, index) => player(`mine-${index}`, "mine", 75)),
      ...Array.from({ length: 5 }, (_, index) => player(`weak-${index}`, "weak", 70)),
      ...Array.from({ length: 5 }, (_, index) => player(`strong-${index}`, "strong", 82)),
    ],
    clock: { current_date: "2026-04-27" },
  } as GameStateData;
}

describe("ScrimsTab staff advice", () => {
  it("summarizes planned opponent strength and reputation", () => {
    const state = gameState();
    const mine = state.teams.find((team) => team.id === "mine")!;
    const signals = buildScrimPlanSignals(state, "mine", deriveWeeklyScrimContext(state, mine));

    expect(signals.ownOvr).toBe(75);
    expect(signals.plannedCount).toBe(2);
    expect(signals.fallbackSlotCount).toBe(0);
    expect(signals.avgOpponentOvr).toBe(76);
    expect(signals.maxOpponentOvr).toBe(82);
    expect(signals.avgOpponentScrimReputation).toBe(59);
  });

  it("warns when high-reputation rivals are planned without fallbacks", () => {
    const suggestions = buildStaffSuggestions(
      t,
      "DraftPrep",
      2,
      [],
      0,
      0,
      (() => {
        const state = gameState();
        const mine = state.teams.find((team) => team.id === "mine")!;
        return buildScrimPlanSignals(state, "mine", deriveWeeklyScrimContext(state, mine));
      })(),
      50,
    );

    expect(suggestions.join(" ")).toContain("Plan B/C");
  });
});
