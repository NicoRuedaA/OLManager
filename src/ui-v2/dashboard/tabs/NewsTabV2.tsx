import type { GameStateData } from "@/store/gameStore";
import NewsTab from "@/ui-v2/_legacy/components/news/NewsTab";

interface NewsTabV2Props {
  gameState: GameStateData;
}

export function NewsTabV2({ gameState }: NewsTabV2Props) {
  return (
    <div className="news-v2 flex h-full flex-col overflow-y-auto p-6 scrollbar-v2">
      <NewsTab gameState={gameState} />
    </div>
  );
}
