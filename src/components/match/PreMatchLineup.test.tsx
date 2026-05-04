import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import PreMatchLineup, {
  condColor,
  getPlayerLolRole,
  getPositionOvr,
  parseFormationNeeds,
  statColor,
} from "./PreMatchLineup";
import type { EnginePlayerData, EngineTeamData } from "./types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, arg?: unknown) => {
      if (
        typeof arg === "object" &&
        arg !== null &&
        "count" in arg &&
        typeof (arg as Record<string, unknown>).count !== "undefined"
      ) {
        return `${key}:${String((arg as Record<string, unknown>).count)}`;
      }
      return key;
    },
  }),
}));

const makePlayer = (overrides: Partial<EnginePlayerData> = {}): EnginePlayerData => ({
  id: "p1",
  name: "Test",
  role: "Midfielder",
  condition: 100,
  pace: 70,
  stamina: 70,
  strength: 70,
  agility: 70,
  passing: 70,
  shooting: 70,
  tackling: 70,
  dribbling: 70,
  defending: 70,
  positioning: 70,
  vision: 70,
  decisions: 70,
  composure: 70,
  aggression: 50,
  teamwork: 70,
  leadership: 50,
  handling: 70,
  reflexes: 70,
  aerial: 70,
  traits: [],
  ...overrides,
});

const makeTeam = (overrides: Partial<EngineTeamData> = {}): EngineTeamData => ({
  id: "team1",
  name: "Test FC",
  formation: "4-4-2",
  play_style: "Balanced",
  players: [
    makePlayer({ id: "top", name: "Top One", role: "Top" }),
    makePlayer({ id: "jg", name: "Jg One", role: "Jungle" }),
    makePlayer({ id: "mid", name: "Mid One", role: "Mid" }),
    makePlayer({ id: "adc", name: "Adc One", role: "Adc" }),
    makePlayer({ id: "sup", name: "Sup One", role: "Support" }),
  ],
  ...overrides,
});

describe("PreMatchLineup helpers", () => {
  it("maps engine roles into LoL roles", () => {
    expect(getPlayerLolRole(makePlayer({ role: "Top" }))).toBe("TOP");
    expect(getPlayerLolRole(makePlayer({ role: "Jungle" }))).toBe("JUNGLE");
    expect(getPlayerLolRole(makePlayer({ role: "Mid" }))).toBe("MID");
    expect(getPlayerLolRole(makePlayer({ role: "Adc" }))).toBe("ADC");
    expect(getPlayerLolRole(makePlayer({ role: "Support" }))).toBe("SUPPORT");
  });

  it("computes LoL OVR from visible 9 stats", () => {
    const player = makePlayer({
      dribbling: 80,
      shooting: 70,
      teamwork: 75,
      vision: 65,
      decisions: 60,
      leadership: 70,
      agility: 68,
      composure: 72,
      stamina: 74,
    });
    expect(getPositionOvr(player)).toBe(Math.round((80 + 70 + 75 + 65 + 60 + 70 + 68 + 72 + 74) / 9));
  });

  it("returns fixed LoL role needs", () => {
    expect(parseFormationNeeds("anything")).toEqual({ TOP: 1, JUNGLE: 1, MID: 1, ADC: 1, SUPPORT: 1 });
  });

  it("keeps condition/stat color helpers", () => {
    expect(condColor(90)).toBe("text-primary-400");
    expect(condColor(60)).toBe("text-amber-400");
    expect(condColor(20)).toBe("text-red-400");
    expect(statColor(80)).toBe("text-primary-400 font-bold");
    expect(statColor(65)).toBe("text-gray-200");
    expect(statColor(40)).toBe("text-gray-500");
  });
});

describe("PreMatchLineup component", () => {
  const defaultProps = {
    userTeam: makeTeam(),
    userBench: [makePlayer({ id: "b1", name: "Bench One", role: "Top", condition: 90 })],
    oppTeam: makeTeam({ id: "opp", name: "Rival United" }),
    userColor: "#00ff00",
    homeTeamColor: "#ff0000",
    awayTeamColor: "#0000ff",
    userSide: "Home" as const,
    selectedStarterId: null as string | null,
    isAutoSelecting: false,
    onSelectStarter: vi.fn(),
    onSwap: vi.fn(),
    onAutoSelect: vi.fn(),
  };

  it("renders 5 LoL starters and bench", () => {
    render(<PreMatchLineup {...defaultProps} />);
    expect(screen.getAllByText("Top One").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Jg One").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mid One").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Adc One").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sup One").length).toBeGreaterThan(0);
    expect(screen.getByText("Bench One")).toBeInTheDocument();
  });

  it("calls callbacks for auto-select, starter select and swap", () => {
    const onAutoSelect = vi.fn();
    const onSelectStarter = vi.fn();
    const onSwap = vi.fn();
    render(
      <PreMatchLineup
        {...defaultProps}
        selectedStarterId="mid"
        onAutoSelect={onAutoSelect}
        onSelectStarter={onSelectStarter}
        onSwap={onSwap}
      />,
    );

    fireEvent.click(screen.getByText("match.autoSelect5"));
    fireEvent.click(screen.getAllByText("Top One")[0]);
    fireEvent.click(screen.getByText("Bench One"));

    expect(onAutoSelect).toHaveBeenCalledOnce();
    expect(onSelectStarter).toHaveBeenCalledWith("top");
    expect(onSwap).toHaveBeenCalledWith("b1");
  });
});
