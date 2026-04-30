import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardBody, Button } from '../ui';
import { useMultiplayerStore } from '../../store/multiplayerStore';
import { User, UserCheck, Loader2 } from 'lucide-react';

interface Player {
  num: 1 | 2;
  name: string;
  teamName: string | null;
}

export function PlayerSelector() {
  const { t } = useTranslation();
  const {
    playerNum,
    isHost,
    roomStatus,
    setError,
    isLoading,
  } = useMultiplayerStore();

  const [selectedPlayer, setSelectedPlayer] = useState<1 | 2 | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // Mock team names - in real implementation, these would come from game state
  const players: Player[] = [
    { num: 1, name: 'Player 1 (Host)', teamName: 'Home Team' },
    { num: 2, name: 'Player 2 (Client)', teamName: 'Away Team' },
  ];

  // Auto-detect which player we are
  useEffect(() => {
    if (roomStatus === 'joined' || roomStatus === 'waiting') {
      if (isHost) {
        setSelectedPlayer(1);
        setIsLocked(true);
      } else {
        setSelectedPlayer(2);
        setIsLocked(true);
      }
    }
  }, [roomStatus, isHost]);

  const handleSelectPlayer = (num: 1 | 2) => {
    if (isLocked) return;
    setSelectedPlayer(num);
  };

  const handleConfirmSelection = async () => {
    if (!selectedPlayer) {
      setError('Please select a player');
      return;
    }

    // In a real implementation, this would call Tauri to confirm player selection
    // and transition to the game state
    setIsLocked(true);
  };

  // Don't render if we're already playing
  if (roomStatus === 'playing') {
    return null;
  }

  return (
    <Card className="w-full max-w-lg">
      <CardBody className="p-6">
        <h2 className="text-xl font-heading font-bold text-gray-900 dark:text-white mb-6 text-center">
          {t('multiplayer.selectYourPlayer', 'Select Your Player')}
        </h2>

        {/* Error Display */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 p-3 mb-4 bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/30 rounded-lg">
            <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
            <p className="text-sm text-primary-600 dark:text-primary-400">
              {t('multiplayer.connecting', 'Connecting...')}
            </p>
          </div>
        )}

        {/* Player Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {players.map((player) => {
            const isSelected = selectedPlayer === player.num;
            const isMe = playerNum === player.num;
            const isDisabled = isLocked && !isMe;

            return (
              <button
                key={player.num}
                onClick={() => handleSelectPlayer(player.num)}
                disabled={isDisabled}
                className={`
                  relative p-4 rounded-xl border-2 transition-all text-left
                  ${isSelected 
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10' 
                    : 'border-gray-200 dark:border-navy-600 hover:border-gray-300 dark:hover:border-navy-500'
                  }
                  ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {/* Player Number Badge */}
                <div className={`
                  absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${isSelected 
                    ? 'bg-primary-500 text-white' 
                    : 'bg-gray-200 dark:bg-navy-600 text-gray-600 dark:text-gray-300'
                  }
                `}>
                  {player.num}
                </div>

                {/* Icon */}
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center mb-3
                  ${isSelected 
                    ? 'bg-primary-100 dark:bg-primary-500/20' 
                    : 'bg-gray-100 dark:bg-navy-700'
                  }
                `}>
                  {isSelected ? (
                    <UserCheck className="w-6 h-6 text-primary-500" />
                  ) : (
                    <User className="w-6 h-6 text-gray-400" />
                  )}
                </div>

                {/* Player Info */}
                <div>
                  <h3 className="font-heading font-bold text-gray-900 dark:text-white mb-1">
                    {player.name}
                  </h3>
                  {player.teamName && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {player.teamName}
                    </p>
                  )}
                </div>

                {/* Selected Indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <div className="w-4 h-4 rounded-full bg-primary-500" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Confirm Button */}
        {!isLocked && (
          <Button
            variant="primary"
            onClick={handleConfirmSelection}
            disabled={!selectedPlayer || isLoading}
            className="w-full"
          >
            {t('multiplayer.confirmSelection', 'Confirm Selection')}
          </Button>
        )}

        {/* Locked Message */}
        {isLocked && (
          <div className="flex items-center justify-center gap-2 p-3 bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/30 rounded-lg">
            <UserCheck className="w-5 h-5 text-success-500" />
            <p className="text-sm text-success-600 dark:text-success-400">
              {t('multiplayer.playerSelected', `You are Player ${selectedPlayer}`)}
            </p>
          </div>
        )}

        {/* Host Info */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
          {isHost 
            ? t('multiplayer.hostInfo', 'You are the host. Player 1 is you.')
            : t('multiplayer.clientInfo', 'You joined as Player 2.')
          }
        </p>
      </CardBody>
    </Card>
  );
}

export default PlayerSelector;