import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GameStateData } from "@/store/gameStore";
import CompetitionsTab from "@/ui-v2/_legacy/components/competitions/CompetitionsTab";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: "en" },
  }),
}));

vi.mock("../schedule/ScheduleCalendarView", () => ({
  default: () => <div>Calendar mock</div>,
}));

describe("CompetitionsTab", () => {
  it("renders imported competitions even when fixtures and standings are missing", () => {
    const gameState = {
      leagues: [
        {
          id: "league-lec",
          competition_id: "lec",
          name: "LEC",
          season: 1,
          fixtures: undefined,
          standings: undefined,
        },
      ],
      teams: [],
      players: [],
    } as unknown as GameStateData;

    render(<CompetitionsTab gameState={gameState} />);

    expect(screen.getByText("LEC")).toBeInTheDocument();
    expect(screen.getByText("0 partidos")).toBeInTheDocument();
  });
});
