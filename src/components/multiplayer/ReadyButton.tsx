import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui';
import { useMultiplayerStore } from '../../store/multiplayerStore';
import { 
  Check, 
  X, 
  Loader2, 
  Clock, 
  Users,
  ArrowRight,
} from 'lucide-react';

interface ReadyButtonProps {
  onBothReady?: () => void;
}

export function ReadyButton({ onBothReady }: ReadyButtonProps) {
  const { t } = useTranslation();
  const {
    iamReady,
    opponentReady,
    isHost,
    playerNum,
    markReady,
    roomStatus,
  } = useMultiplayerStore();

  const [isToggling, setIsToggling] = useState(false);

  // Check if both players are ready
  useEffect(() => {
    if (iamReady && opponentReady && onBothReady) {
      onBothReady();
    }
  }, [iamReady, opponentReady, onBothReady]);

  const handleToggleReady = async () => {
    setIsToggling(true);
    const newReadyState = !iamReady;
    await markReady(newReadyState);
    setIsToggling(false);
  };

  // Don't show if not in multiplayer game
  if (roomStatus !== 'playing') {
    return null;
  }

  // Button states
  const isReady = iamReady;
  const isOpponentReady = opponentReady;
  const canToggle = !isToggling && !isReady;

  // Opponent status message
  const getOpponentStatusMessage = () => {
    if (isOpponentReady) {
      return t('multiplayer.opponentReady', 'Opponent ready!');
    }
    if (playerNum === 1) {
      return t('multiplayer.waitingForOpponentP2', 'Waiting for Player 2...');
    }
    return t('multiplayer.waitingForOpponentP1', 'Waiting for Player 1...');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Main Ready Button */}
      <Button
        variant={isReady ? 'accent' : 'primary'}
        size="lg"
        onClick={handleToggleReady}
        disabled={canToggle || isToggling}
        icon={isToggling ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isReady ? (
          <Check className="w-5 h-5" />
        ) : (
          <X className="w-5 h-5" />
        )}
        iconRight={!isReady && <ArrowRight className="w-5 h-5" />}
        className={`
          w-full text-lg py-4 transition-all
          ${isReady 
            ? 'bg-success-500 hover:bg-success-600 text-white' 
            : 'bg-primary-500 hover:bg-primary-600 text-white'
          }
        `}
      >
        {isToggling ? (
          t('multiplayer.updating', 'Updating...')
        ) : isReady ? (
          t('multiplayer.readyForNextDay', 'Ready for Next Day')
        ) : (
          t('multiplayer.notReady', 'Not Ready')
        )}
      </Button>

      {/* Status Indicators */}
      <div className="flex items-center justify-between text-sm">
        {/* My Status */}
        <div className="flex items-center gap-2">
          <div className={`
            w-2 h-2 rounded-full 
            ${isReady ? 'bg-success-500' : 'bg-gray-300 dark:bg-gray-600'}
          `} />
          <span className="text-gray-600 dark:text-gray-400">
            {t('multiplayer.you', 'You')}: {isReady ? t('multiplayer.ready', 'Ready') : t('multiplayer.notReady', 'Not Ready')}
          </span>
        </div>

        {/* Opponent Status */}
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" />
          <span className={`
            ${isOpponentReady ? 'text-success-600 dark:text-success-400' : 'text-gray-500 dark:text-gray-500'}
          `}>
            {getOpponentStatusMessage()}
          </span>
        </div>
      </div>

      {/* Both Ready Indicator */}
      {isReady && isOpponentReady && (
        <div className="flex items-center justify-center gap-2 p-3 bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/30 rounded-lg animate-pulse">
          <Check className="w-5 h-5 text-success-500" />
          <span className="text-sm font-medium text-success-600 dark:text-success-400">
            {t('multiplayer.bothReady', 'Both players ready! Advancing day...')}
          </span>
        </div>
      )}

      {/* Waiting for opponent message */}
      {isReady && !isOpponentReady && (
        <div className="flex items-center justify-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-lg">
          <Clock className="w-5 h-5 text-yellow-500" />
          <span className="text-sm text-yellow-600 dark:text-yellow-400">
            {t('multiplayer.waitingForOpponent', 'Waiting for opponent to mark ready...')}
          </span>
        </div>
      )}

      {/* Host Notice */}
      {isHost && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          {t('multiplayer.hostAdvances', 'As host, you will advance the day when both are ready.')}
        </p>
      )}
    </div>
  );
}

export default ReadyButton;