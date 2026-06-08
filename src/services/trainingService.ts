import { getApiClientSync } from "../api/client";
import {
  normalizeOptionalTrainingFocus,
  normalizeTrainingFocus,
} from "../lib/teams/trainingFocus";
import type { GameStateData, PostScrimDecision, ScrimFocus, ScrimReportData } from "../store/gameStore";

export interface BackendTodayScrimContext {
  state: string;
  slot_index: number | null;
  opponent_team_id: string | null;
  resolved_opponent_team_id: string | null;
  objective: ScrimFocus | null;
  report: ScrimReportData | null;
  can_edit_plan: boolean;
  can_cancel: boolean;
  can_review: boolean;
  can_view_weekly_plan: boolean;
  has_official_match: boolean;
  primary_action: "OpenPlan" | "Review" | "Training" | "Schedule" | null;
  push_through_recommended: boolean;
}

export interface BackendWeeklyScrimSlotContext {
  slot_index: number;
  weekday: number;
  label: string;
  label_day: number;
  label_suffix: string;
  plan: string[];
  resolved_opponent_team_id: string | null;
  result_won: boolean | null;
  report: ScrimReportData | null;
  status: "Open" | "Locked" | "Played" | "Reviewed" | "Cancelled";
  can_edit: boolean;
}

export interface BackendWeeklyScrimContext {
  week_key: string;
  objective: ScrimFocus | null;
  capacity: number;
  planned: number;
  reputation: number;
  cancellations: number;
  played: number;
  wins: number;
  losses: number;
  loss_streak: number;
  avg_quality: number;
  top_focus: ScrimFocus | null;
  top_issue: string | null;
  next_official_rival_team_id: string | null;
  next_official_rival_competition: string | null;
  setup_locked: boolean;
  setup_locked_reason: string | null;
  can_finalize_setup: boolean;
  slots: BackendWeeklyScrimSlotContext[];
  latest_reports: ScrimReportData[];
}

export interface BackendScrimContextResponse {
  today: BackendTodayScrimContext;
  week: BackendWeeklyScrimContext;
}

export interface TrainingGroupData {
  id: string;
  name: string;
  focus: string;
  player_ids: string[];
}

export async function setTraining(
  focus: string,
  intensity: string,
): Promise<GameStateData> {
  return getApiClientSync().training.setFocus({ focus: normalizeTrainingFocus(focus), intensity });
}

export async function setTrainingSchedule(
  schedule: string,
): Promise<GameStateData> {
  return getApiClientSync().training.setSchedule({ schedule });
}

export async function setTrainingGroups(
  groups: TrainingGroupData[],
): Promise<GameStateData> {
  return getApiClientSync().training.setGroups({
    groups: groups.map((group) => ({
      ...group,
      focus: normalizeTrainingFocus(group.focus),
    })),
  });
}

export async function setWeeklyScrims(
  opponentTeamIds: string[],
): Promise<GameStateData> {
  return getApiClientSync().training.setScrims({ opponentTeamIds });
}

export async function setWeeklyScrimPlans(
  plans: string[][],
): Promise<GameStateData> {
  return getApiClientSync().training.setScrimPlans({ plans });
}

export async function setWeeklyScrimSlots(
  slots: number,
): Promise<GameStateData> {
  return getApiClientSync().training.setScrimSlots({ slots });
}

export async function setWeeklyScrimObjective(
  objective: ScrimFocus | null,
): Promise<GameStateData> {
  return getApiClientSync().training.setScrimObjective({ objective });
}

export async function finalizeWeeklyScrimSetup(): Promise<GameStateData> {
  return getApiClientSync().training.finalizeScrimSetup();
}

export async function autoConfigureWeeklyScrimSetup(): Promise<GameStateData> {
  return getApiClientSync().training.autoConfigureScrimSetup();
}

export async function cancelTodaysScrims(): Promise<GameStateData> {
  return getApiClientSync().training.cancelTodaysScrims();
}

export async function choosePostScrimDecision(
  slotIndex: number,
  decision: PostScrimDecision,
): Promise<GameStateData> {
  return getApiClientSync().training.choosePostScrimDecision({ slotIndex, decision });
}

export type DailyScrimAction =
  | "ContinueToBlock2"
  | "CancelScrims"
  | "OfferRest"
  | "DayOff"
  | "PushThrough"
  | "VodReview"
  | "MentalReset"
  | "TargetedDrills";

export async function chooseDailyScrimAction(
  slotIndex: number,
  action: DailyScrimAction,
): Promise<GameStateData> {
  return getApiClientSync().training.chooseDailyScrimAction({ slotIndex, action });
}

export async function delegateScrimDecision(): Promise<GameStateData> {
  return getApiClientSync().training.delegateScrimDecision();
}

export async function getScrimContext(): Promise<BackendScrimContextResponse> {
  return getApiClientSync().training.getScrimContext() as Promise<BackendScrimContextResponse>;
}

export async function setPlayerTrainingFocus(
  playerId: string,
  focus: string | null,
): Promise<GameStateData> {
  return getApiClientSync().training.setPlayerFocus({ playerId, focus: normalizeOptionalTrainingFocus(focus) });
}
