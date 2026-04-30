import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui';
import { ConnectionStatus } from '../components/multiplayer/ConnectionStatus';
import { ReadyButton } from '../components/multiplayer/ReadyButton';
import { SyncIndicator } from '../components/multiplayer/SyncIndicator';
import { DisconnectRecoveryModal } from '../components/multiplayer/DisconnectRecoveryModal';
import { useMultiplayerStore } from '../store/multiplayerStore';
import { useMultiplayer } from '../hooks/useMultiplayer';
import { 
  ArrowLeft, 
  LogOut,
  Settings,
} from 'lucide-react';

export function MultiplayerGame() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    roomCode,
    isHost,
    playerNum,
    leaveRoom,
  } = useMultiplayerStore();

  const { convertToOffline } = useMultiplayer();

  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Not in a game - redirect
  if (!roomCode) {
    navigate('/multiplayer');
    return null;
  }

  const handleLeaveRoom = async () => {
    await leaveRoom();
    navigate('/');
  };

  const handleContinueOffline = async () => {
    setShowDisconnectModal(false);
    await convertToOffline();
    // Navigate to dashboard in offline mode
    navigate('/dashboard');
  };

  const handleQuitToMenu = async () => {
    setShowDisconnectModal(false);
    await leaveRoom();
    navigate('/');
  };

  const handleBothReady = () => {
    // In a real implementation, this would trigger the day advance
    console.log('Both players ready - day will advance');
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-navy-900 flex flex-col">
      {/* Top Bar */}
      <header className="bg-white dark:bg-navy-800 border-b border-gray-200 dark:border-navy-600 px-4 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Left - Back & Room Info */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDisconnectModal(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {t('multiplayer.room', 'Room')}:
              </span>
              <span className="font-mono font-bold text-gray-900 dark:text-white">
                {roomCode}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400">
                {isHost ? t('multiplayer.host', 'Host') : t('multiplayer.client', 'Client')}
              </span>
            </div>
          </div>

          {/* Center - Player Info */}
          <div className="hidden md:flex items-center gap-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t('multiplayer.youAre', 'You are')}:
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {t('multiplayer.player', 'Player')} {playerNum}
            </span>
          </div>

          {/* Right - Status & Sync */}
          <div className="flex items-center gap-3">
            <SyncIndicator />
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors"
            >
              <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={handleLeaveRoom}
              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Connection Status Bar */}
      <div className="bg-gray-50 dark:bg-navy-800 border-b border-gray-200 dark:border-navy-600 px-4 py-2">
        <div className="max-w-6xl mx-auto">
          <ConnectionStatus />
        </div>
      </div>

      {/* Main Game Area */}
      <main className="flex-1 p-4">
        <div className="max-w-6xl mx-auto">
          {/* This would be the regular game UI */}
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-gray-200 dark:border-navy-600 p-6 min-h-[400px]">
            <h2 className="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-4">
              {t('multiplayer.gameInProgress', 'Game in Progress')}
            </h2>
            
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('multiplayer.gameInProgressDesc', 'The regular game UI would be displayed here. This is the multiplayer wrapper that provides sync and ready functionality.')}
            </p>

            {/* Ready Button - Always visible in multiplayer */}
            <div className="max-w-md">
              <ReadyButton onBothReady={handleBothReady} />
            </div>
          </div>
        </div>
      </main>

      {/* Settings Panel (collapsible) */}
      {showSettings && (
        <div className="fixed inset-y-0 right-0 w-72 bg-white dark:bg-navy-800 border-l border-gray-200 dark:border-navy-600 shadow-xl z-40">
          <div className="p-4 border-b border-gray-200 dark:border-navy-600">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-gray-900 dark:text-white">
                {t('multiplayer.multiplayerSettings', 'Multiplayer Settings')}
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-navy-700"
              >
                ×
              </button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('multiplayer.roomInfo', 'Room Information')}
              </h4>
              <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                <p>{t('multiplayer.roomCode', 'Code')}: <span className="font-mono">{roomCode}</span></p>
                <p>{t('multiplayer.yourRole', 'Role')}: {isHost ? t('multiplayer.host', 'Host') : t('multiplayer.client', 'Client')}</p>
                <p>{t('multiplayer.playerNumber', 'Player')}: {playerNum}</p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleLeaveRoom}
              className="w-full"
              icon={<LogOut className="w-4 h-4" />}
            >
              {t('multiplayer.leaveRoom', 'Leave Room')}
            </Button>
          </div>
        </div>
      )}

      {/* Disconnect Recovery Modal */}
      <DisconnectRecoveryModal
        isOpen={showDisconnectModal}
        onClose={() => setShowDisconnectModal(false)}
        onContinueOffline={handleContinueOffline}
        onQuitToMenu={handleQuitToMenu}
      />
    </div>
  );
}

export default MultiplayerGame;