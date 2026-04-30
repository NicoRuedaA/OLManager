import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardBody } from '../ui';
import { useMultiplayerStore } from '../../store/multiplayerStore';
import {
  Users,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  LogIn,
  PlusCircle,
} from 'lucide-react';

type Tab = 'create' | 'join';

export function MultiplayerMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('create');
  const [copied, setCopied] = useState(false);
  
  const {
    roomCode,
    roomStatus,
    isLoading,
    error,
    createRoom,
    joinRoom,
    setRoomCode,
    setError,
    reset,
  } = useMultiplayerStore();

  // Form state
  const [hostName, setHostName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const handleCreateRoom = async () => {
    if (!hostName.trim()) {
      setError('Please enter a game name');
      return;
    }
    
    const code = await createRoom(hostName);
    if (code) {
      // Room created successfully - now wait for opponent
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim() || joinCode.length !== 6) {
      setError('Please enter a valid 6-character room code');
      return;
    }
    
    const success = await joinRoom(joinCode, `Player_${joinCode}`);
    if (success) {
      navigate('/multiplayer-lobby');
    }
  };

  const handleCopyCode = async () => {
    if (roomCode) {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLeaveRoom = () => {
    reset();
    setHostName('');
    setJoinCode('');
  };

  // Room created - show waiting screen
  if (roomStatus === 'waiting' && roomCode) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-navy-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardBody className="p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-500/20 mb-4">
                <Users className="w-8 h-8 text-primary-500" />
              </div>
              
              <h2 className="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-2">
                {t('multiplayer.waitingForPlayer', 'Waiting for Player...')}
              </h2>
              
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('multiplayer.shareCode', 'Share this code with your opponent:')}
              </p>
              
              {/* Room Code Display */}
              <div className="bg-gray-50 dark:bg-navy-800 rounded-lg p-4 mb-6">
                <div className="text-4xl font-mono font-bold tracking-widest text-primary-600 dark:text-primary-400">
                  {roomCode}
                </div>
              </div>
              
              {/* Copy Button */}
              <Button
                variant="outline"
                onClick={handleCopyCode}
                icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                className="w-full mb-4"
              >
                {copied 
                  ? t('multiplayer.copied', 'Copied!') 
                  : t('multiplayer.copyCode', 'Copy to Clipboard')}
              </Button>
              
              {/* Cancel Button */}
              <Button
                variant="ghost"
                onClick={handleLeaveRoom}
                className="w-full"
              >
                {t('multiplayer.cancel', 'Cancel')}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-navy-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardBody className="p-6">
          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-navy-600 mb-6">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 pb-3 text-sm font-heading font-bold uppercase tracking-wide transition-colors ${
                activeTab === 'create'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <PlusCircle className="w-4 h-4" />
                {t('multiplayer.createGame', 'Create Game')}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('join')}
              className={`flex-1 pb-3 text-sm font-heading font-bold uppercase tracking-wide transition-colors ${
                activeTab === 'join'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <LogIn className="w-4 h-4" />
                {t('multiplayer.joinGame', 'Join Game')}
              </span>
            </button>
          </div>

          {/* Create Game Form */}
          {activeTab === 'create' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  {t('multiplayer.gameName', 'Game Name')}
                </label>
                <input
                  type="text"
                  maxLength={30}
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder={t('multiplayer.enterGameName', 'Enter a name for your game')}
                  className="w-full bg-gray-50 dark:bg-navy-900 border border-gray-300 dark:border-navy-600 text-gray-900 dark:text-white rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-gray-400"
                />
              </div>
              
              <Button
                variant="primary"
                onClick={handleCreateRoom}
                disabled={isLoading || !hostName.trim()}
                icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                className="w-full"
              >
                {isLoading 
                  ? t('multiplayer.creating', 'Creating...') 
                  : t('multiplayer.createRoom', 'Create Room')}
              </Button>
            </div>
          )}

          {/* Join Game Form */}
          {activeTab === 'join' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  {t('multiplayer.roomCode', 'Room Code')}
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder={t('multiplayer.enterRoomCode', 'Enter 6-character code')}
                  className="w-full bg-gray-50 dark:bg-navy-900 border border-gray-300 dark:border-navy-600 text-gray-900 dark:text-white rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-gray-400 text-center font-mono text-xl tracking-widest"
                />
              </div>
              
              <Button
                variant="primary"
                onClick={handleJoinRoom}
                disabled={isLoading || !joinCode.trim() || joinCode.length !== 6}
                icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                className="w-full"
              >
                {isLoading 
                  ? t('multiplayer.connecting', 'Connecting...') 
                  : t('multiplayer.joinRoom', 'Join Room')}
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default MultiplayerMenu;