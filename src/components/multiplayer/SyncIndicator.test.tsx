import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SyncIndicator } from "./SyncIndicator";
import { useMultiplayerStore } from "../../store/multiplayerStore";

// Mock the store
vi.mock("../../store/multiplayerStore", () => ({
  useMultiplayerStore: vi.fn(() => ({
    isSyncing: false,
    syncError: null,
    lastSyncTime: new Date(),
    roomStatus: "playing",
    pollSyncStatus: vi.fn(),
    requestSync: vi.fn(),
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

describe("SyncIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows 'Synced' when not syncing and no error", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      isSyncing: false,
      syncError: null,
      lastSyncTime: new Date(),
      roomStatus: "playing",
      pollSyncStatus: vi.fn(),
      requestSync: vi.fn(),
    }));
    
    render(<SyncIndicator />);
    
    expect(screen.getByText("multiplayer.synced")).toBeInTheDocument();
  });

  it("shows 'Syncing...' when syncing", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      isSyncing: true,
      syncError: null,
      lastSyncTime: null,
      roomStatus: "playing",
      pollSyncStatus: vi.fn(),
      requestSync: vi.fn(),
    }));
    
    render(<SyncIndicator />);
    
    expect(screen.getByText("multiplayer.syncing")).toBeInTheDocument();
  });

  it("shows 'Sync Error' when there's an error", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      isSyncing: false,
      syncError: "Checksum mismatch",
      lastSyncTime: new Date(),
      roomStatus: "playing",
      pollSyncStatus: vi.fn(),
      requestSync: vi.fn(),
    }));
    
    render(<SyncIndicator />);
    
    expect(screen.getByText("multiplayer.syncError")).toBeInTheDocument();
  });

  it("shows spinner when syncing (compact mode)", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      isSyncing: true,
      syncError: null,
      lastSyncTime: null,
      roomStatus: "playing",
      pollSyncStatus: vi.fn(),
      requestSync: vi.fn(),
    }));
    
    render(<SyncIndicator compact />);
    
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows detailed dropdown when clicked", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      isSyncing: false,
      syncError: null,
      lastSyncTime: new Date(),
      roomStatus: "playing",
      pollSyncStatus: vi.fn(),
      requestSync: vi.fn(),
    }));
    
    render(<SyncIndicator />);
    
    // Click to show details
    const indicator = screen.getByText("multiplayer.synced");
    fireEvent.click(indicator);
    
    // Should show sync status details
    expect(screen.getByText("multiplayer.syncStatus")).toBeInTheDocument();
  });

  it("calls requestSync when manual sync button is clicked", async () => {
    const mockRequestSync = vi.fn().mockResolvedValue(undefined);
    
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      isSyncing: false,
      syncError: null,
      lastSyncTime: new Date(),
      roomStatus: "playing",
      pollSyncStatus: vi.fn(),
      requestSync: mockRequestSync,
    }));
    
    render(<SyncIndicator />);
    
    // Click to show details
    const indicator = screen.getByText("multiplayer.synced");
    fireEvent.click(indicator);
    
    // Click manual sync button
    const syncButton = screen.getByText("multiplayer.requestSync");
    fireEvent.click(syncButton);
    
    await waitFor(() => {
      expect(mockRequestSync).toHaveBeenCalledWith("ManualRefresh");
    });
  });

  it("shows checksum status when synced", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      isSyncing: false,
      syncError: null,
      lastSyncTime: new Date(),
      roomStatus: "playing",
      pollSyncStatus: vi.fn(),
      requestSync: vi.fn(),
    }));
    
    render(<SyncIndicator />);
    
    // Click to show details
    const indicator = screen.getByText("multiplayer.synced");
    fireEvent.click(indicator);
    
    // Should show checksum valid
    expect(screen.getByText("multiplayer.valid")).toBeInTheDocument();
  });

  it("shows error message when sync error", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      isSyncing: false,
      syncError: "Checksum mismatch detected",
      lastSyncTime: new Date(),
      roomStatus: "playing",
      pollSyncStatus: vi.fn(),
      requestSync: vi.fn(),
    }));
    
    render(<SyncIndicator />);
    
    // Click to show details
    const indicator = screen.getByText("multiplayer.syncError");
    fireEvent.click(indicator);
    
    // Should show error message
    expect(screen.getByText("Checksum mismatch detected")).toBeInTheDocument();
  });

  it("disables manual sync button while syncing", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      isSyncing: true,
      syncError: null,
      lastSyncTime: null,
      roomStatus: "playing",
      pollSyncStatus: vi.fn(),
      requestSync: vi.fn(),
    }));
    
    render(<SyncIndicator />);
    
    // Click to show details
    const indicator = screen.getByText("multiplayer.syncing");
    fireEvent.click(indicator);
    
    // Manual sync button should be disabled
    const syncButton = screen.getByText("multiplayer.requestSync");
    expect(syncButton).toBeDisabled();
  });

  it("does not render when not in playing or joined status", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      isSyncing: false,
      syncError: null,
      lastSyncTime: null,
      roomStatus: "idle",
      pollSyncStatus: vi.fn(),
      requestSync: vi.fn(),
    }));
    
    const { container } = render(<SyncIndicator />);
    
    // Should return null
    expect(container.firstChild).toBeNull();
  });

  it("polls sync status when in playing status", () => {
    const mockPollSyncStatus = vi.fn();
    
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      isSyncing: false,
      syncError: null,
      lastSyncTime: new Date(),
      roomStatus: "playing",
      pollSyncStatus: mockPollSyncStatus,
      requestSync: vi.fn(),
    }));
    
    render(<SyncIndicator />);
    
    expect(mockPollSyncStatus).toHaveBeenCalled();
  });
});