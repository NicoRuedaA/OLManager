import { useEffect, useCallback, useRef } from 'react';
import { useMultiplayerStore } from '../store/multiplayerStore';
import { invoke } from '@tauri-apps/api/core';

const CONNECTION_POLL_INTERVAL = 5000; // 5 seconds
const SYNC_POLL_INTERVAL = 3000; // 3 seconds

export function useMultiplayer() {
  const store = useMultiplayerStore();
  const connectionIntervalRef = useRef<number | null>(null);
  const syncIntervalRef = useRef<number | null>(null);

  // Poll connection status
  const startConnectionPolling = useCallback(() => {
    if (connectionIntervalRef.current) return;
    
    connectionIntervalRef.current = window.setInterval(() => {
      store.pollConnectionStatus();
    }, CONNECTION_POLL_INTERVAL);
  }, [store]);

  const stopConnectionPolling = useCallback(() => {
    if (connectionIntervalRef.current) {
      clearInterval(connectionIntervalRef.current);
      connectionIntervalRef.current = null;
    }
  }, []);

  // Poll sync status
  const startSyncPolling = useCallback(() => {
    if (syncIntervalRef.current) return;
    
    syncIntervalRef.current = window.setInterval(() => {
      store.pollSyncStatus();
    }, SYNC_POLL_INTERVAL);
  }, [store]);

  const stopSyncPolling = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopConnectionPolling();
      stopSyncPolling();
    };
  }, [stopConnectionPolling, stopSyncPolling]);

  // Start polling when in multiplayer mode
  useEffect(() => {
    if (store.roomStatus === 'playing' || store.roomStatus === 'joined') {
      startConnectionPolling();
      startSyncPolling();
    } else {
      stopConnectionPolling();
      stopSyncPolling();
    }
  }, [store.roomStatus, startConnectionPolling, stopConnectionPolling, startSyncPolling, stopSyncPolling]);

  // Room management
  const createRoom = useCallback(async (hostName: string) => {
    return store.createRoom(hostName);
  }, [store]);

  const joinRoom = useCallback(async (roomCode: string, clientName: string) => {
    return store.joinRoom(roomCode, clientName);
  }, [store]);

  const leaveRoom = useCallback(async () => {
    stopConnectionPolling();
    stopSyncPolling();
    await store.leaveRoom();
  }, [store, stopConnectionPolling, stopSyncPolling]);

  // Player actions
  const markReady = useCallback(async (ready: boolean) => {
    return store.markReady(ready);
  }, [store]);

  const setRoomCode = useCallback((code: string) => {
    store.setRoomCode(code);
  }, [store]);

  // Sync
  const requestSync = useCallback(async (reason: string = 'ManualRefresh') => {
    return store.requestSync(reason);
  }, [store]);

  const verifyChecksum = useCallback(async () => {
    try {
      await invoke('multiplayer_verify_checksum');
      return true;
    } catch (error) {
      console.error('Checksum verification failed:', error);
      return false;
    }
  }, []);

  // Backup/recovery
  const checkHasBackup = useCallback(async () => {
    return store.checkHasBackup();
  }, [store]);

  const loadBackup = useCallback(async () => {
    return store.loadBackup();
  }, [store]);

  const convertToOffline = useCallback(async () => {
    const result = await loadBackup();
    if (result && result.success) {
      store.reset();
      return result;
    }
    return null;
  }, [loadBackup, store]);

  // Get room status
  const getRoomStatus = useCallback(async (roomCode: string) => {
    try {
      const status = await invoke<{
        room_code: string;
        status: string;
        host_name: string | null;
        client_name: string | null;
      }>('get_room_status', { roomCode });
      return status;
    } catch (error) {
      console.error('Error getting room status:', error);
      return null;
    }
  }, []);

  // Create manual backup
  const createBackup = useCallback(async () => {
    try {
      await invoke('multiplayer_create_backup');
      return true;
    } catch (error) {
      console.error('Error creating backup:', error);
      return false;
    }
  }, []);

  return {
    // State
    ...store,
    
    // Actions
    createRoom,
    joinRoom,
    leaveRoom,
    setRoomCode,
    markReady,
    requestSync,
    verifyChecksum,
    checkHasBackup,
    loadBackup,
    convertToOffline,
    getRoomStatus,
    createBackup,
    
    // Helpers
    isInMultiplayerMode: store.roomStatus === 'playing' || store.roomStatus === 'joined' || store.roomStatus === 'waiting',
    isHost: store.isHost,
    amIPlayer1: store.playerNum === 1,
    amIPlayer2: store.playerNum === 2,
  };
}