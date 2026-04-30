import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlayerSelector } from "./PlayerSelector";
import { useMultiplayerStore } from "../../store/multiplayerStore";

// Mock the store
vi.mock("../../store/multiplayerStore", () => ({
  useMultiplayerStore: vi.fn(() => ({
    playerNum: null,
    isHost: true,
    roomStatus: "joined",
    setError: vi.fn(),
    isLoading: false,
  })),
}));

// Mock i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("PlayerSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders two player cards", () => {
    render(<PlayerSelector />);
    
    expect(screen.getByText("Player 1 (Host)")).toBeInTheDocument();
    expect(screen.getByText("Player 2 (Client)")).toBeInTheDocument();
  });

  it("auto-detects host as Player 1", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      playerNum: null,
      isHost: true,
      roomStatus: "joined",
      setError: vi.fn(),
      isLoading: false,
    }));
    
    render(<PlayerSelector />);
    
    // Host should see host info text (i18n key)
    expect(screen.getByText("multiplayer.hostInfo")).toBeInTheDocument();
  });

  it("auto-detects client as Player 2", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      playerNum: null,
      isHost: false,
      roomStatus: "joined",
      setError: vi.fn(),
      isLoading: false,
    }));
    
    render(<PlayerSelector />);
    
    // Client should see client info text (i18n key)
    expect(screen.getByText("multiplayer.clientInfo")).toBeInTheDocument();
  });

  it("shows team names for each player", () => {
    render(<PlayerSelector />);
    
    expect(screen.getByText("Home Team")).toBeInTheDocument();
    expect(screen.getByText("Away Team")).toBeInTheDocument();
  });

  it("shows confirm selection button when player is not locked", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      playerNum: null,
      isHost: true,
      roomStatus: "idle",
      setError: vi.fn(),
      isLoading: false,
    }));
    
    render(<PlayerSelector />);
    
    expect(screen.getByText("multiplayer.confirmSelection")).toBeInTheDocument();
  });

  it("shows locked message after selection", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      playerNum: 1,
      isHost: true,
      roomStatus: "joined",
      setError: vi.fn(),
      isLoading: false,
    }));
    
    render(<PlayerSelector />);
    
    // Should show player selected message (i18n key)
    expect(screen.getByText("multiplayer.playerSelected")).toBeInTheDocument();
  });

  it("shows loading state when isLoading is true", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      playerNum: null,
      isHost: true,
      roomStatus: "joined",
      setError: vi.fn(),
      isLoading: true,
    }));
    
    render(<PlayerSelector />);
    
    expect(screen.getByText("multiplayer.connecting")).toBeInTheDocument();
  });

  it("does not render when room status is playing", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      playerNum: 1,
      isHost: true,
      roomStatus: "playing",
      setError: vi.fn(),
      isLoading: false,
    }));
    
    const { container } = render(<PlayerSelector />);
    
    // Should return null when playing
    expect(container.firstChild).toBeNull();
  });

  it("locks selection after confirming", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      playerNum: null,
      isHost: true,
      roomStatus: "idle",
      setError: vi.fn(),
      isLoading: false,
    }));
    
    const { rerender } = render(<PlayerSelector />);
    
    // Initially shows selection button
    expect(screen.getByText("multiplayer.confirmSelection")).toBeInTheDocument();
    
    // After selection (playerNum is set)
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      playerNum: 1,
      isHost: true,
      roomStatus: "joined",
      setError: vi.fn(),
      isLoading: false,
    }));
    
    rerender(<PlayerSelector />);
    
    // Now shows locked message
    expect(screen.getByText("multiplayer.playerSelected")).toBeInTheDocument();
  });

  it("button is disabled when no player selected", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      playerNum: null,
      isHost: true,
      roomStatus: "idle",
      setError: vi.fn(),
      isLoading: false,
    }));
    
    render(<PlayerSelector />);
    
    // Button should be disabled when no player selected
    const confirmButton = screen.getByText("multiplayer.confirmSelection");
    expect(confirmButton).toBeDisabled();
  });
});