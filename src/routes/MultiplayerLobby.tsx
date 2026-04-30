import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card, CardBody } from '../components/ui';
import { PlayerSelector } from '../components/multiplayer/PlayerSelector';
import { ConnectionStatus } from '../components/multiplayer/ConnectionStatus';
import { useMultiplayerStore } from '../store/multiplayerStore';
import { 
  Users, 
  ArrowLeft, 
  Loader2,
  Play,
} from 'lucide-react';

export function MultiplayerLobby() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    roomCode,
    isHost,
    playerNum,
    pollConnectionStatus,
    leaveRoom,
  } = useMultiplayerStore();

  const [isStarting, setIsStarting] = useState(false);

  // Poll connection status
  useEffect(() => {
    const interval = setInterval(pollConnectionStatus, 5000);
    return () => clearInterval(interval);
  }, [pollConnectionStatus]);

  const handleLeaveRoom = async () => {
    await leaveRoom();
    navigate('/');
  };

  const handleStartGame = async () => {
    setIsStarting(true);
    // In a real implementation, this would start the game
    // For now, just navigate to the game
    setTimeout(() => {
      navigate('/multiplayer-game');
    }, 1000);
  };

  // Not in a room - redirect to menu
  if (!roomCode) {
    navigate('/multiplayer');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-navy-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-navy-800 border-b border-gray-200 dark:border-navy-600 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleLeaveRoom}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="font-heading font-bold text-gray-900 dark:text-white">
                {t('multiplayer.lobby', 'Multiplayer Lobby')}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('multiplayer.roomCode', 'Room')}: <span className="font-mono font-bold">{roomCode}</span>
              </p>
            </div>
          </div>
          
          <ConnectionStatus compact />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-6">
          {/* Connection Status Card */}
          <Card accent={isHost ? 'primary' : 'accent'}>
            <CardBody className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center
                  ${isHost 
                    ? 'bg-primary-100 dark:bg-primary-500/20' 
                    : 'bg-accent-100 dark:bg-accent-500/20'
                  }
                `}>
                  <Users className={`w-6 h-6 ${isHost ? 'text-primary-500' : 'text-accent-500'}`} />
                </div>
                <div>
                  <h2 className="font-heading font-bold text-gray-900 dark:text-white">
                    {isHost 
                      ? t('multiplayer.hostingGame', 'Hosting Game')
                      : t('multiplayer.joinedGame', 'Joined Game')
                    }
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {isHost 
                      ? t('multiplayer.waitingForPlayer', 'Waiting for opponent to join...')
                      : t('multiplayer.connectedToHost', 'Connected to host')
                    }
                  </p>
                </div>
              </div>

              <ConnectionStatus />
            </CardBody>
          </Card>

          {/* Player Selection */}
          <PlayerSelector />

          {/* Start Game Button (Host only, when both connected) */}
          {isHost && playerNum && (
            <Button
              variant="primary"
              size="lg"
              onClick={handleStartGame}
              disabled={isStarting || !playerNum}
              icon={isStarting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              className="w-full"
            >
              {isStarting 
                ? t('multiplayer.starting', 'Starting...')
                : t('multiplayer.startGame', 'Start Game')
              }
            </Button>
          )}

          {/* Waiting message for non-host */}
          {!isHost && (
            <div className="text-center p-4 bg-gray-50 dark:bg-navy-800 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">
                {t('multiplayer.waitingForHost', 'Waiting for host to start the game...')}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default MultiplayerLobby;