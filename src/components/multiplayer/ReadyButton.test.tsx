import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReadyButton } from "./ReadyButton";
import { useMultiplayerStore } from "../../store/multiplayerStore";

// Mock the store
vi.mock("../../store/multiplayerStore", () => ({
  useMultiplayerStore: vi.fn(() => ({
    iamReady: false,
    opponentReady: false,
    isHost: true,
    playerNum: 1,
    markReady: vi.fn(),
    roomStatus: "playing",
  })),
}));

// Mock i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("ReadyButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with 'Not Ready' text when not ready", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      iamReady: false,
      opponentReady: false,
      isHost: true,
      playerNum: 1,
      markReady: vi.fn(),
      roomStatus: "playing",
    }));
    
    render(<ReadyButton />);
    
    expect(screen.getByText("multiplayer.notReady")).toBeInTheDocument();
  });

  it("renders with 'Ready for Next Day' when ready", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      iamReady: true,
      opponentReady: false,
      isHost: true,
      playerNum: 1,
      markReady: vi.fn(),
      roomStatus: "playing",
    }));
    
    render(<ReadyButton />);
    
    expect(screen.getByText("multiplayer.readyForNextDay")).toBeInTheDocument();
  });

  it("calls markReady when button is clicked", async () => {
    const mockMarkReady = vi.fn().mockResolvedValue(true);
    
    // First set to ready state so button is enabled
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      iamReady: true,
      opponentReady: false,
      isHost: true,
      playerNum: 1,
      markReady: mockMarkReady,
      roomStatus: "playing",
    }));
    
    render(<ReadyButton />);
    
    // Click to toggle off ready state
    const button = screen.getByText("multiplayer.readyForNextDay");
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(mockMarkReady).toHaveBeenCalledWith(false);
    });
  });

  it("shows 'Waiting for Player 2' when opponent not ready", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      iamReady: true,
      opponentReady: false,
      isHost: true,
      playerNum: 1,
      markReady: vi.fn(),
      roomStatus: "playing",
    }));
    
    render(<ReadyButton />);
    
    expect(screen.getByText("multiplayer.waitingForOpponentP2")).toBeInTheDocument();
  });

  it("shows 'Opponent ready!' when opponent is ready", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      iamReady: true,
      opponentReady: true,
      isHost: true,
      playerNum: 1,
      markReady: vi.fn(),
      roomStatus: "playing",
    }));
    
    render(<ReadyButton />);
    
    expect(screen.getByText("multiplayer.opponentReady")).toBeInTheDocument();
  });

  it("shows 'Both players ready!' message when both ready", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      iamReady: true,
      opponentReady: true,
      isHost: true,
      playerNum: 1,
      markReady: vi.fn(),
      roomStatus: "playing",
    }));
    
    render(<ReadyButton />);
    
    expect(screen.getByText("multiplayer.bothReady")).toBeInTheDocument();
  });

  it("button is enabled when already ready (can toggle off)", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      iamReady: true,
      opponentReady: false,
      isHost: true,
      playerNum: 1,
      markReady: vi.fn(),
      roomStatus: "playing",
    }));
    
    render(<ReadyButton />);
    
    const button = screen.getByText("multiplayer.readyForNextDay");
    // Button is enabled when ready so user can toggle off
    expect(button).toBeEnabled();
  });

  it("shows host notice when player is host", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      iamReady: false,
      opponentReady: false,
      isHost: true,
      playerNum: 1,
      markReady: vi.fn(),
      roomStatus: "playing",
    }));
    
    render(<ReadyButton />);
    
    expect(screen.getByText("multiplayer.hostAdvances")).toBeInTheDocument();
  });

  it("does not render when not in playing status", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      iamReady: false,
      opponentReady: false,
      isHost: true,
      playerNum: 1,
      markReady: vi.fn(),
      roomStatus: "joined",
    }));
    
    const { container } = render(<ReadyButton />);
    
    // Should return null when not playing
    expect(container.firstChild).toBeNull();
  });

  it("shows 'Waiting for Player 1' for player 2", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      iamReady: false,
      opponentReady: false,
      isHost: false,
      playerNum: 2,
      markReady: vi.fn(),
      roomStatus: "playing",
    }));
    
    render(<ReadyButton />);
    
    expect(screen.getByText("multiplayer.waitingForOpponentP1")).toBeInTheDocument();
  });

  it("shows updating state when toggling", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      iamReady: true,
      opponentReady: false,
      isHost: true,
      playerNum: 1,
      markReady: vi.fn().mockImplementation(() => new Promise(() => {})),
      roomStatus: "playing",
    }));
    
    render(<ReadyButton />);
    
    const button = screen.getByText("multiplayer.readyForNextDay");
    fireEvent.click(button);
    
    expect(screen.getByText("multiplayer.updating")).toBeInTheDocument();
  });

  it("calls onBothReady callback when both players ready", () => {
    const mockOnBothReady = vi.fn();
    
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      iamReady: false,
      opponentReady: false,
      isHost: true,
      playerNum: 1,
      markReady: vi.fn(),
      roomStatus: "playing",
    }));
    
    const { rerender } = render(<ReadyButton onBothReady={mockOnBothReady} />);
    
    // Initially not both ready
    expect(mockOnBothReady).not.toHaveBeenCalled();
    
    // Now both ready
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      iamReady: true,
      opponentReady: true,
      isHost: true,
      playerNum: 1,
      markReady: vi.fn(),
      roomStatus: "playing",
    }));
    
    rerender(<ReadyButton onBothReady={mockOnBothReady} />);
    
    expect(mockOnBothReady).toHaveBeenCalled();
  });
});