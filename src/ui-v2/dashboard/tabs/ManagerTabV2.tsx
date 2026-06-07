import type { GameStateData } from "@/store/gameStore";
import ManagerTab from "@/components/manager/ManagerTab";

interface ManagerTabV2Props {
  gameState: GameStateData;
}

export function ManagerTabV2({ gameState }: ManagerTabV2Props) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <ManagerTab gameState={gameState} />
    </div>
  );
}
