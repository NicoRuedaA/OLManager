import type { GameStateData, PlayerSelectionOptions } from "@/store/gameStore";
import PlayerProfile from "@/ui-v2/_legacy/components/playerProfile/PlayerProfile";

interface PlayerProfileV2Props {
  gameState: GameStateData;
  playerId: string;
  onClose: () => void;
  onGameUpdate?: (state: GameStateData) => void;
  onSelectPlayer?: (id: string, options?: PlayerSelectionOptions) => void;
  onViewChampion?: (championKey: string) => void;
}

export default function PlayerProfileV2({
  gameState,
  playerId,
  onClose,
  onGameUpdate,
  onViewChampion,
}: PlayerProfileV2Props) {
  const player = gameState.players.find((p) => p.id === playerId);
  if (!player) return null;

  return (
    <div className="player-profile-v2 flex h-full flex-col overflow-y-auto scrollbar-v2">
      <PlayerProfile
        gameState={gameState}
        player={player}
        isOwnClub={player.team_id === gameState.manager.team_id}
        onClose={onClose}
        onGameUpdate={onGameUpdate}
        onViewChampion={onViewChampion}
      />
    </div>
  );
}
