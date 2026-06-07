import type { GameStateData } from "@/store/gameStore";
import SocialTab from "@/components/social/SocialTab";

interface SocialTabV2Props {
  gameState: GameStateData;
  onGameUpdate: (state: GameStateData) => void;
}

export function SocialTabV2({ gameState, onGameUpdate }: SocialTabV2Props) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <SocialTab gameState={gameState} onGameUpdate={onGameUpdate} />
    </div>
  );
}
