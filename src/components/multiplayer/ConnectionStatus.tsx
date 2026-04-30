import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMultiplayerStore } from '../../store/multiplayerStore';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Clock,
  Signal,
  SignalLow,
  SignalMedium,
  AlertTriangle,
} from 'lucide-react';

interface ConnectionStatusProps {
  compact?: boolean;
}

export function ConnectionStatus({ compact = false }: ConnectionStatusProps) {
  const { t } = useTranslation();
  const { 
    connectionStatus, 
    ping, 
    lastSyncTime,
    roomStatus,
    pollConnectionStatus,
  } = useMultiplayerStore();

  const [showModal, setShowModal] = useState(false);

  // Poll status when not in a game
  useEffect(() => {
    if (roomStatus === 'playing' || roomStatus === 'joined') {
      pollConnectionStatus();
    }
  }, [roomStatus, pollConnectionStatus]);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-success-500';
      case 'reconnecting':
        return 'text-yellow-500';
      case 'disconnected':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4" />;
      case 'reconnecting':
        return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'disconnected':
        return <WifiOff className="w-4 h-4" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return t('multiplayer.connected', 'Connected');
      case 'reconnecting':
        return t('multiplayer.reconnecting', 'Reconnecting');
      case 'disconnected':
        return t('multiplayer.disconnected', 'Disconnected');
    }
  };

  const getPingIcon = () => {
    if (ping < 100) return <Signal className="w-3 h-3 text-success-500" />;
    if (ping < 200) return <SignalMedium className="w-3 h-3 text-yellow-500" />;
    return <SignalLow className="w-3 h-3 text-red-500" />;
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return t('multiplayer.never', 'Never');
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastSyncTime.getTime()) / 1000);
    
    if (diff < 60) return t('multiplayer.justNow', 'Just now');
    if (diff < 3600) return t('multiplayer.minutesAgo', '{n} min ago', { n: Math.floor(diff / 60) });
    return t('multiplayer.hoursAgo', '{n} hr ago', { n: Math.floor(diff / 3600) });
  };

  // Compact mode - just show status dot and ping
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 ${getStatusColor()}`}>
          {getStatusIcon()}
        </div>
        {connectionStatus === 'connected' && ping > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {ping}ms
          </span>
        )}
      </div>
    );
  }

  // Full status bar
  return (
    <>
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-navy-800 rounded-lg border border-gray-200 dark:border-navy-600">
        {/* Status */}
        <button
          onClick={() => connectionStatus === 'disconnected' && setShowModal(true)}
          className={`flex items-center gap-2 ${connectionStatus === 'disconnected' ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <div className={`flex items-center gap-1.5 ${getStatusColor()}`}>
            {getStatusIcon()}
            <span className="text-sm font-medium">{getStatusText()}</span>
          </div>
        </button>

        {/* Ping & Sync */}
        <div className="flex items-center gap-4">
          {connectionStatus === 'connected' && (
            <>
              {/* Ping */}
              <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                {getPingIcon()}
                <span className="text-xs">{ping}ms</span>
              </div>

              {/* Last Sync */}
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-500">
                <Clock className="w-3 h-3" />
                <span className="text-xs">{formatLastSync()}</span>
              </div>
            </>
          )}

          {connectionStatus === 'reconnecting' && (
            <div className="flex items-center gap-1.5 text-yellow-500">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span className="text-xs">{t('multiplayer.attemptingReconnect', 'Attempting...')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Disconnect Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-800 rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-gray-900 dark:text-white">
                  {t('multiplayer.connectionLost', 'Connection Lost')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('multiplayer.connectionLostDesc', 'Lost connection to opponent')}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {t('multiplayer.connectionLostMessage', 'The connection to your opponent has been lost. You can continue playing offline or return to the menu.')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-navy-700 rounded-lg hover:bg-gray-200 dark:hover:bg-navy-600 transition-colors"
              >
                {t('multiplayer.continueOffline', 'Continue Offline')}
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  // Navigate to menu - would need navigate from router
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors"
              >
                {t('multiplayer.quitToMenu', 'Quit to Menu')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ConnectionStatus;