import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, CardBody } from '../ui';
import { useMultiplayerStore } from '../../store/multiplayerStore';
import { 
  AlertTriangle, 
  Clock, 
  LogOut, 
  Play,
  Loader2,
  WifiOff,
} from 'lucide-react';

interface DisconnectRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueOffline: () => void;
  onQuitToMenu: () => void;
}

export function DisconnectRecoveryModal({
  isOpen,
  onClose,
  onContinueOffline,
  onQuitToMenu,
}: DisconnectRecoveryModalProps) {
  const { t } = useTranslation();
  const {
    checkHasBackup,
    hasBackup,
    backupTimestamp,
    isHost,
    loadBackup,
    isLoading,
  } = useMultiplayerStore();

  const [isLoadingBackup, setIsLoadingBackup] = useState(false);

  // Check for backup on mount
  useEffect(() => {
    if (isOpen && !isHost) {
      checkHasBackup();
    }
  }, [isOpen, isHost, checkHasBackup]);

  // Don't show for host - they just see a toast
  if (isHost) {
    return null;
  }

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  const handleContinueOffline = async () => {
    setIsLoadingBackup(true);
    const result = await loadBackup();
    setIsLoadingBackup(false);
    
    if (result && result.success) {
      onContinueOffline();
    }
  };

  const handleQuitToMenu = () => {
    onQuitToMenu();
  };

  const formatBackupTime = () => {
    if (!backupTimestamp) return null;
    return new Date(backupTimestamp).toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4">
        <CardBody className="p-6">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
              <WifiOff className="w-8 h-8 text-red-500" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-heading font-bold text-gray-900 dark:text-white text-center mb-2">
            {t('multiplayer.hostDisconnected', 'Host Has Disconnected')}
          </h2>

          {/* Description */}
          <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
            {t('multiplayer.hostDisconnectedDesc', 'The host has left the game. You can continue playing offline with your last synced state or return to the menu.')}
          </p>

          {/* Backup Info */}
          {hasBackup && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-500 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-yellow-700 dark:text-yellow-400">
                  {t('multiplayer.backupAvailable', 'Backup Available')}
                </p>
                <p className="text-yellow-600 dark:text-yellow-500 text-xs">
                  {formatBackupTime() || t('multiplayer.recentBackup', 'Recent backup found')}
                </p>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 mb-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 dark:text-red-400">
              {t('multiplayer.progressWarning', 'Progress since last sync may be lost.')}
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {/* Continue Offline */}
            <Button
              variant="primary"
              onClick={handleContinueOffline}
              disabled={isLoadingBackup || isLoading || !hasBackup}
              icon={isLoadingBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              className="w-full"
            >
              {isLoadingBackup 
                ? t('multiplayer.loadingBackup', 'Loading Backup...')
                : hasBackup 
                  ? t('multiplayer.continueOffline', 'Continue Offline')
                  : t('multiplayer.noBackup', 'No Backup Available')
              }
            </Button>

            {/* Quit to Menu */}
            <Button
              variant="outline"
              onClick={handleQuitToMenu}
              disabled={isLoadingBackup}
              icon={<LogOut className="w-4 h-4" />}
              className="w-full"
            >
              {t('multiplayer.quitToMenu', 'Quit to Menu')}
            </Button>
          </div>

          {/* Cancel */}
          <button
            onClick={onClose}
            className="w-full mt-3 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            {t('multiplayer.waitForReconnect', 'Wait for reconnection...')}
          </button>
        </CardBody>
      </Card>
    </div>
  );
}

export default DisconnectRecoveryModal;