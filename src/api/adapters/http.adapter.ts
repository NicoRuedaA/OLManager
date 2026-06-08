import type { ApiClient } from "../types"

const API_BASE = "/api"

async function apiFetch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(String(err.error ?? err.message ?? res.statusText))
  }
  return res.json()
}

export const httpAdapter: ApiClient = {
  saves: {
    list: () => apiFetch("/saves"),
    load: (id) => apiFetch(`/saves/${id}/load`),
    create: (name, _manager, data) => apiFetch("/saves", { name, ...(data as Record<string, unknown>) }),
    delete: (id) => apiFetch(`/saves/${id}/delete`),
    clearAll: () => apiFetch("/saves/clear-all"),
  },

  settings: {
    load: () => apiFetch("/settings"),
    save: (settings) => apiFetch("/settings", settings),
  },

  training: {
    setFocus: (args) => apiFetch("/training/focus", args),
    setSchedule: (args) => apiFetch("/training/schedule", args),
    setGroups: (args) => apiFetch("/training/groups", args),
    setPlayerFocus: (args) => apiFetch("/training/player-focus", args),
    setScrims: (args) => apiFetch("/training/scrims", args),
    setScrimPlans: (args) => apiFetch("/training/scrim-plans", args),
    setScrimSlots: (args) => apiFetch("/training/scrim-slots", args),
    setScrimObjective: (args) => apiFetch("/training/scrim-objective", args),
    finalizeScrimSetup: () => apiFetch("/training/finalize-scrim-setup"),
    autoConfigureScrimSetup: () => apiFetch("/training/auto-configure-scrim-setup"),
    cancelTodaysScrims: () => apiFetch("/training/cancel-scrims"),
    choosePostScrimDecision: (args) => apiFetch("/training/post-scrim-decision", args),
    chooseDailyScrimAction: (args) => apiFetch("/training/daily-scrim-action", args),
    delegateScrimDecision: () => apiFetch("/training/delegate-scrim-decision"),
    getScrimContext: () => apiFetch("/training/scrim-context"),
  },

  transfers: {
    makeBid: (args) => apiFetch("/transfers/bid", args),
    respondToOffer: (args) => apiFetch("/transfers/respond", args),
    counterOffer: (args) => apiFetch("/transfers/counter", args),
    previewBidImpact: (args) => apiFetch("/transfers/preview-bid", args),
    releaseContract: (args) => apiFetch("/transfers/release-contract", args),
    negotiateWage: (args) => apiFetch("/transfers/negotiate-wage", args),
    getHistory: () => apiFetch("/transfers/history"),
  },

  inbox: {
    markRead: (args) => apiFetch("/inbox/mark-read", args),
    markAllRead: () => apiFetch("/inbox/mark-all-read"),
    resolveAction: (args) => apiFetch("/inbox/resolve-action", args),
    clearOld: () => apiFetch("/inbox/clear-old"),
    delete: (args) => apiFetch("/inbox/delete", args),
    deleteMany: (args) => apiFetch("/inbox/delete-many", args),
  },

  social: {
    getFeed: () => apiFetch("/social/feed"),
    createPost: (args) => apiFetch("/social/post", args),
    getAccounts: () => apiFetch("/social/accounts"),
    saveAccounts: (args) => apiFetch("/social/accounts", args),
    getTemplates: () => apiFetch("/social/templates"),
    saveTemplates: (args) => apiFetch("/social/templates", args),
    relocalize: (args) => apiFetch("/social/relocalize", args),
  },

  players: {
    startPotentialResearch: (args) => apiFetch("/players/potential-research", args),
    setChampionTrainingTarget: (args) => apiFetch("/players/champion-training-target", args),
    delegateChampionTraining: () => apiFetch("/players/delegate-champion-training"),
  },

  staff: {
    hire: (args) => apiFetch("/staff/hire", args),
    release: (args) => apiFetch("/staff/release", args),
  },

  academy: {
    getAcquisitionOptions: (args) => apiFetch("/academy/acquisition-options", args),
    acquire: (args) => apiFetch("/academy/acquire", args),
    promotePlayer: (args) => apiFetch("/academy/promote", args),
    demotePlayer: (args) => apiFetch("/academy/demote", args),
    getCreationOptions: (args) => apiFetch("/academy/creation-options", args),
    create: (args) => apiFetch("/academy/create", args),
  },

  scouting: {
    sendScout: (args) => apiFetch("/scouting/send", args),
  },

  time: {
    advance: (args) => apiFetch("/time/advance", args),
    checkBlockers: () => apiFetch("/time/check-blockers"),
    skipToMatchDay: () => apiFetch("/time/skip-to-match-day"),
  },

  jobs: {
    getAvailable: () => apiFetch("/jobs/available"),
    apply: (args) => apiFetch("/jobs/apply", args),
  },

  teams: {
    getStatsOverview: (args) => apiFetch("/teams/stats-overview", args),
    getMatchHistory: (args) => apiFetch("/teams/match-history", args),
  },

  sim: {
    init: (args) => apiFetch("/sim/init", args),
    tick: (args) => apiFetch("/sim/tick", args),
    reset: (args) => apiFetch("/sim/reset", args),
    dispose: (args) => apiFetch("/sim/dispose", args),
    runToCompletion: (args) => apiFetch("/sim/run-to-completion", args),
    skipToEnd: (args) => apiFetch("/sim/skip-to-end", args),
  },

  serverCommands: {
    selectTeam: () => Promise.reject(new Error("[HttpAdapter] selectTeam no implementado")),
    advance: () => Promise.reject(new Error("[HttpAdapter] advance no implementado")),
    bugReport: (args) => apiFetch("/server/bug-report", args),
    debugLog: (msg) => { console.debug("[web]", msg); return Promise.resolve() },
    exitToMenu: () => Promise.resolve(),
  },
}
