import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import ChampionCard from "./ChampionCard";
import type { Champion } from "./ChampionProfile";

// Module-level cache to persist champions data across tab switches
let cachedChampions: Champion[] | null = null;

interface ChampionsGridProps {
  onChampionClick: (champion: Champion) => void;
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

export default function ChampionsGrid({ onChampionClick }: ChampionsGridProps) {
  const [champions, setChampions] = useState<Champion[]>(cachedChampions || []);
  const [isLoading, setIsLoading] = useState(!cachedChampions);

  useEffect(() => {
    // If we already have cached data, skip the fetch
    if (cachedChampions) {
      console.log("[ChampionsGrid] Using cached champions data");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchChampions = async (): Promise<void> => {
      try {
        console.log("[ChampionsGrid] Fetching champions from backend...");
        const result = await invoke<Champion[]>("get_champions");
        if (!cancelled) {
          cachedChampions = result; // Store in module-level cache
          setChampions(result);
          setIsLoading(false);
          console.log(`[ChampionsGrid] Cached ${result.length} champions`);
        }
      } catch (err) {
        console.error("Failed to load champions:", err);
        setIsLoading(false);
      }
    };

    void fetchChampions();

    return () => {
      cancelled = true;
    };
  }, []);

  // Stable reference to onChampionClick that doesn't change on every render
  // This prevents ChampionCard from re-rendering unnecessarily
  const handleChampionClick = useCallback(
    (id: number) => {
      const champion = champions.find((c) => c.id === id);
      if (champion) {
        onChampionClick(champion);
      }
    },
    [champions, onChampionClick]
  );

  // Memoize the cards with stable onClick handler
  const memoizedChampionCards = useMemo(() => {
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

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="card card-body p-0 overflow-hidden animate-pulse"
          >
            <div className="aspect-[4/3] w-full bg-navy-700" />
            <div className="p-2 space-y-2">
              <div className="h-4 w-20 bg-navy-700 rounded" />
              <div className="h-4 w-16 bg-navy-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (champions.length === 0) {
    return <p className="text-sm text-gray-500">No champions found</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {memoizedChampionCards}
    </div>
  );
}