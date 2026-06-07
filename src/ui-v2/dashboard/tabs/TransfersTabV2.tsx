import type { GameStateData, PlayerSelectionOptions } from "@/store/gameStore";
import TransfersTab from "@/components/transfers/TransfersTab";

interface TransfersTabV2Props {
  gameState: GameStateData;
  onSelectPlayer: (id: string, options?: PlayerSelectionOptions) => void;
  onSelectTeam: (id: string) => void;
  onGameUpdate: (game: GameStateData) => void;
}

export function TransfersTabV2(props: TransfersTabV2Props) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <TransfersTab
        gameState={props.gameState}
        onSelectPlayer={props.onSelectPlayer}
        onSelectTeam={props.onSelectTeam}
        onGameUpdate={props.onGameUpdate}
      />
    </div>
  );
}
