import { supabase } from "../../web/supabase"
import type { ApiClient } from "../types"

const BASE = "/api"
const STORAGE_KEY = "olmanager.web.activeSaveId"

// ─── Active save (gestionado internamente) ──────────────────

export function getActiveSaveId(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

function setActiveSaveId(id: string | null): void {
  if (id === null) {
    localStorage.removeItem(STORAGE_KEY)
  } else {
    localStorage.setItem(STORAGE_KEY, id)
  }
}

function requireSaveId(): string {
  const id = getActiveSaveId()
  if (!id) throw new Error("[HttpAdapter] No hay save activo")
  return id
}

// ─── Auth ────────────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ─── Helpers HTTP ────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const headers = { ...(await authHeaders()) }
  const res = await fetch(`${BASE}${path}`, { headers })
  if (!res.ok) throw new Error(`[HttpAdapter] GET ${path} → ${res.status}`)
  return res.json()
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeaders()),
  }
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`[HttpAdapter] POST ${path} → ${res.status}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

async function del<T>(path: string): Promise<T> {
  const headers = { ...(await authHeaders()) }
  const res = await fetch(`${BASE}${path}`, { method: "DELETE", headers })
  if (!res.ok) throw new Error(`[HttpAdapter] DELETE ${path} → ${res.status}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

// Ruta genérica para todos los comandos que van a dispatch
function cmd<T>(command: string, args?: unknown): Promise<T> {
  return post<T>(`/saves/${requireSaveId()}/cmd/${command}`, args)
}

// ─── Adapter ─────────────────────────────────────────────────

export const httpAdapter: ApiClient = {
  saves: {
    list: () => get("/saves"),

    load: async (id) => {
      const result = await get<{ id: string } & Record<string, unknown>>(`/saves/${id}`)
      setActiveSaveId(result.id)
      return result as any
    },

    create: async (name, _manager, data) => {
      const raw = (typeof data === "object" && data !== null ? data as Record<string, unknown> : {}) as Record<string, unknown>
      // Map camelCase from frontend to snake_case the server expects
      const body: Record<string, unknown> = { name }
      if (raw.firstName) body.first_name = raw.firstName
      if (raw.lastName) body.last_name = raw.lastName
      if (raw.dob) body.date_of_birth = raw.dob
      if (raw.nickname !== undefined) body.nickname = raw.nickname
      if (raw.nationality) body.nationality = raw.nationality
      const result = await post<{ id: string } & Record<string, unknown>>("/saves", body)
      setActiveSaveId(result.id)
      return result as any
    },

    delete: async (id) => {
      await del(`/saves/${id}`)
      if (getActiveSaveId() === id) setActiveSaveId(null)
    },

    clearAll: async () => {
      const saves = await get<{ id: string }[]>("/saves")
      await Promise.all(saves.map((s) => del(`/saves/${s.id}`)))
      setActiveSaveId(null)
    },
  },

  settings: {
    load: () => {
      const raw = localStorage.getItem("olm_settings")
      return Promise.resolve(raw ? JSON.parse(raw) : {})
    },
    save: (settings) => {
      localStorage.setItem("olm_settings", JSON.stringify(settings))
      return Promise.resolve()
    },
  },

  training: {
    setFocus: (args) => cmd("set_training", args),
    setSchedule: (args) => cmd("set_training_schedule", args),
    setGroups: (args) => cmd("set_training_groups", args),
    setPlayerFocus: (args) => cmd("set_player_training_focus", args),
    setScrims: (args) => cmd("set_weekly_scrims", args),
    setScrimPlans: (args) => cmd("set_weekly_scrim_plans", args),
    setScrimSlots: (args) => cmd("set_weekly_scrim_slots", args),
    setScrimObjective: (args) => cmd("set_weekly_scrim_objective", args),
    finalizeScrimSetup: () => cmd("finalize_weekly_scrim_setup"),
    autoConfigureScrimSetup: () => cmd("auto_configure_weekly_scrim_setup"),
    cancelTodaysScrims: () => cmd("cancel_todays_scrims"),
    choosePostScrimDecision: (args) => cmd("choose_post_scrim_decision", args),
    chooseDailyScrimAction: (args) => cmd("choose_daily_scrim_action", args),
    delegateScrimDecision: () => cmd("delegate_scrim_decision"),
    getScrimContext: () => cmd("get_scrim_context"),
  },

  transfers: {
    makeBid: (args) => cmd("make_transfer_bid", args),
    respondToOffer: (args) => cmd("respond_to_offer", args),
    counterOffer: (args) => cmd("counter_offer", args),
    previewBidImpact: (args) => cmd("preview_transfer_bid_financial_impact", args),
    releaseContract: (args) => cmd("release_player_contract", args),
    negotiateWage: (args) => cmd("negotiate_player_wage", args),
    getHistory: () => cmd("get_transfer_history_cmd"),
  },

  inbox: {
    markRead: (args) => cmd("mark_message_read", args),
    markAllRead: () => cmd("mark_all_messages_read"),
    resolveAction: (args) => cmd("resolve_message_action", args),
    clearOld: () => cmd("clear_old_messages"),
    delete: (args) => cmd("delete_message", args),
    deleteMany: (args) => cmd("delete_messages", args),
  },

  social: {
    getFeed: () => cmd("get_social_feed"),
    createPost: (args) => cmd("create_manager_social_post", args),
    getAccounts: () => cmd("get_social_accounts"),
    saveAccounts: (args) => cmd("save_social_accounts", args),
    getTemplates: () => cmd("get_social_templates"),
    saveTemplates: (args) => cmd("save_social_templates", args),
    relocalize: (args) => cmd("relocalize_social_feed", args),
  },

  players: {
    startPotentialResearch: (args) => cmd("start_potential_research", args),
    setChampionTrainingTarget: (args) => cmd("set_player_champion_training_target", args),
    delegateChampionTraining: () => cmd("delegate_champion_training"),
  },

  staff: {
    hire: (args) => cmd("hire_staff", args),
    release: (args) => cmd("release_staff", args),
  },

  academy: {
    getAcquisitionOptions: (args) => cmd("get_academy_acquisition_options", args),
    acquire: (args) => cmd("acquire_academy_team", args),
    promotePlayer: (args) => cmd("promote_academy_player", args),
    demotePlayer: (args) => cmd("demote_main_player_to_academy", args),
    getCreationOptions: (args) => cmd("get_academy_creation_options", args),
    create: (args) => cmd("create_academy", args),
  },

  scouting: {
    sendScout: (args) => cmd("send_scout", args),
  },

  time: {
    advance: (args) => post(`/saves/${requireSaveId()}/advance`, args),
    checkBlockers: () => cmd("check_blocking_actions"),
    skipToMatchDay: () => cmd("skip_to_match_day"),
  },

  jobs: {
    getAvailable: () => cmd("get_available_jobs"),
    apply: (args) => cmd("apply_for_job", args),
  },

  teams: {
    getStatsOverview: (args) => cmd("get_team_stats_overview", args),
    getMatchHistory: (args) => cmd("get_team_match_history", args),
  },

  sim: {
    init: () => Promise.reject(new Error("[HttpAdapter] sim_live_* no disponible en web")),
    tick: () => Promise.reject(new Error("[HttpAdapter] sim_live_* no disponible en web")),
    reset: () => Promise.reject(new Error("[HttpAdapter] sim_live_* no disponible en web")),
    dispose: () => Promise.reject(new Error("[HttpAdapter] sim_live_* no disponible en web")),
    runToCompletion: () => Promise.reject(new Error("[HttpAdapter] sim_live_* no disponible en web")),
    skipToEnd: () => Promise.reject(new Error("[HttpAdapter] sim_live_* no disponible en web")),
  },

  serverCommands: {
    selectTeam: (saveId, teamId) => post(`/saves/${saveId}/select-team`, { team_id: teamId }),
    advance: (saveId) => post(`/saves/${saveId}/advance`),
    bugReport: (args) => post("/bug_report", args),
    debugLog: (msg) => { console.debug("[web]", msg); return Promise.resolve() },
    exitToMenu: () => { setActiveSaveId(null); return Promise.resolve() },
  },
}

