import { supabase } from "./supabase";
import {
  deriveTodayScrimContext,
  deriveWeeklyScrimContext,
  type ScrimContextResponse,
  type TodayScrimContext,
  type WeeklyScrimContext,
  type WeeklyScrimSlotContext,
} from "../lib/scrimContext";
import type { BackendScrimContextResponse } from "../services/trainingService";
import type { GameStateData } from "../store/gameStore";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
const ACTIVE_SAVE_KEY = "olmanager.web.activeSaveId";
const SETTINGS_KEY = "olmanager.web.settings";

interface SaveSummary {
  id: string;
  name: string;
  manager: string | null;
  updated_at: string;
}

type InvokeArgs = Record<string, unknown> | undefined;

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeader()),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.error ?? detail;
    } catch {
      /* keep status text */
    }
    throw new Error(`${response.status}: ${detail}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

function activeSaveId(): string {
  const id = localStorage.getItem(ACTIVE_SAVE_KEY);
  if (!id) {
    throw new Error("No active save selected");
  }
  return id;
}

function setActiveSave(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_SAVE_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_SAVE_KEY);
  }
}

function managerDisplayName(game: any): string {
  const manager = game?.manager ?? {};
  return manager.nickname?.trim?.() || `${manager.first_name ?? ""} ${manager.last_name ?? ""}`.trim();
}

function toBackendTodayScrimContext(today: TodayScrimContext): BackendScrimContextResponse["today"] {
  return {
    state: today.state,
    slot_index: today.slotIndex,
    opponent_team_id: today.opponentTeamId,
    resolved_opponent_team_id: today.resolvedOpponentTeamId,
    objective: today.objective,
    report: today.report,
    can_edit_plan: today.canEditPlan,
    can_cancel: today.canCancel,
    can_review: today.canReview,
    can_view_weekly_plan: today.canViewWeeklyPlan,
    has_official_match: today.hasOfficialMatch,
    primary_action: today.primaryAction,
    push_through_recommended: today.pushThroughRecommended,
  };
}

function toBackendWeeklyScrimSlot(slot: WeeklyScrimSlotContext): BackendScrimContextResponse["week"]["slots"][number] {
  return {
    slot_index: slot.slotIndex,
    weekday: slot.weekday,
    label: slot.label,
    label_day: slot.labelDay,
    label_suffix: slot.labelSuffix,
    plan: slot.plan,
    resolved_opponent_team_id: slot.resolvedOpponentTeamId,
    result_won: slot.resultWon,
    report: slot.report,
    status: slot.status,
    can_edit: slot.canEdit,
  };
}

function toBackendWeeklyScrimContext(week: WeeklyScrimContext): BackendScrimContextResponse["week"] {
  return {
    week_key: week.weekKey,
    objective: week.objective,
    capacity: week.capacity,
    planned: week.planned,
    reputation: week.reputation,
    cancellations: week.cancellations,
    played: week.played,
    wins: week.wins,
    losses: week.losses,
    loss_streak: week.lossStreak,
    avg_quality: week.avgQuality,
    top_focus: week.topFocus,
    top_issue: week.topIssue,
    next_official_rival_team_id: week.nextOfficialRivalTeamId,
    next_official_rival_competition: week.nextOfficialRivalCompetition,
    setup_locked: week.setupLocked,
    setup_locked_reason: week.setupLockedReason,
    can_finalize_setup: week.canFinalizeSetup,
    slots: week.slots.map(toBackendWeeklyScrimSlot),
    latest_reports: week.latestReports,
  };
}

function toBackendScrimContext(context: ScrimContextResponse): BackendScrimContextResponse {
  return {
    today: toBackendTodayScrimContext(context.today),
    week: toBackendWeeklyScrimContext(context.week),
  };
}

function toLegacySaveEntry(save: SaveSummary) {
  return {
    id: save.id,
    name: save.name,
    manager_name: save.manager ?? save.name,
    db_filename: "",
    checksum: "",
    created_at: save.updated_at,
    last_played_at: save.updated_at,
  };
}

export async function invoke<T = unknown>(command: string, args?: InvokeArgs): Promise<T> {
  switch (command) {
    case "debug_log": {
      if (import.meta.env.DEV) {
        console.debug(String(args?.message ?? ""));
      }
      return undefined as T;
    }
    case "get_saves": {
      const result = await request<{ saves: SaveSummary[] }>("/api/saves");
      return result.saves.map(toLegacySaveEntry) as T;
    }
    case "start_new_game_lightweight": {
      const result = await request<{ id: string; game: unknown }>("/api/saves", {
        method: "POST",
        body: JSON.stringify({
          first_name: args?.firstName,
          last_name: args?.lastName,
          nickname: args?.nickname ?? null,
          date_of_birth: args?.dob,
          nationality: args?.nationality,
          name: args?.nickname || `${args?.firstName ?? ""} ${args?.lastName ?? ""}`.trim() || "Career",
        }),
      });
      setActiveSave(result.id);
      return "ok" as T;
    }
    case "load_game": {
      const saveId = String(args?.saveId ?? "");
      const result = await request<{ id: string; game: unknown }>(`/api/saves/${saveId}`);
      setActiveSave(result.id);
      return managerDisplayName(result.game) as T;
    }
    case "get_scrim_context": {
      const result = await request<{ id: string; game: GameStateData }>(`/api/saves/${activeSaveId()}`);
      const teamId = result.game.manager.team_id;
      const team = teamId ? result.game.teams.find((candidate) => candidate.id === teamId) : null;
      if (!team) {
        throw new Error("Manager team not found");
      }
      return toBackendScrimContext({
        today: deriveTodayScrimContext(result.game, team),
        week: deriveWeeklyScrimContext(result.game, team),
      }) as T;
    }
    case "delete_save": {
      const saveId = String(args?.saveId ?? "");
      await request<{ deleted: string }>(`/api/saves/${saveId}`, { method: "DELETE" });
      if (localStorage.getItem(ACTIVE_SAVE_KEY) === saveId) {
        setActiveSave(null);
      }
      return true as T;
    }
    case "exit_to_menu":
      setActiveSave(null);
      return undefined as T;
    case "get_settings": {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return (saved ? JSON.parse(saved) : {}) as T;
    }
    case "save_settings":
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(args?.settings ?? {}));
      return undefined as T;
    case "clear_all_saves": {
      const result = await request<{ saves: SaveSummary[] }>("/api/saves");
      await Promise.all(
        result.saves.map((save) =>
          request(`/api/saves/${save.id}`, {
            method: "DELETE",
          }),
        ),
      );
      setActiveSave(null);
      return undefined as T;
    }
    default:
      return request<T>(`/api/saves/${activeSaveId()}/cmd/${command}`, {
        method: "POST",
        body: JSON.stringify(args ?? {}),
      });
  }
}
