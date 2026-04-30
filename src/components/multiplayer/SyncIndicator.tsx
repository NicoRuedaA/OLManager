import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMultiplayerStore } from '../../store/multiplayerStore';
import { 
  RefreshCw, 
  Check, 
  AlertTriangle,
  Loader2,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface SyncIndicatorProps {
  compact?: boolean;
}

export function SyncIndicator({ compact = false }: SyncIndicatorProps) {
  const { t } = useTranslation();
  const {
    isSyncing,
    syncError,
    lastSyncTime,
    roomStatus,
    pollSyncStatus,
    requestSync,
  } = useMultiplayerStore();

  const [showDetails, setShowDetails] = useState(false);
  const [autoHideTimeout, setAutoHideTimeout] = useState<number | null>(null);

  // Poll sync status
  useEffect(() => {
    if (roomStatus === 'playing') {
      pollSyncStatus();
    }
  }, [roomStatus, pollSyncStatus]);

  // Auto-hide after sync completes
  useEffect(() => {
    if (!isSyncing && syncError === null && lastSyncTime) {
      const timeout = window.setTimeout(() => {
        setShowDetails(false);
      }, 3000);
      setAutoHideTimeout(timeout);
    }

    return () => {
      if (autoHideTimeout) {
        clearTimeout(autoHideTimeout);
      }
    };
  }, [isSyncing, syncError, lastSyncTime]);

  const handleManualSync = async () => {
    await requestSync('ManualRefresh');
    setShowDetails(true);
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return t('multiplayer.never', 'Never');
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastSyncTime.getTime()) / 1000);
    
    if (diff < 60) return t('multiplayer.justNow', 'Just now');
    if (diff < 3600) return t('multiplayer.minutesAgo', '{n}m ago', { n: Math.floor(diff / 60) });
    return t('multiplayer.hoursAgo', '{n}h ago', { n: Math.floor(diff / 3600) });
  };

  // Don't show if not in multiplayer game
  if (roomStatus !== 'playing' && roomStatus !== 'joined') {
    return null;
  }

  // Compact mode - just show sync icon
  if (compact) {
    if (isSyncing) {
      return (
        <div className="flex items-center gap-1 text-primary-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
        </div>
      );
    }
    return null;
  }

  // Full indicator
  return (
    <div className="relative">
      {/* Main Indicator */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
          ${isSyncing 
            ? 'bg-primary-50 dark:bg-primary-500/10 border-primary-200 dark:border-primary-500/30' 
            : syncError 
              ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'
              : 'bg-gray-50 dark:bg-navy-800 border-gray-200 dark:border-navy-600 hover:border-gray-300'
          }
        `}
      >
        {/* Icon */}
        <div className={`
          flex items-center justify-center w-6 h-6 rounded-full
          ${isSyncing 
            ? 'bg-primary-100 dark:bg-primary-500/20' 
            : syncError 
              ? 'bg-red-100 dark:bg-red-500/20'
              : 'bg-gray-100 dark:bg-navy-700'
          }
        `}>
          {isSyncing ? (
            <RefreshCw className="w-3 h-3 text-primary-500 animate-spin" />
          ) : syncError ? (
            <AlertTriangle className="w-3 h-3 text-red-500" />
          ) : (
            <Check className="w-3 h-3 text-success-500" />
          )}
        </div>

        {/* Text */}
        {!compact && (
          <span className={`
            text-sm font-medium
            ${isSyncing 
              ? 'text-primary-600 dark:text-primary-400' 
              : syncError 
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-600 dark:text-gray-400'
            }
          `}>
            {isSyncing 
              ? t('multiplayer.syncing', 'Syncing...')
              : syncError 
                ? t('multiplayer.syncError', 'Sync Error')
                : t('multiplayer.synced', 'Synced')
            }
          </span>
        )}
      </button>

      {/* Detailed Dropdown */}
      {showDetails && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-gray-200 dark:border-navy-600 overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-navy-600">
            <h4 className="font-heading font-bold text-gray-900 dark:text-white text-sm">
              {t('multiplayer.syncStatus', 'Sync Status')}
            </h4>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {t('multiplayer.status', 'Status')}
              </span>
              <span className={`
                text-sm font-medium
                ${isSyncing 
                  ? 'text-primary-500' 
                  : syncError 
                    ? 'text-red-500'
                    : 'text-success-500'
                }
              `}>
                {isSyncing 
                  ? t('multiplayer.syncing', 'Syncing')
                  : syncError 
                    ? t('multiplayer.error', 'Error')
                    : t('multiplayer.synced', 'Synced')
                }
              </span>
            </div>

            {/* Last Sync */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {t('multiplayer.lastSync', 'Last Sync')}
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatLastSync()}
              </span>
            </div>

            {/* Checksum Status */}
            {!isSyncing && !syncError && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {t('multiplayer.checksum', 'Checksum')}
                </span>
                <span className="text-sm text-success-500 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  {t('multiplayer.valid', 'Valid')}
                </span>
              </div>
            )}

            {/* Error Message */}
            {syncError && (
              <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-500/10 rounded text-xs text-red-600 dark:text-red-400">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                {syncError}
              </div>
            )}

            {/* Manual Sync Button */}
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className={`
                w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${isSyncing 
                  ? 'bg-gray-100 dark:bg-navy-700 text-gray-400 cursor-not-allowed'
                  : 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-500/20'
                }
              `}
            >
              {isSyncing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              {t('multiplayer.requestSync', 'Request Sync')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SyncIndicator;