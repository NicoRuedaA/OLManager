import type { GameStateData } from "@/store/gameStore";
import SocialTab from "@/ui-v2/_legacy/components/social/SocialTab";

interface SocialTabV2Props {
  gameState: GameStateData;
  onGameUpdate: (state: GameStateData) => void;
}

export function SocialTabV2({ gameState, onGameUpdate }: SocialTabV2Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 scrollbar-v2">
      <SocialTab gameState={gameState} onGameUpdate={onGameUpdate} />
    </div>
  );
}
