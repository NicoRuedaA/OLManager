import type { GameStateData } from "@/store/gameStore";
import TournamentsTab from "@/components/tournaments/TournamentsTab";

interface TournamentsTabV2Props {
  gameState: GameStateData;
  onSelectTeam: (id: string) => void;
}

export function TournamentsTabV2({ gameState, onSelectTeam }: TournamentsTabV2Props) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <TournamentsTab gameState={gameState} onSelectTeam={onSelectTeam} />
    </div>
  );
}
