import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";
import ChampionsGrid from "../champions/ChampionsGrid";
import ChampionProfile, { type Champion } from "../champions/ChampionProfile";

export default function ChampionsWorldTab() {
  const { t } = useTranslation();
  const [selectedChampion, setSelectedChampion] = useState<Champion | null>(
    null,
  );

  function handleChampionClick(champion: Champion) {
    setSelectedChampion(champion);
  }

  function handleCloseProfile() {
    setSelectedChampion(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-yellow-400/30 bg-linear-to-br from-navy-900 via-navy-900 to-black p-5 shadow-[0_0_30px_rgba(251,191,36,0.08)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-yellow-300/80 font-heading">
              {t("champions.worldTitle", "World Champions")}
            </p>
            <h2 className="mt-1 text-2xl font-heading font-bold text-white">
              {t("champions.allChampions", "Todos los Campeones")}
            </h2>
            <p className="mt-1 text-sm text-gray-300">
              {t(
                "champions.worldDescription",
                "Explora todos los campeones de League of Legends",
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-navy-600 bg-navy-900/70 px-4 py-3">
            <Users className="h-5 w-5 text-yellow-400" />
            <div>
              <p className="text-xs text-gray-400">
                {t("champions.totalChampions", "Total")}
              </p>
              <p className="text-sm font-heading font-semibold text-yellow-300">
                {t("champions.170", "170+")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Champions Grid */}
      <section className="rounded-2xl border border-gray-200 dark:border-navy-600 bg-white dark:bg-navy-800 p-4">
        <ChampionsGrid onChampionClick={handleChampionClick} />
      </section>

      {/* Champion Profile Modal */}
      {selectedChampion && (
        <ChampionProfile
          champion={selectedChampion}
          onClose={handleCloseProfile}
        />
      )}
    </div>
  );
}