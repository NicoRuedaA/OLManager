import type { GameStateData } from "@/store/gameStore";
import YouthAcademyTab from "@/components/youthAcademy/YouthAcademyTab";

interface YouthTabV2Props {
  gameState: GameStateData;
  onSelectPlayer?: (id: string) => void;
  onGameUpdate?: (state: GameStateData) => void;
}

export function YouthTabV2({ gameState, onSelectPlayer, onGameUpdate }: YouthTabV2Props) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <YouthAcademyTab
        gameState={gameState}
        onSelectPlayer={onSelectPlayer}
        onGameUpdate={onGameUpdate}
      />
    </div>
  );
}
