import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { Loader2, AlertCircle } from "lucide-react";
import ChampionCard from "./ChampionCard";
import type { Champion } from "./ChampionProfile";

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
  const { t } = useTranslation();
  const [champions, setChampions] = useState<Champion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchChampions = async (): Promise<void> => {
      try {
        const result = await invoke<Champion[]>("get_champions");
        if (!cancelled) {
          setChampions(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchChampions();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
          <p className="text-sm text-gray-400 font-heading">
            {t("champions.loading", "Cargando campeones...")}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-red-400/30 bg-red-500/10 p-6">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-200 font-heading">
            {t("champions.error", "Error al cargar")}
          </p>
          <p className="text-xs text-red-300/70">{error}</p>
        </div>
      </div>
    );
  }

  if (champions.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-gray-500 font-heading">
            {t("champions.empty", "No hay campeones disponibles")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {champions.map((champion) => {
        const roles = parseRoles(champion.roles_json);
        return (
          <ChampionCard
            key={champion.id}
            id={champion.id}
            name={champion.name}
            championKey={champion.champion_key}
            roles={roles}
            imageTileUrl={champion.image_tile_url || undefined}
            onClick={() => onChampionClick(champion)}
          />
        );
      })}
    </div>
  );
}