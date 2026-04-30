import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DisconnectRecoveryModal } from "./DisconnectRecoveryModal";
import { useMultiplayerStore } from "../../store/multiplayerStore";

// Mock the store
vi.mock("../../store/multiplayerStore", () => ({
  useMultiplayerStore: vi.fn(() => ({
    checkHasBackup: vi.fn(),
    hasBackup: true,
    backupTimestamp: new Date(),
    isHost: false,
    loadBackup: vi.fn(),
    isLoading: false,
  })),
}));

// Mock i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("DisconnectRecoveryModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <DisconnectRecoveryModal
        isOpen={false}
        onClose={vi.fn()}
        onContinueOffline={vi.fn()}
        onQuitToMenu={vi.fn()}
      />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it("does not render for host", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      checkHasBackup: vi.fn(),
      hasBackup: true,
      backupTimestamp: new Date(),
      isHost: true,
      loadBackup: vi.fn(),
      isLoading: false,
    }));
    
    const { container } = render(
      <DisconnectRecoveryModal
        isOpen={true}
        onClose={vi.fn()}
        onContinueOffline={vi.fn()}
        onQuitToMenu={vi.fn()}
      />
    );
    
    // Host should see null (toast instead)
    expect(container.firstChild).toBeNull();
  });

  it("shows host disconnected message", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      checkHasBackup: vi.fn(),
      hasBackup: true,
      backupTimestamp: new Date(),
      isHost: false,
      loadBackup: vi.fn(),
      isLoading: false,
    }));
    
    render(
      <DisconnectRecoveryModal
        isOpen={true}
        onClose={vi.fn()}
        onContinueOffline={vi.fn()}
        onQuitToMenu={vi.fn()}
      />
    );
    
    expect(screen.getByText("multiplayer.hostDisconnected")).toBeInTheDocument();
  });

  it("shows backup available when has backup", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      checkHasBackup: vi.fn(),
      hasBackup: true,
      backupTimestamp: new Date(),
      isHost: false,
      loadBackup: vi.fn(),
      isLoading: false,
    }));
    
    render(
      <DisconnectRecoveryModal
        isOpen={true}
        onClose={vi.fn()}
        onContinueOffline={vi.fn()}
        onQuitToMenu={vi.fn()}
      />
    );
    
    expect(screen.getByText("multiplayer.backupAvailable")).toBeInTheDocument();
  });

  it("shows progress warning", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      checkHasBackup: vi.fn(),
      hasBackup: true,
      backupTimestamp: new Date(),
      isHost: false,
      loadBackup: vi.fn(),
      isLoading: false,
    }));
    
    render(
      <DisconnectRecoveryModal
        isOpen={true}
        onClose={vi.fn()}
        onContinueOffline={vi.fn()}
        onQuitToMenu={vi.fn()}
      />
    );
    
    expect(screen.getByText("multiplayer.progressWarning")).toBeInTheDocument();
  });

  it("calls onContinueOffline when 'Continue Offline' is clicked", async () => {
    const mockLoadBackup = vi.fn().mockResolvedValue({
      success: true,
      game_state: {},
      timestamp: "2024-01-01",
      player_context: "player2",
    });
    const mockOnContinueOffline = vi.fn();
    
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      checkHasBackup: vi.fn(),
      hasBackup: true,
      backupTimestamp: new Date(),
      isHost: false,
      loadBackup: mockLoadBackup,
      isLoading: false,
    }));
    
    render(
      <DisconnectRecoveryModal
        isOpen={true}
        onClose={vi.fn()}
        onContinueOffline={mockOnContinueOffline}
        onQuitToMenu={vi.fn()}
      />
    );
    
    const continueButton = screen.getByText("multiplayer.continueOffline");
    fireEvent.click(continueButton);
    
    await waitFor(() => {
      expect(mockOnContinueOffline).toHaveBeenCalled();
    });
  });

  it("calls onQuitToMenu when 'Quit to Menu' is clicked", () => {
    const mockOnQuitToMenu = vi.fn();
    
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      checkHasBackup: vi.fn(),
      hasBackup: true,
      backupTimestamp: new Date(),
      isHost: false,
      loadBackup: vi.fn(),
      isLoading: false,
    }));
    
    render(
      <DisconnectRecoveryModal
        isOpen={true}
        onClose={vi.fn()}
        onContinueOffline={vi.fn()}
        onQuitToMenu={mockOnQuitToMenu}
      />
    );
    
    const quitButton = screen.getByText("multiplayer.quitToMenu");
    fireEvent.click(quitButton);
    
    expect(mockOnQuitToMenu).toHaveBeenCalled();
  });

  it("calls checkHasBackup on mount", () => {
    const mockCheckHasBackup = vi.fn();
    
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      checkHasBackup: mockCheckHasBackup,
      hasBackup: true,
      backupTimestamp: new Date(),
      isHost: false,
      loadBackup: vi.fn(),
      isLoading: false,
    }));
    
    render(
      <DisconnectRecoveryModal
        isOpen={true}
        onClose={vi.fn()}
        onContinueOffline={vi.fn()}
        onQuitToMenu={vi.fn()}
      />
    );
    
    expect(mockCheckHasBackup).toHaveBeenCalled();
  });

  it("disables continue button when no backup", () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      checkHasBackup: vi.fn(),
      hasBackup: false,
      backupTimestamp: null,
      isHost: false,
      loadBackup: vi.fn(),
      isLoading: false,
    }));
    
    render(
      <DisconnectRecoveryModal
        isOpen={true}
        onClose={vi.fn()}
        onContinueOffline={vi.fn()}
        onQuitToMenu={vi.fn()}
      />
    );
    
    const continueButton = screen.getByText("multiplayer.noBackup");
    expect(continueButton).toBeDisabled();
  });

  it("shows loading state when clicking continue offline", async () => {
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      checkHasBackup: vi.fn(),
      hasBackup: true,
      backupTimestamp: new Date(),
      isHost: false,
      loadBackup: vi.fn().mockImplementation(() => new Promise(() => {})),
      isLoading: false,
    }));
    
    render(
      <DisconnectRecoveryModal
        isOpen={true}
        onClose={vi.fn()}
        onContinueOffline={vi.fn()}
        onQuitToMenu={vi.fn()}
      />
    );
    
    // Click continue offline to trigger loading state
    const continueButton = screen.getByText("multiplayer.continueOffline");
    fireEvent.click(continueButton);
    
    expect(screen.getByText("multiplayer.loadingBackup")).toBeInTheDocument();
  });

  it("calls onClose when 'Wait for reconnection' is clicked", () => {
    const mockOnClose = vi.fn();
    
    vi.mocked(useMultiplayerStore).mockImplementation(() => ({
      checkHasBackup: vi.fn(),
      hasBackup: true,
      backupTimestamp: new Date(),
      isHost: false,
      loadBackup: vi.fn(),
      isLoading: false,
    }));
    
    render(
      <DisconnectRecoveryModal
        isOpen={true}
        onClose={mockOnClose}
        onContinueOffline={vi.fn()}
        onQuitToMenu={vi.fn()}
      />
    );
    
    const cancelButton = screen.getByText("multiplayer.waitForReconnect");
    fireEvent.click(cancelButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });
});