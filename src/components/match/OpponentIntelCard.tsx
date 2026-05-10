import type { OpponentIntelSnapshot } from "./opponentIntelService";
import { useTranslation } from "react-i18next";

export default function OpponentIntelCard({ intel }: { intel: OpponentIntelSnapshot }) {
  const { t } = useTranslation();

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-navy-700 bg-white/90 dark:bg-navy-800/70 p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 font-heading">{t("match.opponentIntel.kicker", "Pre-match preparation")}</p>
          <h3 className="font-heading text-lg font-bold text-gray-900 dark:text-white">{t("match.opponentIntel.title", "Opponent intelligence")}</h3>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("match.opponentIntel.confidence", "Intel confidence")}</p>
          <p className="font-heading font-bold text-sm text-primary-600 dark:text-primary-300">
            {intel.confidence.qualityLabel.toUpperCase()} · {intel.confidence.poolCoveragePct}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h4 className="text-xs uppercase tracking-wider font-heading text-gray-500 dark:text-gray-400">{t("match.opponentIntel.rivalPoolByRole", "Rival champion pool by role")}</h4>
          {intel.playerPools.map((pool) => (
            <div key={`${pool.playerName}-${pool.role}`} className="rounded-xl border border-gray-200 dark:border-navy-700 p-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{pool.playerName} <span className="text-xs text-gray-500">({pool.role})</span></p>
              <div className="mt-2 flex flex-wrap gap-2">
                {pool.champions.length === 0 ? (
                  <span className="text-xs text-gray-500">{t("match.opponentIntel.noPoolYet", "No champion pool revealed yet.")}</span>
                ) : pool.champions.map((champion) => (
                  <span key={`${pool.playerName}-${champion.championId}`} className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-navy-700 text-gray-700 dark:text-gray-200">
                    {champion.championName} · {Math.round(champion.mastery)}%
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h4 className="text-xs uppercase tracking-wider font-heading text-gray-500 dark:text-gray-400">{t("match.opponentIntel.suggestedBans", "Suggested bans")}</h4>
          <div className="rounded-xl border border-gray-200 dark:border-navy-700 p-3">
            <ul className="space-y-2">
              {intel.suggestedBans.map((ban) => (
                <li key={`ban-${ban.championId}`} className="flex justify-between text-sm text-gray-800 dark:text-gray-200">
                  <span>{ban.championName}</span>
                  <span className="text-xs text-gray-500">{t("match.opponentIntel.threat", "Threat")} {ban.threatScore.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          </div>

          <h4 className="text-xs uppercase tracking-wider font-heading text-gray-500 dark:text-gray-400">{t("match.opponentIntel.metaThreats", "Meta threats")}</h4>
          <div className="rounded-xl border border-gray-200 dark:border-navy-700 p-3">
            <ul className="space-y-2">
              {intel.metaThreats.map((champion) => (
                <li key={`meta-${champion.championId}`} className="flex justify-between text-sm text-gray-800 dark:text-gray-200">
                  <span>{champion.championName}</span>
                  <span className="text-xs text-gray-500">{t("match.opponentIntel.meta", "Meta")} {champion.metaScore}</span>
                </li>
              ))}
            </ul>
          </div>

          <h4 className="text-xs uppercase tracking-wider font-heading text-gray-500 dark:text-gray-400">{t("match.opponentIntel.masteryHighlights", "Mastery highlights")}</h4>
          <div className="rounded-xl border border-gray-200 dark:border-navy-700 p-3 flex flex-wrap gap-2">
            {intel.masteryHighlights.map((champion) => (
              <span key={`mastery-${champion.championId}`} className="text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                {champion.championName} · {Math.round(champion.mastery)}%
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
