import { describe, expect, it } from "vitest";
import { buildOpponentIntel } from "./opponentIntelService";

describe("buildOpponentIntel", () => {
  it("builds player pools and ban suggestions", () => {
    const intel = buildOpponentIntel({
      gameState: {
        manager: { team_id: "team-user" },
        staff: [
          {
            id: "scout-1",
            first_name: "A",
            last_name: "B",
            date_of_birth: "1990-01-01",
            nationality: "ES",
            role: "Scout",
            attributes: { coaching: 60, judging_ability: 90, judging_potential: 88, physiotherapy: 10 },
            team_id: "team-user",
            specialization: null,
            wage: 0,
            contract_end: null,
          },
        ],
        champion_masteries: [],
        champion_patch: {
          current_patch: "x",
          hidden_meta: [{ champion_id: "Ahri", tier: "S" }],
          discovered_champion_ids: [],
        },
      } as never,
      opponentTeamName: "Fnatic",
      opponentPlayers: [
        { id: "p1", name: "Humanoid" },
      ],
      teamSeeds: [{ id: "fnc", name: "Fnatic" }],
      playerSeeds: [
        { ign: "Humanoid", teamId: "fnc", role: "Mid", champions: [["Ahri", 92], ["Azir", 86]] as (string | number)[][] },
      ],
      championSeeds: [
        { id: "Ahri", name: "Ahri", roleHints: ["MID"] },
        { id: "Azir", name: "Azir", roleHints: ["MID"] },
      ],
    });

    expect(intel.playerPools).toHaveLength(1);
    expect(intel.playerPools[0].champions[0].championName).toBe("Ahri");
    expect(intel.suggestedBans[0].championName).toBe("Ahri");
    expect(intel.confidence.poolCoveragePct).toBe(100);
  });

  it("applies deterministic confidence degradation with weak staff", () => {
    const baseParams = {
      opponentTeamName: "Fnatic",
      opponentPlayers: [{ id: "p1", name: "Humanoid" }],
      teamSeeds: [{ id: "fnc", name: "Fnatic" }],
      playerSeeds: [
        { ign: "Humanoid", teamId: "fnc", role: "Mid", champions: [["Ahri", 92], ["Azir", 86], ["Syndra", 84]] as (string | number)[][] },
      ],
      championSeeds: [
        { id: "Ahri", name: "Ahri", roleHints: ["MID"] as string[] },
        { id: "Azir", name: "Azir", roleHints: ["MID"] as string[] },
        { id: "Syndra", name: "Syndra", roleHints: ["MID"] as string[] },
      ],
    } as const;

    const weak = buildOpponentIntel({
      ...baseParams,
      gameState: {
        manager: { team_id: "team-user" },
        staff: [
          {
            id: "assistant-1",
            first_name: "C",
            last_name: "D",
            date_of_birth: "1992-01-01",
            nationality: "ES",
            role: "AssistantManager",
            attributes: { coaching: 30, judging_ability: 20, judging_potential: 20, physiotherapy: 10 },
            team_id: "team-user",
            specialization: null,
            wage: 0,
            contract_end: null,
          },
        ],
        champion_masteries: [],
        champion_patch: {
          current_patch: "x",
          hidden_meta: [{ champion_id: "Ahri", tier: "S" }],
          discovered_champion_ids: [],
        },
      } as never,
    });

    const weakAgain = buildOpponentIntel({
      ...baseParams,
      gameState: {
        manager: { team_id: "team-user" },
        staff: weak ? [
          {
            id: "assistant-1",
            first_name: "C",
            last_name: "D",
            date_of_birth: "1992-01-01",
            nationality: "ES",
            role: "AssistantManager",
            attributes: { coaching: 30, judging_ability: 20, judging_potential: 20, physiotherapy: 10 },
            team_id: "team-user",
            specialization: null,
            wage: 0,
            contract_end: null,
          },
        ] : [],
        champion_masteries: [],
        champion_patch: {
          current_patch: "x",
          hidden_meta: [{ champion_id: "Ahri", tier: "S" }],
          discovered_champion_ids: [],
        },
      } as never,
    });

    expect(weak.confidence.qualityLabel).toBe("low");
    expect(weak.playerPools[0].champions).toEqual(weakAgain.playerPools[0].champions);
  });

  it("uses unified ban scoring context (jungle lock guardrail + flex exception)", () => {
    const intel = buildOpponentIntel({
      gameState: {
        manager: { team_id: "team-user" },
        staff: [
          {
            id: "scout-1",
            first_name: "A",
            last_name: "B",
            date_of_birth: "1990-01-01",
            nationality: "ES",
            role: "Scout",
            attributes: { coaching: 60, judging_ability: 90, judging_potential: 88, physiotherapy: 10 },
            team_id: "team-user",
            specialization: null,
            wage: 0,
            contract_end: null,
          },
        ],
        champion_masteries: [
          { player_id: "jg", champion_id: "Sejuani", mastery: 95 },
          { player_id: "mid", champion_id: "Nidalee", mastery: 95 },
        ],
        champion_patch: {
          current_patch: "x",
          hidden_meta: [
            { champion_id: "Sejuani", tier: "A" },
            { champion_id: "Nidalee", tier: "A" },
          ],
          discovered_champion_ids: [],
        },
      } as never,
      opponentTeamName: "Fnatic",
      opponentPlayers: [
        { id: "jg", name: "Razork" },
        { id: "mid", name: "Humanoid" },
      ],
      teamSeeds: [{ id: "fnc", name: "Fnatic" }],
      playerSeeds: [
        { ign: "Razork", teamId: "fnc", role: "Jungle", champions: [["Sejuani", 95]] as (string | number)[][] },
        { ign: "Humanoid", teamId: "fnc", role: "Mid", champions: [["Nidalee", 95]] as (string | number)[][] },
      ],
      championSeeds: [
        { id: "Sejuani", name: "Sejuani", roleHints: ["JUNGLE"] },
        { id: "Nidalee", name: "Nidalee", roleHints: ["JUNGLE", "MID"] },
      ],
    });

    expect(intel.suggestedBans[0].championName).toBe("Nidalee");
  });
});
