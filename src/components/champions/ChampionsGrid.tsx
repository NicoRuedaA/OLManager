import { useCallback, useMemo } from "react";
import ChampionCard from "./ChampionCard";
import type { ChampionData } from "../../store/types";

interface ChampionsGridProps {
  champions?: ChampionData[];
  onChampionClick: (championKey: string) => void;
}

function parseRoles(rolesJson: string): string[] {
  try {
    const parsed = JSON.parse(rolesJson);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

export default function ChampionsGrid({ champions, onChampionClick }: ChampionsGridProps) {
  // Champions are passed as prop from gameState - already loaded in memory
  // No loading state needed - data is available immediately

  // Stable reference to onChampionClick that doesn't change on every render
  // This prevents ChampionCard from re-rendering unnecessarily
  const handleChampionClick = useCallback(
    (id: number) => {
      if (!champions) return;
      const champion = champions.find((c) => c.id === id);
      if (champion) {
        onChampionClick(champion.champion_key);
      }
    },
    [champions, onChampionClick]
  );

  // Memoize the cards with stable onClick handler
  const memoizedChampionCards = useMemo(() => {
    if (!champions) return [];
    return champions.map((champion) => {
      const roles = parseRoles(champion.roles_json);
      return (
        <ChampionCard
          key={champion.id}
          id={champion.id}
          name={champion.name}
          championKey={champion.champion_key}
          roles={roles}
          imageTileUrl={champion.image_tile_url || undefined}
          onClick={handleChampionClick}
        />
      );
    });
  }, [champions, handleChampionClick]);

  if (!champions || champions.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {memoizedChampionCards}
    </div>
  );
}