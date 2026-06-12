import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GameStateData } from "@/store/gameStore";

// ─── Mocks ───────────────────────────────────────────────────────────────

vi.mock("@/lib/players/roleIcons", () => ({
  ROLE_ICON_PATHS: {
    TOP: "/top.png",
    JUNGLE: "/jungle.png",
    MID: "/mid.png",
    ADC: "/adc.png",
    SUPPORT: "/support.png",
  },
}));

vi.mock("@/lib/players/lolIdentity", () => ({
  resolvePlayerCurrentLolRole: () => "MID" as const,
}));

vi.mock("@/lib/players/playerPhotos", () => ({
  resolvePlayerPhoto: () => null,
}));

vi.mock("@/lib/champions/championImages", () => ({
  resolveChampionTile: () => null,
}));

vi.mock("@/lib/champions/championIds", () => ({
  normalizeChampionKey: (v: string) => v,
}));

vi.mock("@/lib/players/lolPlayerStats", () => ({
  calculateLolOvr: () => 80,
}));

vi.mock("@/lib/teams/lolStaffEffects", () => ({
  formatStaffEffectPercent: () => "0%",
  getLolStaffEffectsForTeam: () => ({
    metaDiscovery: 0,
    development: 0,
  }),
}));

vi.mock("@/services/playerService", () => ({
  setPlayerChampionTrainingTarget: vi.fn(),
  delegateChampionTraining: vi.fn(),
  getSoloQStatuses: vi.fn(() => Promise.resolve([])),
}));

const ES_TRANSLATIONS: Record<string, string> = {
  "meta.patchMeta": "Patch Meta",
  "meta.unknownPatch": "Unknown Patch",
  "meta.updated": "Updated",
  "meta.complete": "complete",
  "meta.noPlayers": "No players on your team.",
  "meta.priorityHigh": "High Priority",
  "meta.priorityMedium": "Medium Priority",
  "meta.priorityLow": "Low Priority",
  "meta.gainMaximum": "Maximum gain",
  "meta.gainModerate": "Moderate gain",
  "meta.gainMinimal": "Minimal gain",
  "meta.discoveryStats": "Discovery Stats",
  "champions.masteryTrainingTitle": "Champion Mastery Training",
  "common.all": "All",
  "champions.delegating": "Delegating...",
  "champions.delegateToCoach": "Delegate to Coach",
  "champions.noTarget": "No target",
};

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({
    i18n: { language: "en" },
    t: (key: string, options?: Record<string, unknown>) => {
      if (options && typeof options === "object" && "defaultValue" in options) {
        return ES_TRANSLATIONS[key] ?? String(options.defaultValue);
      }
      return ES_TRANSLATIONS[key] ?? key;
    },
  }),
}));

// ─── Test Setup Helpers ─────────────────────────────────────────────────

function minimalGameState(): GameStateData {
  return {
    manager: { team_id: null, name: "Coach", id: "mgr-1", user_id: "user-1", team_id_history: [] },
    players: [],
    teams: [],
    leagues: [],
    clock: { current_date: "2025-03-15", start_date: "2025-01-01" },
    day_phase: "Morning",
    messages: [],
    news: [],
    champion_masteries: [],
    champion_patch: null,
    user_competition_id: null,
  } as unknown as GameStateData;
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe("MetaTabV2 section titles", () => {
  it("renders Patch Meta card title", async () => {
    const { MetaTabV2 } = await import("./MetaTabV2");
    const gs = minimalGameState();
    render(<MetaTabV2 gameState={gs} onGameUpdate={vi.fn()} onViewChampion={vi.fn()} />);
    // Patch Meta title is rendered somewhere in the card header
    const allPatchMeta = screen.getAllByText("Patch Meta");
    expect(allPatchMeta.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Discovery Stats card title", async () => {
    const { MetaTabV2 } = await import("./MetaTabV2");
    const gs = minimalGameState();
    render(<MetaTabV2 gameState={gs} onGameUpdate={vi.fn()} onViewChampion={vi.fn()} />);
    expect(screen.getByText("Discovery Stats")).toBeInTheDocument();
  });

  it("renders Mastery card title", async () => {
    const { MetaTabV2 } = await import("./MetaTabV2");
    const gs = minimalGameState();
    render(<MetaTabV2 gameState={gs} onGameUpdate={vi.fn()} onViewChampion={vi.fn()} />);
    expect(screen.getByText("Champion Mastery Training")).toBeInTheDocument();
  });
});

describe("MetaTabV2 empty state", () => {
  it("shows unknown patch when no patch data", async () => {
    const { MetaTabV2 } = await import("./MetaTabV2");
    const gs = minimalGameState();
    render(<MetaTabV2 gameState={gs} onGameUpdate={vi.fn()} onViewChampion={vi.fn()} />);
    expect(screen.getByText("Unknown Patch")).toBeInTheDocument();
  });

  it("shows no players message when team has no players", async () => {
    const { MetaTabV2 } = await import("./MetaTabV2");
    const gs = minimalGameState();
    render(<MetaTabV2 gameState={gs} onGameUpdate={vi.fn()} onViewChampion={vi.fn()} />);
    expect(screen.getByText("No players on your team.")).toBeInTheDocument();
  });
});

describe("MetaTabV2 delegate button", () => {
  it("renders delegate to coach button", async () => {
    const { MetaTabV2 } = await import("./MetaTabV2");
    const gs = minimalGameState();
    render(<MetaTabV2 gameState={gs} onGameUpdate={vi.fn()} onViewChampion={vi.fn()} />);
    expect(screen.getByText("Delegate to Coach")).toBeInTheDocument();
  });
});
