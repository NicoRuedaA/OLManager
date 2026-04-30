import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

// Types matching the Rust backend
export interface ConnectionStatus {
  connected: boolean;
  is_host: boolean;
  room_code: string | null;
  opponent_name: string | null;
}

export interface RoomStatusResponse {
  room_code: string;
  status: string;
  host_name: string | null;
  client_name: string | null;
}

export interface SyncStatus {
  last_sync: string | null;
  is_syncing: boolean;
  checksum_match: boolean | null;
}

export interface LoadBackupResult {
  success: boolean;
  game_state: unknown;
  timestamp: string | null;
  player_context: string;
}

export type RoomStatus = 'idle' | 'creating' | 'waiting' | 'joined' | 'playing';
export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

interface MultiplayerStore {
  // Room state
  roomCode: string | null;
  isHost: boolean;
  roomStatus: RoomStatus;
  roomName: string;
  
  // Player state
  playerNum: 1 | 2 | null;
  playerId: string | null;
  opponentReady: boolean;
  iamReady: boolean;
  
  // Connection state
  connectionStatus: ConnectionState;
  ping: number;
  lastSyncTime: Date | null;
  
  // Sync state
  isSyncing: boolean;
  syncError: string | null;
  
  // Backup state
  hasBackup: boolean;
  backupTimestamp: Date | null;
  
  // UI state
  error: string | null;
  isLoading: boolean;
  
  // Actions
  createRoom: (hostName: string) => Promise<string | null>;
  joinRoom: (roomCode: string, clientName: string) => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  setRoomCode: (code: string) => void;
  markReady: (ready: boolean) => Promise<boolean>;
  loadBackup: () => Promise<LoadBackupResult | null>;
  pollConnectionStatus: () => Promise<void>;
  pollSyncStatus: () => Promise<void>;
  requestSync: (reason: string) => Promise<void>;
  checkHasBackup: () => Promise<boolean>;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialState = {
  roomCode: null,
  isHost: false,
  roomStatus: 'idle' as RoomStatus,
  roomName: '',
  playerNum: null,
  playerId: null,
  opponentReady: false,
  iamReady: false,
  connectionStatus: 'disconnected' as ConnectionState,
  ping: 0,
  lastSyncTime: null,
  isSyncing: false,
  syncError: null,
  hasBackup: false,
  backupTimestamp: null,
  error: null,
  isLoading: false,
};

export const useMultiplayerStore = create<MultiplayerStore>((set, get) => ({
  ...initialState,

  createRoom: async (hostName: string) => {
    const { setError, setLoading } = get();
    setLoading(true);
    setError(null);
    
    try {
      const roomCode = await invoke<string>('multiplayer_create_room', { 
        hostName 
      });
      
      set({
        roomCode,
        isHost: true,
        roomStatus: 'waiting',
        roomName: hostName,
        playerNum: 1,
        playerId: 'player1',
        connectionStatus: 'reconnecting',
        isLoading: false,
      });
      
      return roomCode;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setError(`Failed to create room: ${errorMsg}`);
      set({ isLoading: false });
      return null;
    }
  },

  joinRoom: async (roomCode: string, clientName: string) => {
    const { setError, setLoading } = get();
    setLoading(true);
    setError(null);
    
    try {
      await invoke('multiplayer_join_room', { 
        roomCode, 
        clientName 
      });
      
      set({
        roomCode,
        isHost: false,
        roomStatus: 'joined',
        roomName: clientName,
        playerNum: 2,
        playerId: 'player2',
        connectionStatus: 'connected',
        isLoading: false,
      });
      
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setError(`Failed to join room: ${errorMsg}`);
      set({ isLoading: false });
      return false;
    }
  },

  leaveRoom: async () => {
    const { roomCode, isHost, setLoading } = get();
    if (!roomCode) return;
    
    setLoading(true);
    
    try {
      await invoke('multiplayer_disconnect', { 
        isClient: !isHost 
      });
    } catch (error) {
      console.error('Error disconnecting:', error);
    } finally {
      get().reset();
      setLoading(false);
    }
  },

  setRoomCode: (code: string) => {
    set({ roomCode: code.toUpperCase() });
  },

  markReady: async (ready: boolean) => {
    const { playerId, setError } = get();
    
    try {
      await invoke('mark_day_ready', { 
        managerId: playerId 
      });
      
      set({ iamReady: ready });
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setError(`Failed to mark ready: ${errorMsg}`);
      return false;
    }
  },

  loadBackup: async () => {
    const { setError } = get();
    
    try {
      const result = await invoke<LoadBackupResult>('multiplayer_load_backup');
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setError(`Failed to load backup: ${errorMsg}`);
      return null;
    }
  },

  pollConnectionStatus: async () => {
    try {
      const status = await invoke<ConnectionStatus>('get_connection_status');
      
      set({
        connectionStatus: status.connected ? 'connected' : 'disconnected',
        // Ping would come from WebRTC - for now default to 0
        ping: 0,
      });
    } catch (error) {
      console.error('Error polling connection status:', error);
      set({ connectionStatus: 'disconnected' });
    }
  },

  pollSyncStatus: async () => {
    try {
      const syncStatus = await invoke<SyncStatus>('multiplayer_get_sync_status');
      
      set({
        isSyncing: syncStatus.is_syncing,
        lastSyncTime: syncStatus.last_sync ? new Date(syncStatus.last_sync) : null,
        syncError: syncStatus.checksum_match === false ? 'Checksum mismatch detected' : null,
      });
    } catch (error) {
      console.error('Error polling sync status:', error);
    }
  },

  requestSync: async (reason: string) => {
    const { setError } = get();
    set({ isSyncing: true, syncError: null });
    
    try {
      await invoke('multiplayer_request_sync', { reason });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setError(`Sync request failed: ${errorMsg}`);
      set({ isSyncing: false });
    }
  },

  checkHasBackup: async () => {
    try {
      const hasBackup = await invoke<boolean>('multiplayer_has_backup');
      set({ hasBackup });
      return hasBackup;
    } catch (error) {
      console.error('Error checking backup:', error);
      return false;
    }
  },

  setError: (error: string | null) => set({ error }),
  setLoading: (loading: boolean) => set({ isLoading: loading }),

  reset: () => set(initialState),
}));