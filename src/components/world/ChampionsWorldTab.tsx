import { useCallback } from "react";
import ChampionsGrid from "../champions/ChampionsGrid";
import type { ChampionData } from "../../store/types";

interface ChampionsWorldTabProps {
  champions?: ChampionData[];
  onViewChampion: (championKey: string) => void;
}

export default function ChampionsWorldTab({ champions, onViewChampion }: ChampionsWorldTabProps) {
  const handleChampionClick = useCallback((championKey: string) => {
    onViewChampion(championKey);
  }, [onViewChampion]);

  return (
    <div className="space-y-6">
      {/* Champions Grid */}
      <section className="rounded-2xl border border-gray-200 dark:border-navy-600 bg-white dark:bg-navy-800 p-4">
        <ChampionsGrid champions={champions} onChampionClick={handleChampionClick} />
      </section>
    </div>
  );
}