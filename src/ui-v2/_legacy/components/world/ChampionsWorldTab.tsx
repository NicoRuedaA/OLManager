import { useCallback } from "react";
import ChampionsGrid from "@/ui-v2/_legacy/components/champions/ChampionsGrid";
import type { ChampionData } from "@/store/types";

interface ChampionsWorldTabProps {
  champions?: ChampionData[];
  onViewChampion: (championKey: string) => void;
}

export default function ChampionsWorldTab({ champions, onViewChampion }: ChampionsWorldTabProps) {
  const handleChampionClick = useCallback((championKey: string) => {
    onViewChampion(championKey);
  }, [onViewChampion]);

  return (
    <ChampionsGrid champions={champions} onChampionClick={handleChampionClick} />
  );
}