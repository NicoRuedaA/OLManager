import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";

import {
  cancelTodaysScrims,
  choosePostScrimDecision,
  delegateScrimDecision,
  getScrimContext,
  setPlayerTrainingFocus,
  setTraining,
  setTrainingGroups,
  setTrainingSchedule,
  setWeeklyScrimPlans,
  setWeeklyScrimObjective,
  setWeeklyScrimSlots,
} from "./trainingService";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);

describe("trainingService", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it("calls the set training backend command", async () => {
    const response = { manager: { id: "manager-1" } };
    mockedInvoke.mockResolvedValueOnce(response);

    await expect(setTraining("Physical", "High")).resolves.toBe(response);
    expect(mockedInvoke).toHaveBeenCalledWith("set_training", {
      focus: "Scrims",
      intensity: "High",
    });
  });

  it("calls the set training schedule backend command", async () => {
    const response = { manager: { id: "manager-1" } };
    mockedInvoke.mockResolvedValueOnce(response);

    await expect(setTrainingSchedule("Light")).resolves.toBe(response);
    expect(mockedInvoke).toHaveBeenCalledWith("set_training_schedule", {
      schedule: "Light",
    });
  });

  it("calls the set training groups backend command", async () => {
    const response = { manager: { id: "manager-1" } };
    const groups = [{ id: "grp-1", name: "Attack", focus: "Attacking", player_ids: ["player-1"] }];
    mockedInvoke.mockResolvedValueOnce(response);

    await expect(setTrainingGroups(groups)).resolves.toBe(response);
    expect(mockedInvoke).toHaveBeenCalledWith("set_training_groups", {
      groups: [{ id: "grp-1", name: "Attack", focus: "IndividualCoaching", player_ids: ["player-1"] }],
    });
  });

  it("calls the set player training focus backend command", async () => {
    const response = { manager: { id: "manager-1" } };
    mockedInvoke.mockResolvedValueOnce(response);

    await expect(setPlayerTrainingFocus("player-1", null)).resolves.toBe(response);
    expect(mockedInvoke).toHaveBeenCalledWith("set_player_training_focus", {
      playerId: "player-1",
      focus: null,
    });
  });

  it("calls the weekly scrim plans backend command", async () => {
    const response = { manager: { id: "manager-1" } };
    const plans = [["g2", "fnatic", "bds"]];
    mockedInvoke.mockResolvedValueOnce(response);

    await expect(setWeeklyScrimPlans(plans)).resolves.toBe(response);
    expect(mockedInvoke).toHaveBeenCalledWith("set_weekly_scrim_plans", {
      plans,
    });
  });

  it("calls the weekly scrim slots backend command", async () => {
    const response = { manager: { id: "manager-1" } };
    mockedInvoke.mockResolvedValueOnce(response);

    await expect(setWeeklyScrimSlots(6)).resolves.toBe(response);
    expect(mockedInvoke).toHaveBeenCalledWith("set_weekly_scrim_slots", {
      slots: 6,
    });
  });

  it("calls the weekly scrim objective backend command", async () => {
    const response = { manager: { id: "manager-1" } };
    mockedInvoke.mockResolvedValueOnce(response);

    await expect(setWeeklyScrimObjective("DraftPrep")).resolves.toBe(response);
    expect(mockedInvoke).toHaveBeenCalledWith("set_weekly_scrim_objective", {
      objective: "DraftPrep",
    });
  });

  it("calls the cancel todays scrims backend command", async () => {
    const response = { manager: { id: "manager-1" } };
    mockedInvoke.mockResolvedValueOnce(response);

    await expect(cancelTodaysScrims()).resolves.toBe(response);
    expect(mockedInvoke).toHaveBeenCalledWith("cancel_todays_scrims");
  });

  it("calls the post-scrim decision backend command", async () => {
    const response = { manager: { id: "manager-1" } };
    mockedInvoke.mockResolvedValueOnce(response);

    await expect(choosePostScrimDecision(1, "VodReview")).resolves.toBe(response);
    expect(mockedInvoke).toHaveBeenCalledWith("choose_post_scrim_decision", {
      slotIndex: 1,
      decision: "VodReview",
    });
  });

  it("calls the delegate scrim decision backend command", async () => {
    const response = { manager: { id: "manager-1" } };
    mockedInvoke.mockResolvedValueOnce(response);

    await expect(delegateScrimDecision()).resolves.toBe(response);
    expect(mockedInvoke).toHaveBeenCalledWith("delegate_scrim_decision");
  });

  it("calls the get scrim context backend command", async () => {
    const response = { today: { state: "NoScrimToday" }, week: { week_key: "2026-W18" } };
    mockedInvoke.mockResolvedValueOnce(response);

    await expect(getScrimContext()).resolves.toBe(response);
    expect(mockedInvoke).toHaveBeenCalledWith("get_scrim_context");
  });
});
