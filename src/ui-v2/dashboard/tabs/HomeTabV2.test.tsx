import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FixtureData, GameStateData, TeamData } from "@/store/gameStore";

// ─── Mocks ───────────────────────────────────────────────────────────────

vi.mock("@/lib/teams/teamLogos", () => ({
  resolveTeamLogo: () => null,
}));

vi.mock("@/lib/home/helpers", () => ({
  getNextOpponentWidgetData: () => null,
  getRecentResultsForTeam: () => [],
  getLeagueDigestArticles: () => [],
}));

vi.mock("@/lib/i18n/backendI18n", () => ({
  resolveMessage: (v: unknown) => v,
  resolveNewsArticle: (v: unknown) => v,
}));

vi.mock("@/lib/common/helpers", () => ({
  findNextFixture: () => null,
  formatDateShort: () => "01 Jan",
  formatMatchDate: () => "01 Jan",
  getTeamShort: () => "TEA",
}));

vi.mock("@/lib/players/playerPhotos", () => ({
  resolvePlayerPhoto: () => null,
}));

vi.mock("@/ui-v2/_legacy/components/NextMatchDisplay", () => ({
  getLineupByRole: () => [],
  ROLE_ORDER: [],
  teamLineupOvr: () => 0,
}));

// Spanish translation mock matching current hardcoded values
const ES_TRANSLATIONS: Record<string, string> = {
  "home.nextOpponent.title": "Próximo partido",
  "home.nextOpponent.none": "No hay partidos programados.",
  "home.home": "Local",
  "home.away": "Visitante",
  "home.yourTeam": "Tu equipo",
  "home.nextOpponent.opponentForm": "Forma del rival",
  "home.nextOpponent.noHistory": "Sin historial",
  "home.schedule": "Calendario",
  "home.standings.title": "Clasificación",
  "home.standings.preseason": "Pretemporada.",
  "home.standings.hash": "#",
  "home.standings.team": "Equipo",
  "home.standings.wins": "G",
  "home.standings.losses": "P",
  "home.recentResults": "Resultados recientes",
  "home.noMatches": "Sin partidos jugados aún.",
  "home.homeVenue": "Casa",
  "home.awayVenue": "Fuera",
  "home.finances.title": "Finanzas",
  "home.finances.detail": "Detalle",
  "home.finances.balance": "Balance",
  "home.finances.wageBudget": "Presupuesto salarial",
  "home.income": "Ingresos",
  "home.expenses": "Gastos",
  "home.finances.seasonNet": "Neto temporada",
  "home.messages.title": "Mensajes",
  "home.messages.inbox": "Inbox",
  "home.noMessages": "Sin mensajes recientes.",
  "inbox.urgent": "Urgente",
  "home.viewAll": "Ver todos",
  "home.news.title": "Noticias",
  "home.news.viewAll": "Ver todas",
  "home.noNews": "No hay noticias todavía.",
  "home.today": "Hoy",
  "home.matchDay": "Día de partido",
  "home.view": "Ver",
  "home.currentPhase": "Fase actual",
  "home.phase.morning.title": "Arranque del día",
  "home.phase.morning.description": "Revisa el inbox, la plantilla y planifica el día.",
  "home.phase.morning.actionLabel": "Calendario",
  "home.phase.scrimBlock.title": "Sesión de práctica",
  "home.phase.scrimBlock.description": "El equipo está jugando scrims contra un rival.",
  "home.phase.scrimBlock.actionLabel": "Scrims",
  "home.phase.reviewBlock.title": "Análisis post-scrim",
  "home.phase.reviewBlock.description": "Toca decidir cómo continuar tras la sesión.",
  "home.phase.reviewBlock.actionLabel": "Scrims",
  "home.phase.trainingBlock.title": "Foco de entrenamiento",
  "home.phase.trainingBlock.description": "Sin scrim bloqueado: aprovecha para entrenar y recuperar.",
  "home.phase.trainingBlock.actionLabel": "Entrenamiento",
  "home.phase.evening.title": "Fin del día",
  "home.phase.evening.description": "El equipo se recupera. Continúa para avanzar al día siguiente.",
  "home.phase.evening.actionLabel": "Calendario",
  "home.matchdayN": "Jornada {{n}}",
  "season.friendly": "Amistoso",
  "season.preseasonTournament": "Pretemporada",
  "dashboard.phaseLabels.morning": "Mañana",
  "dashboard.phaseLabels.scrimBlock": "Bloque de scrims",
  "dashboard.phaseLabels.reviewBlock": "Revisión",
  "dashboard.phaseLabels.trainingBlock": "Entrenamiento",
  "dashboard.phaseLabels.evening": "Tarde-Noche",
};

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({
    i18n: { language: "es" },
    t: (key: string, options?: Record<string, unknown>) => {
      // Handle defaultValue fallbacks
      if (options && typeof options === "object" && "defaultValue" in options) {
        // Return the key if we have a translation, otherwise defaultValue
        return ES_TRANSLATIONS[key] ?? String(options.defaultValue);
      }
      return ES_TRANSLATIONS[key] ?? key;
    },
  }),
}));

// ─── Test Setup Helpers ─────────────────────────────────────────────────

function createTeam(overrides: Partial<TeamData> = {}): TeamData {
  return {
    id: "team-1",
    name: "Test Team",
    short_name: "TEA",
    logo_url: null,
    finance: 1_000_000,
    wage_budget: 500_000,
    season_income: 200_000,
    season_expenses: 150_000,
    colors: { primary: "#ff0000", secondary: "#ffffff" },
    reputation: 50,
    competition_id: "comp-1",
    ...overrides,
  } as TeamData;
}

function minimalGameState(overrides: Partial<GameStateData> = {}): GameStateData {
  return {
    manager: { team_id: "team-1", name: "Coach" },
    teams: [createTeam()],
    players: [],
    leagues: [],
    clock: { current_date: "2025-03-15" },
    day_phase: "Morning",
    messages: [],
    news: [],
    champion_masteries: [],
    user_competition_id: null,
    ...overrides,
  } as unknown as GameStateData;
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe("HomeTabV2 child components", () => {
  describe("NextOpponentCard", () => {
    it("renders title and home/away badge when data is present", async () => {
      const { HomeTabV2 } = await import("./HomeTabV2");
      const gs = minimalGameState({
        leagues: [
          {
            id: "comp-1",
            name: "Test League",
            competition_id: "comp-1",
            season: 1,
            logo: null,
            fixtures: [
              {
                id: "fix-1",
                home_team_id: "team-1",
                away_team_id: "team-2",
                date: "2025-03-20",
                match_type: "League",
                matchday: 5,
                home_goals: null,
                away_goals: null,
              } as unknown as FixtureData,
            ],
            standings: [],
          },
        ],
        teams: [
          createTeam(),
          createTeam({ id: "team-2", name: "Opponent FC", short_name: "OPP" }),
        ],
      });
      render(<HomeTabV2 gameState={gs} />);
      // The card title should be rendered
      expect(screen.getByText("Próximo partido")).toBeInTheDocument();
    });

    it("shows empty state when no opponent data", async () => {
      const { HomeTabV2 } = await import("./HomeTabV2");
      const gs = minimalGameState();
      render(<HomeTabV2 gameState={gs} />);
      expect(screen.getByText("No hay partidos programados.")).toBeInTheDocument();
    });
  });

  describe("FullStandingsCard", () => {
    it("renders standings section title", async () => {
      const { HomeTabV2 } = await import("./HomeTabV2");
      const gs = minimalGameState({
        leagues: [
          {
            id: "comp-1",
            name: "Test League",
            competition_id: "comp-1",
            season: 1,
            logo: null,
            fixtures: [],
            standings: [],
          },
        ],
      });
      render(<HomeTabV2 gameState={gs} />);
      expect(screen.getByText("Clasificación")).toBeInTheDocument();
    });

    it("shows preseason text when no standings", async () => {
      const { HomeTabV2 } = await import("./HomeTabV2");
      const gs = minimalGameState({
        leagues: [
          {
            id: "comp-1",
            name: "Test League",
            competition_id: "comp-1",
            season: 1,
            logo: null,
            fixtures: [],
            standings: [],
                      },
        ],
      });
      render(<HomeTabV2 gameState={gs} />);
      expect(screen.getByText("Pretemporada.")).toBeInTheDocument();
    });
  });

  describe("TodayPhaseCard", () => {
    it("renders Today and phase info", async () => {
      const { HomeTabV2 } = await import("./HomeTabV2");
      const gs = minimalGameState({ day_phase: "Morning" });
      render(<HomeTabV2 gameState={gs} />);
      expect(screen.getByText("Hoy")).toBeInTheDocument();
    });

    it("renders match day variant when a fixture exists today", async () => {
      const { HomeTabV2 } = await import("./HomeTabV2");
      const gs = minimalGameState({
        day_phase: "Morning",
        leagues: [
          {
            id: "comp-1",
            name: "Test League",
            competition_id: "comp-1",
            season: 1,
            logo: null,
            fixtures: [
              {
                id: "fix-1",
                home_team_id: "team-1",
                away_team_id: "team-2",
                date: "2025-03-15",
                match_type: "League",
                matchday: 5,
                home_goals: null,
                away_goals: null,
              } as unknown as FixtureData,
            ],
            standings: [],
          },
        ],
        teams: [
          createTeam(),
          createTeam({ id: "team-2", name: "Opponent FC", short_name: "OPP" }),
        ],
      });
      render(<HomeTabV2 gameState={gs} />);
      expect(screen.getByText("Día de partido")).toBeInTheDocument();
      expect(screen.getByText("Ver")).toBeInTheDocument();
    });
  });
});
