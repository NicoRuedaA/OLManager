import type { GameStateData } from "@/store/gameStore";
import CompetitionsTab from "@/components/competitions/CompetitionsTab";

interface CompetitionsTabV2Props {
  gameState: GameStateData;
  onSelectTeam: (id: string) => void;
}

export function CompetitionsTabV2({ gameState, onSelectTeam }: CompetitionsTabV2Props) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <CompetitionsTab gameState={gameState} onSelectTeam={onSelectTeam} />
    </div>
  );
}
