import { Crown, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import ProfileCardShell from "@/ui-v2/pages/ProfileCardShell";
import { asset } from "@/lib/asset";

interface ChampionMasteryItem {
  championId: string;
  championName: string;
  mastery: number;
  rank: "insignia" | 1 | 2 | 3;
  wr: number;
  games: number;
}

interface PlayerProfileChampionsCardProps {
  champions: ChampionMasteryItem[];
  onViewChampion?: (championKey: string) => void;
}

export default function PlayerProfileChampionsCard({ champions, onViewChampion }: PlayerProfileChampionsCardProps) {
  const { t } = useTranslation();

  const handleChampionClick = (championId: string) => {
    onViewChampion?.(championId);
  };

  const TOTAL_SLOTS = 6;

  return (
    <ProfileCardShell title={t("playerProfile.championPoolTitle")}>
        <div className="grid grid-cols-2 grid-rows-3 gap-2.5 h-full min-h-0">
          {Array.from({ length: TOTAL_SLOTS }).map((_, i) => {
            const champion = champions[i];

            if (champion) {
              return (
                <button
                  type="button"
                  key={champion.championId}
                  onClick={() => handleChampionClick(champion.championId)}
                  className="relative h-full rounded-xl overflow-hidden border border-border bg-card text-left cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(251,191,36,0.2)] hover:border-yellow-400"
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${asset(`/champion-tiles/${champion.championId}.webp`, "champion") ?? ""})` }}
                  />
                  <div className="absolute inset-0 bg-linear-to-b from-black/40 via-black/50 to-black/65" />

                  <div className="relative z-10 p-2.5 h-full flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      {champion.rank === "insignia" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-2xs font-heading font-bold uppercase tracking-wide bg-amber-500/20 text-amber-300 border border-amber-300/35">
                          <Crown className="w-3 h-3" /> {t("playerProfile.championInsignia")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-heading font-bold uppercase tracking-wide bg-white/20 text-white border border-white/35">
                          #{champion.rank}
                        </span>
                      )}

                      <div className="flex flex-col items-end gap-0.5">
                        <span className={`text-lg font-heading font-black ${champion.wr >= 55 ? "text-emerald-300" : champion.wr >= 48 ? "text-amber-300" : "text-rose-300"}`}>
                          {champion.wr.toFixed(1)}% {t("playerProfile.championWinRateShort")}
                        </span>
                        <div className="w-14 h-1 rounded-full bg-white/15 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${champion.wr >= 55 ? "bg-emerald-400" : champion.wr >= 48 ? "bg-amber-400" : "bg-rose-400"}`}
                            style={{ width: `${Math.min(100, champion.wr)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-white/90">
                        <p className="text-xs">{t("playerProfile.championMasteryLabel", { value: champion.mastery })}</p>
                        <p className="text-2xl font-heading font-black leading-none">
                          {champion.games} <span className="text-lg">{t("playerProfile.championGames")}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              );
            }

            return (
              <div
                key={`empty-${i}`}
                className="relative h-full overflow-hidden rounded-xl border border-border/40 bg-card"
              >
                <div className="absolute inset-0 bg-linear-to-b from-black/40 via-black/50 to-black/65" />
              </div>
            );
          })}
        </div>
    </ProfileCardShell>
  );
}



