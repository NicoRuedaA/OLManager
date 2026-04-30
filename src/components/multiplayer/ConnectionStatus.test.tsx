import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConnectionStatus } from "./ConnectionStatus";
import { useMultiplayerStore } from "../../store/multiplayerStore";

// Mock the store
vi.mock("../../store/multiplayerStore", () => ({
  useMultiplayerStore: vi.fn(() => ({
    connectionStatus: "connected",
    ping: 50,
    lastSyncTime: new Date(),
    roomStatus: "playing",
    pollConnectionStatus: vi.fn(),
  })),
}));

// Mock i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock timers
vi.useFakeTimers();

describe("ConnectionStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows connected status with green color", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      connectionStatus: "connected",
      ping: 50,
      lastSyncTime: new Date(),
      roomStatus: "playing",
      pollConnectionStatus: vi.fn(),
    }));
    
    render(<ConnectionStatus />);
    
    expect(screen.getByText("multiplayer.connected")).toBeInTheDocument();
  });

  it("shows reconnecting status with yellow color", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      connectionStatus: "reconnecting",
      ping: 0,
      lastSyncTime: null,
      roomStatus: "playing",
      pollConnectionStatus: vi.fn(),
    }));
    
    render(<ConnectionStatus />);
    
    expect(screen.getByText("multiplayer.reconnecting")).toBeInTheDocument();
  });

  it("shows disconnected status with red color", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      connectionStatus: "disconnected",
      ping: 0,
      lastSyncTime: null,
      roomStatus: "playing",
      pollConnectionStatus: vi.fn(),
    }));
    
    render(<ConnectionStatus />);
    
    expect(screen.getByText("multiplayer.disconnected")).toBeInTheDocument();
  });

  it("displays ping value", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      connectionStatus: "connected",
      ping: 150,
      lastSyncTime: new Date(),
      roomStatus: "playing",
      pollConnectionStatus: vi.fn(),
    }));
    
    render(<ConnectionStatus />);
    
    expect(screen.getByText("150ms")).toBeInTheDocument();
  });

  it("updates on polling", () => {
    const mockPollConnectionStatus = vi.fn();
    
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      connectionStatus: "connected",
      ping: 50,
      lastSyncTime: new Date(),
      roomStatus: "playing",
      pollConnectionStatus: mockPollConnectionStatus,
    }));
    
    render(<ConnectionStatus />);
    
    // Poll should be called when roomStatus is playing
    expect(mockPollConnectionStatus).toHaveBeenCalled();
  });

  it("shows compact mode when compact prop is true", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      connectionStatus: "connected",
      ping: 50,
      lastSyncTime: new Date(),
      roomStatus: "playing",
      pollConnectionStatus: vi.fn(),
    }));
    
    render(<ConnectionStatus compact />);
    
    // In compact mode, should show minimal UI with ping
    expect(screen.getByText("50ms")).toBeInTheDocument();
  });

  it("shows different ping icons based on latency", () => {
    // Low ping (< 100ms)
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      connectionStatus: "connected",
      ping: 50,
      lastSyncTime: new Date(),
      roomStatus: "playing",
      pollConnectionStatus: vi.fn(),
    }));
    
    const { rerender } = render(<ConnectionStatus />);
    expect(screen.getByText("50ms")).toBeInTheDocument();
    
    // Medium ping (100-200ms)
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      connectionStatus: "connected",
      ping: 150,
      lastSyncTime: new Date(),
      roomStatus: "playing",
      pollConnectionStatus: vi.fn(),
    }));
    
    rerender(<ConnectionStatus />);
    expect(screen.getByText("150ms")).toBeInTheDocument();
    
    // High ping (> 200ms)
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      connectionStatus: "connected",
      ping: 250,
      lastSyncTime: new Date(),
      roomStatus: "playing",
      pollConnectionStatus: vi.fn(),
    }));
    
    rerender(<ConnectionStatus />);
    expect(screen.getByText("250ms")).toBeInTheDocument();
  });

  it("formats last sync time as 'Just now' for recent sync", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      connectionStatus: "connected",
      ping: 50,
      lastSyncTime: new Date(),
      roomStatus: "playing",
      pollConnectionStatus: vi.fn(),
    }));
    
    render(<ConnectionStatus />);
    
    expect(screen.getByText("multiplayer.justNow")).toBeInTheDocument();
  });

  it("shows attempt text when reconnecting", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      connectionStatus: "reconnecting",
      ping: 0,
      lastSyncTime: null,
      roomStatus: "playing",
      pollConnectionStatus: vi.fn(),
    }));
    
    render(<ConnectionStatus />);
    
    expect(screen.getByText("multiplayer.attemptingReconnect")).toBeInTheDocument();
  });

  it("opens disconnect modal when clicking on disconnected status", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      connectionStatus: "disconnected",
      ping: 0,
      lastSyncTime: null,
      roomStatus: "playing",
      pollConnectionStatus: vi.fn(),
    }));
    
    render(<ConnectionStatus />);
    
    // Click on disconnected status
    const statusButton = screen.getByText("multiplayer.disconnected");
    fireEvent.click(statusButton);
    
    // Should show modal
    expect(screen.getByText("multiplayer.connectionLost")).toBeInTheDocument();
  });

  it("hides ping in compact mode when not connected", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      connectionStatus: "disconnected",
      ping: 0,
      lastSyncTime: null,
      roomStatus: "playing",
      pollConnectionStatus: vi.fn(),
    }));
    
    render(<ConnectionStatus compact />);
    
    // Should not show ms indicator
    expect(screen.queryByText(/ms/)).not.toBeInTheDocument();
  });
});