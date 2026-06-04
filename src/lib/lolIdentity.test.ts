import { describe, expect, it } from "vitest";

import type { PlayerData, TeamData } from "../store/gameStore";
import { resolvePlayerCurrentLolRole } from "./lolIdentity";

function createPlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    id: "player-1",
    match_name: "Player One",
    full_name: "Player One",
    date_of_birth: "2000-01-01",
    nationality: "ES",
    position: "SUPPORT",
    natural_position: "SUPPORT",
    alternate_positions: [],
    training_focus: null,
    attributes: {},
    condition: 90,
    morale: 80,
    injury: null,
    team_id: "team-1",
    contract_end: "2027-11-01",
    wage: 1000,
    market_value: 100000,
    stats: { assists: 0 },
    career: [],
    transfer_listed: false,
    loan_listed: false,
    transfer_offers: [],
    traits: [],
    ...overrides,
  };
}

function createTeam(overrides: Partial<TeamData> = {}): TeamData {
  return {
    id: "team-1",
    name: "Team One",
    short_name: "ONE",
    country: "ES",
    city: "Madrid",
    stadium_name: "Arena",
    stadium_capacity: 10000,
    finance: 0,
    manager_id: "manager-1",
    reputation: 50,
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
    active_lineup_ids: [],
    form: [],
    history: [],
    ...overrides,
  };
}

describe("lolIdentity", () => {
  it("uses the active lineup slot as the player's current roster role", () => {
    const player = createPlayer({ id: "new-top", natural_position: "SUPPORT", position: "SUPPORT" });
    const team = createTeam({
      active_lineup_ids: ["new-top", "jungler", "mid", "adc", "support"],
    });

    expect(resolvePlayerCurrentLolRole(player, team)).toBe("TOP");
  });

  it("keeps bench players on their natural role", () => {
    const player = createPlayer({ id: "bench-support", natural_position: "SUPPORT", position: "SUPPORT" });
    const team = createTeam({
      active_lineup_ids: ["top", "jungler", "mid", "adc", "support"],
    });

    expect(resolvePlayerCurrentLolRole(player, team)).toBe("SUPPORT");
  });

  it("supports legacy starting_xi_ids when active_lineup_ids is absent", () => {
    const player = createPlayer({ id: "legacy-mid", natural_position: "SUPPORT", position: "SUPPORT" });
    const team = createTeam({
      active_lineup_ids: undefined,
      starting_xi_ids: ["top", "jungler", "legacy-mid", "adc", "support"],
    });

    expect(resolvePlayerCurrentLolRole(player, team)).toBe("MID");
  });
});
