import type { GameStateData } from "@/store/gameStore";
import NewsTab from "@/components/news/NewsTab";

interface NewsTabV2Props {
  gameState: GameStateData;
}

export function NewsTabV2({ gameState }: NewsTabV2Props) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <NewsTab gameState={gameState} />
    </div>
  );
}
