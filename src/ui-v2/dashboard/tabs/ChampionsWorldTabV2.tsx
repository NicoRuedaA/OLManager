import type { ChampionData } from "@/store/types";
import ChampionsGridV2 from "@/ui-v2/components/ChampionsGridV2";

interface ChampionsWorldTabV2Props {
  champions?: ChampionData[];
  onViewChampion: (championKey: string) => void;
}

export function ChampionsWorldTabV2({ champions, onViewChampion }: ChampionsWorldTabV2Props) {
  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <ChampionsGridV2 champions={champions} onChampionClick={onViewChampion} />
    </div>
  );
}
