import { describe, expect, it } from "vitest";

import { normalizeBackendScrimContext } from "./scrimContext";

describe("scrimContext backend parity", () => {
  it("maps backend snake_case payload to frontend context contract", () => {
    const normalized = normalizeBackendScrimContext({
      today: {
        state: "PlayedNeedsReview",
        slot_index: 1,
        opponent_team_id: "g2",
        resolved_opponent_team_id: "g2",
        objective: "DraftPrep",
        report: null,
        can_edit_plan: false,
        can_cancel: false,
        can_review: true,
        can_view_weekly_plan: true,
        has_official_match: false,
        primary_action: "Review",
        push_through_recommended: true,
      },
      week: {
        week_key: "2026-W18",
        objective: "DraftPrep",
        capacity: 4,
        planned: 2,
        reputation: 56,
        cancellations: 1,
        played: 2,
        wins: 1,
        losses: 1,
        loss_streak: 0,
        avg_quality: 72,
        top_focus: "Macro",
        top_issue: "ObjectiveSetup",
        next_official_rival_team_id: "fnatic",
        next_official_rival_competition: "League",
        setup_locked: false,
        setup_locked_reason: null,
        can_finalize_setup: true,
        slots: [{
          slot_index: 0,
          weekday: 1,
          label: "1 A",
          label_day: 1,
          label_suffix: "A",
          plan: ["g2", "fnatic"],
          resolved_opponent_team_id: "g2",
          result_won: true,
          report: null,
          status: "Reviewed",
          can_edit: false,
        }],
        latest_reports: [],
      },
    });

    expect(normalized.today.canReview).toBe(true);
    expect(normalized.today.primaryAction).toBe("Review");
    expect(normalized.today.pushThroughRecommended).toBe(true);
    expect(normalized.week.weekKey).toBe("2026-W18");
    expect(normalized.week.nextOfficialRivalTeamId).toBe("fnatic");
    expect(normalized.week.slots[0].labelDay).toBe(1);
    expect(normalized.week.slots[0].labelSuffix).toBe("A");
    expect(normalized.week.slots[0].canEdit).toBe(false);
  });

  it("supports all today states and weekly slot statuses", () => {
    const states = ["NoScrimToday", "Planned", "PlayedNeedsReview", "Reviewed", "Cancelled"] as const;
    const statuses = ["Open", "Locked", "Played", "Reviewed", "Cancelled"] as const;

    for (const state of states) {
      const normalized = normalizeBackendScrimContext({
        today: {
          state,
          slot_index: null,
          opponent_team_id: null,
          resolved_opponent_team_id: null,
          objective: null,
          report: null,
          can_edit_plan: false,
          can_cancel: false,
          can_review: false,
          can_view_weekly_plan: true,
          has_official_match: false,
          primary_action: null,
          push_through_recommended: false,
        },
        week: {
          week_key: "2026-W18",
          objective: null,
          capacity: 2,
          planned: 0,
          reputation: 50,
          cancellations: 0,
          played: 0,
          wins: 0,
          losses: 0,
          loss_streak: 0,
          avg_quality: 0,
          top_focus: null,
          top_issue: null,
          next_official_rival_team_id: null,
          next_official_rival_competition: null,
          setup_locked: false,
          setup_locked_reason: null,
          can_finalize_setup: true,
          slots: statuses.map((status, index) => ({
            slot_index: index,
            weekday: 1,
            label: String(index + 1),
            label_day: 1,
            label_suffix: "",
            plan: [],
            resolved_opponent_team_id: null,
            result_won: null,
            report: null,
            status,
            can_edit: status === "Open",
          })),
          latest_reports: [],
        },
      });

      expect(normalized.today.state).toBe(state);
      expect(normalized.week.slots.map((slot) => slot.status)).toEqual(statuses);
    }
  });
});
