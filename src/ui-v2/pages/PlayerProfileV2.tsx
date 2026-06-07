import type { GameStateData, PlayerSelectionOptions } from "@/store/gameStore";
import PlayerProfile from "@/components/playerProfile/PlayerProfile";

interface PlayerProfileV2Props {
  gameState: GameStateData;
  playerId: string;
  onClose: () => void;
  onGameUpdate?: (state: GameStateData) => void;
  onSelectPlayer?: (id: string, options?: PlayerSelectionOptions) => void;
}

export default function PlayerProfileV2({
  gameState,
  playerId,
  onClose,
  onGameUpdate,
  onSelectPlayer,
}: PlayerProfileV2Props) {
  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-v2">
      <PlayerProfile
        gameState={gameState}
        playerId={playerId}
        onClose={onClose}
        onGameUpdate={onGameUpdate}
        onSelectPlayer={onSelectPlayer}
      />
    </div>
  );
}
