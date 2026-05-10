import { describe, expect, it } from "vitest";
import type { PlayerData } from "../../store/gameStore";
import {
  applyLineupDrop,
  applyLineupSwap,
  buildActiveLineupIds,
  buildActiveLineupSlots,
  buildActivePositionMap,
  getPreferredPositions,
  isPlayerOutOfPosition,
  LOL_ACTIVE_ROLES,
  normalisePosition,
  positionCode,
  translatePositionAbbreviation,
} from "./SquadTab.helpers";

const makePlayer = (
  id: string,
  position: PlayerData["position"],
  overrides: Partial<PlayerData> = {},
): PlayerData => ({
  id,
  match_name: id,
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

describe("SquadTab helpers", () => {
  it("normalises LoL roles without football grouping", () => {
    expect(normalisePosition("TOP")).toBe("TOP");
    expect(normalisePosition("JUNGLE")).toBe("JUNGLE");
    expect(normalisePosition("MID")).toBe("MID");
    expect(normalisePosition("ADC")).toBe("ADC");
    expect(normalisePosition("SUPPORT")).toBe("SUPPORT");
  });

  it("handles missing or empty positions without crashing", () => {
    expect(normalisePosition(undefined)).toBe("");
    expect(positionCode(undefined)).toBe("");
  });

  it("builds exactly five active LoL role ids when coverage exists", () => {
    const available = [
      makePlayer("top", "TOP"),
      makePlayer("jng", "JUNGLE"),
      makePlayer("mid", "MID"),
      makePlayer("adc", "ADC"),
      makePlayer("sup", "SUPPORT"),
      makePlayer("bench", "ADC"),
    ];

    const ids = buildActiveLineupIds(available, ["top", "jng", "mid", "adc", "sup", "bench"]);

    expect(ids).toHaveLength(5);
    expect(ids).toEqual(["top", "jng", "mid", "adc", "sup"]);
  });

  it("builds five active role slots and makes missing coverage explicit", () => {
    const players = [
      makePlayer("top", "TOP"),
      makePlayer("jng", "JUNGLE"),
      makePlayer("mid", "MID"),
      makePlayer("adc", "ADC"),
    ];
    const slots = buildActiveLineupSlots(
      LOL_ACTIVE_ROLES,
      buildActiveLineupIds(players, []),
      new Map(players.map((player) => [player.id, player])),
    );

    expect(slots.map((slot) => slot.role)).toEqual(["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"]);
    expect(slots).toHaveLength(5);
    expect(slots.find((slot) => slot.role === "SUPPORT")?.player).toBeNull();
  });

  it("builds preferred positions using normalised natural and alternate roles", () => {
    const player = makePlayer("p1", "TOP", {
      natural_position: "TOP",
      alternate_positions: ["JUNGLE", "SUPPORT"],
    });

    expect(getPreferredPositions(player)).toEqual(["TOP", "JUNGLE", "SUPPORT"]);
  });

  it("detects out-of-position status using LoL roles", () => {
    const player = makePlayer("p1", "TOP", {
      natural_position: "TOP",
      alternate_positions: ["JUNGLE"],
    });

    expect(isPlayerOutOfPosition(player, "TOP")).toBe(false);
    expect(isPlayerOutOfPosition(player, "JUNGLE")).toBe(false);
    expect(isPlayerOutOfPosition(player, "ADC")).toBe(true);
  });

  it("prefers persisted active lineup ids by matching LoL roles", () => {
    const available = [
      makePlayer("top-a", "TOP"),
      makePlayer("top-b", "TOP"),
      makePlayer("jng", "JUNGLE"),
      makePlayer("mid", "MID"),
      makePlayer("adc", "ADC"),
      makePlayer("sup", "SUPPORT"),
    ];

    const ids = buildActiveLineupIds(available, ["top-b", "jng", "mid", "adc", "sup"]);

    expect(ids).toEqual(["top-b", "jng", "mid", "adc", "sup"]);
  });

  it("auto-selects one player per LoL role when persisted ids are missing", () => {
    const available = [
      makePlayer("top", "TOP"),
      makePlayer("jng", "JUNGLE"),
      makePlayer("mid", "MID"),
      makePlayer("adc", "ADC"),
      makePlayer("sup", "SUPPORT"),
      makePlayer("adc-bench", "ADC"),
    ];

    const ids = buildActiveLineupIds(available, []);

    expect(ids).toHaveLength(5);
    expect(ids).toEqual(["top", "jng", "mid", "adc", "sup"]);
  });

  it("builds active position map from active role slots", () => {
    const players = [
      makePlayer("top", "TOP"),
      makePlayer("jng", "JUNGLE"),
      makePlayer("mid", "MID"),
      makePlayer("adc", "ADC"),
      makePlayer("sup", "SUPPORT"),
    ];
    const slots = buildActiveLineupSlots(LOL_ACTIVE_ROLES, players.map((player) => player.id), new Map(players.map((p) => [p.id, p])));
    const activeMap = buildActivePositionMap(slots);

    expect(slots[0].player?.id).toBe("top");
    expect(activeMap.get("top")).toBe("TOP");
    expect(activeMap.get("jng")).toBe("JUNGLE");
    expect(activeMap.get("sup")).toBe("SUPPORT");
  });

  it("swaps XI players when dragging from one slot to another", () => {
    const nextXiIds = applyLineupDrop(
      ["gk", "d1", "d2", "d3"],
      { playerId: "d1", from: "xi", slotIndex: 1 },
      3,
    );

    expect(nextXiIds).toEqual(["gk", "d3", "d2", "d1"]);
  });

  it("replaces the target slot when dropping a bench player onto the pitch", () => {
    const nextXiIds = applyLineupDrop(
      ["gk", "d1", "d2", "d3"],
      { playerId: "b1", from: "bench", slotIndex: null },
      2,
    );

    expect(nextXiIds).toEqual(["gk", "d1", "b1", "d3"]);
  });

  it("keeps order stable when a dragged bench player is already present in the xi", () => {
    const nextXiIds = applyLineupDrop(
      ["gk", "d1", "b1", "d3"],
      { playerId: "b1", from: "bench", slotIndex: null },
      1,
    );

    expect(nextXiIds).toEqual(["gk", "b1", "d1", "d3"]);
  });

  it("supports bench-to-xi and xi-to-xi swap actions", () => {
    expect(
      applyLineupSwap(["gk", "d1", "d2"], { id: "b1", from: "bench" }, "d2", "xi"),
    ).toEqual(["gk", "d1", "b1"]);

    expect(
      applyLineupSwap(["gk", "d1", "d2"], { id: "d1", from: "xi" }, "d2", "xi"),
    ).toEqual(["gk", "d2", "d1"]);
  });

  it("returns core position codes", () => {
    expect(positionCode("TOP")).toBe("TOP");
    expect(positionCode("SUPPORT")).toBe("SUP");
  });

  it("translates normalized position abbreviations with fallback codes", () => {
    const translate = (key: string): string => key;

    expect(translatePositionAbbreviation(translate, "TOP")).toBe(
      "common.posAbbr.TOP",
    );
    expect(translatePositionAbbreviation(translate, "SUPPORT")).toBe(
      "common.posAbbr.SUPPORT",
    );
  });
});
