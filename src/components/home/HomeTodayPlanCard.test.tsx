import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import HomeTodayPlanCard from "./HomeTodayPlanCard";
import type { GameStateData, ScrimReportData, TeamData } from "../../store/gameStore";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    // Keep unit tests deterministic after removing inline fallbacks.
    // We only map the keys asserted in this test file.
    t: (key: string, params?: Record<string, unknown> | string) => {
      const map: Record<string, string> = {
        "scrims.tag.volumePlus": "Volumen +",
        "scrims.tag.learningPlus": "Aprendizaje +",
        "scrims.tag.mentalMinus": "Mental -",
        "scrims.decision.cancelScrims": "Cancelar scrims",
        "scrims.decision.vodReview": "VOD Review",
        "scrims.decision.mentalReset": "Mental Reset",
        "scrims.decision.targetedDrills": "Targeted Drills",
        "scrims.freeDayOff": "Dar resto del día libre",
        "scrims.reputation": "Rep scrims",
      };
      if (typeof params === "object" && params?.defaultValue) {
        return String(params.defaultValue).replace(/\{\{(\w+)\}\}/g, (_match, token) => String(params[token] ?? ""));
      }
      if (typeof params === "string") return params;
      return map[key] ?? key;
    },
  }),
}));

vi.mock("../../services/trainingService", () => ({
  cancelTodaysScrims: vi.fn(),
  choosePostScrimDecision: vi.fn(),
  delegateScrimDecision: vi.fn(),
  getScrimContext: vi.fn().mockRejectedValue(new Error("no backend context in unit test")),
}));

function team(overrides: Partial<TeamData> = {}): TeamData {
  return {
    id: "team-1",
    name: "Alpha",
    short_name: "ALP",
    country: "ES",
    city: "Madrid",
    stadium_name: "Arena",
    stadium_capacity: 10000,
    finance: 0,
    manager_id: "manager-1",
    reputation: 500,
    wage_budget: 0,
    transfer_budget: 0,
    season_income: 0,
    season_expenses: 0,
    draft_strategy: "Balanced",
    training_focus: "Scrims",
    training_intensity: "Medium",
    training_schedule: "Balanced",
    weekly_scrim_plan_team_ids: [["team-2"]],
    scrim_weekly_slots: 2,
    scrim_reputation: 50,
    founded_year: 2024,
    colors: { primary: "#000", secondary: "#fff" },
    starting_xi_ids: [],
    form: [],
    history: [],
    ...overrides,
  };
}

function gameState(teams: TeamData[], overrides: Partial<GameStateData> = {}): GameStateData {
  return {
    clock: { current_date: "2026-04-29T00:00:00Z", start_date: "2026-04-01T00:00:00Z" },
    day_phase: "Morning",
    manager: { team_id: "team-1" },
    teams,
    players: [],
    staff: [],
    messages: [],
    news: [],
    leagues: [{ id: "league", name: "League", season: 1, fixtures: [], standings: [] }],
    scouting_assignments: [],
    board_objectives: [],
    ...overrides,
  } as GameStateData;
}

function report(overrides: Partial<ScrimReportData> = {}): ScrimReportData {
  return {
    date: "2026-04-29",
    week_key: "2026-W18",
    slot_index: 0,
    weekday: 1,
    team_id: "team-1",
    opponent_team_id: "team-2",
    status: "Played",
    won: false,
    focus: "DraftPrep",
    issue: "ObjectiveSetup",
    severity: 2,
    quality: 74,
    player_champion_picks: [],
    post_decision: null,
    created_on: "2026-04-28",
    ...overrides,
  };
}

function reportWithSlot(slot: number, overrides: Partial<ScrimReportData> = {}): ScrimReportData {
  return report({ slot_index: slot, ...overrides });
}

describe("HomeTodayPlanCard", () => {
  it("does not show scrim planning actions during scrim decision block", () => {
    const myTeam = team({ scrim_reports: [report()] });
    const rival = team({ id: "team-2", name: "G2 Esports", weekly_scrim_plan_team_ids: [] });

    render(
        <HomeTodayPlanCard
        gameState={gameState([myTeam, rival], { day_phase: "ScrimBlock" })}
        team={myTeam}
      />,
    );

    expect(screen.getByText("Block A result vs G2 Esports")).toBeInTheDocument();
    expect(screen.queryByText(/Rep scrims/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Scrims$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancelar hoy/i })).not.toBeInTheDocument();
  });

  it("shows scrim planning actions before the scrim is resolved", () => {
    const myTeam = team();
    const rival = team({ id: "team-2", name: "G2 Esports", weekly_scrim_plan_team_ids: [] });

    render(
      <HomeTodayPlanCard
        gameState={gameState([myTeam, rival])}
        team={myTeam}
      />,
    );

    expect(screen.getByText("Scrim vs G2 Esports")).toBeInTheDocument();
    expect(screen.getByText(/^Rep scrims/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /scrims/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancelar hoy/i })).not.toBeInTheDocument();
  });

  it("shows neutral impact tags for Push Through tradeoffs", () => {
    const myTeam = team({
      scrim_reputation: 70,
      scrim_loss_streak: 3,
      scrim_reports: [report({ won: false, severity: 3, issue: "Tilt" })],
    });
    const rival = team({ id: "team-2", name: "G2 Esports", scrim_reputation: 55, weekly_scrim_plan_team_ids: [] });

    render(
        <HomeTodayPlanCard
        gameState={gameState([myTeam, rival], { day_phase: "ScrimBlock" })}
        team={myTeam}
      />,
    );

    expect(screen.getByText("Volumen +")).toBeInTheDocument();
    expect(screen.getByText("Aprendizaje +")).toBeInTheDocument();
    expect(screen.getByText("Mental -")).toBeInTheDocument();
  });

  it("does not render review actions outside ScrimBlock even with unresolved report", () => {
    const myTeam = team({ scrim_reports: [report({ post_decision: null })] });
    const rival = team({ id: "team-2", name: "G2 Esports", weekly_scrim_plan_team_ids: [] });

    render(
        <HomeTodayPlanCard
        gameState={gameState([myTeam, rival], { day_phase: "ReviewBlock" })}
        team={myTeam}
      />,
    );

    expect(screen.queryByText(/Resultado bloque A vs G2 Esports/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delegar al Assistant Coach/i })).not.toBeInTheDocument();
  });

  it("shows Day Off only on second daily block", () => {
    const rival = team({ id: "team-2", name: "G2 Esports", weekly_scrim_plan_team_ids: [] });

    const firstBlockTeam = team({
      scrim_reports: [reportWithSlot(0, { post_decision: null })],
      scrim_weekly_slots: 2,
      weekly_scrim_plan_team_ids: [["team-2"], ["team-2"]],
    });
    const { rerender } = render(
      <HomeTodayPlanCard
        gameState={gameState([firstBlockTeam, rival], { day_phase: "ScrimBlock" })}
        team={firstBlockTeam}
      />, 
    );

    expect(screen.queryByRole("button", { name: /Dar resto del día libre/i })).not.toBeInTheDocument();

    const secondBlockTeam = team({
      scrim_reports: [reportWithSlot(1, { post_decision: null })],
      scrim_weekly_slots: 2,
      weekly_scrim_plan_team_ids: [["team-2"], ["team-2"]],
    });
    rerender(
      <HomeTodayPlanCard
        gameState={gameState([secondBlockTeam, rival], { day_phase: "ScrimBlock" })}
        team={secondBlockTeam}
      />, 
    );

    expect(screen.getAllByRole("button", { name: /Dar resto del día libre/i }).length).toBeGreaterThan(0);
  });

  it("shows cancel-followup options only after choosing Cancelar scrims on block 1 bad result", () => {
    const myTeam = team({
      scrim_reports: [reportWithSlot(0, { won: false, severity: 3, post_decision: null })],
      scrim_weekly_slots: 2,
      weekly_scrim_plan_team_ids: [["team-2"], ["team-2"]],
    });
    const rival = team({ id: "team-2", name: "G2 Esports", weekly_scrim_plan_team_ids: [] });

    render(
      <HomeTodayPlanCard
        gameState={gameState([myTeam, rival], { day_phase: "ScrimBlock" })}
        team={myTeam}
      />,
    );

    expect(screen.getByRole("button", { name: /Cancelar scrims/i })).toBeInTheDocument();
    expect(screen.queryByText(/^VOD Review$/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Cancelar scrims/i }));

    expect(screen.getByText(/^VOD Review$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Mental Reset$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Targeted Drills$/i)).toBeInTheDocument();
  });
});
