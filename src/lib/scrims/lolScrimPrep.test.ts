import { describe, expect, it } from "vitest";
import { buildLolScrimPrepInsight, buildLolScrimPrepSidePayload } from "./lolScrimPrep";
import type { ScrimReportData } from "../../store/gameStore";

function scrimReport(overrides: Partial<ScrimReportData>): ScrimReportData {
  return {
    date: "2026-04-28",
    week_key: "2026-W18",
    slot_index: 0,
    weekday: 2,
    team_id: "team-a",
    opponent_team_id: "team-b",
    status: "Played",
    won: true,
    focus: "DraftPrep",
    issue: null,
    severity: 0,
    quality: 80,
    player_champion_picks: [],
    post_decision: "VodReview",
    created_on: "2026-04-28T10:00:00Z",
    ...overrides,
  };
}

describe("lol scrim prep payload", () => {
  it("builds conservative opponent prep and selected champion comfort", () => {
    const payload = buildLolScrimPrepSidePayload(
      [
        scrimReport({
          player_champion_picks: [{ player_id: "p1", champion_id: "Azir", role: "Mid" }],
        }),
        scrimReport({
          opponent_team_id: "team-c",
          focus: "Teamfighting",
          quality: 60,
          post_decision: null,
          player_champion_picks: [{ player_id: "p2", champion_id: "Sejuani", role: "Jungle" }],
        }),
      ],
      "team-b",
      { p1: "azir", p2: "sejuani" },
    );

    expect(payload).toEqual({
      preparation: 3,
      focus: "DraftPrep",
      comfortByPlayer: { p1: 2, p2: 1 },
    });
  });

  it("describes active prep without implying a guaranteed result", () => {
    const insight = buildLolScrimPrepInsight(
      {
        home: { preparation: 2, focus: "Macro", comfortByPlayer: { p1: 1 } },
        away: { preparation: 0, focus: null, comfortByPlayer: {} },
      },
      "home",
    );

    expect(insight).toMatchObject({
      title: {
        key: "match.scrimPrep.title",
        defaultValue: "Scrim prep carried into the match",
      },
      totalSignal: 3,
      focusLabel: { key: "match.scrimPrep.focus.macro", defaultValue: "macro" },
      details: [
        { key: "match.scrimPrep.details.opponentPrep", values: { value: 2 } },
        { key: "match.scrimPrep.details.championComfort", values: { value: 1 } },
        { key: "match.scrimPrep.details.focus", values: { focus: "macro" } },
      ],
    });
    expect(insight?.summary.defaultValue).toContain("not a guaranteed result");
  });
});

