import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import {
  Users,
  AlertTriangle,
  X,
  TrendingUp,
  Swords,
  Crown,
} from "lucide-react";
import { ROLE_ICON_PATHS } from "../../lib/roleIcons";
import { Card, CardBody, CardHeader } from "../ui";

export interface Champion {
  id: number;
  name: string;
  champion_key: string;
  roles_json: string;
  counterpicks_json: string | null;
  synergies_json: string | null;
  image_tile_url: string | null;
  image_splash_url: string | null;
}

interface ChampionProfileProps {
  champion: Champion;
  onClose: () => void;
}

/**
 * Maps DB role names to ROLE_ICON_PATHS keys (uppercase)
 */
function mapRoleToIconPath(role: string): string | undefined {
  const normalized = role.toUpperCase();
  if (normalized === "TOP") return ROLE_ICON_PATHS.TOP;
  if (normalized === "JUNGLE") return ROLE_ICON_PATHS.JUNGLE;
  if (normalized === "JUNGLER") return ROLE_ICON_PATHS.JUNGLE;
  if (normalized === "MID") return ROLE_ICON_PATHS.MID;
  if (normalized === "ADC" || normalized === "BOT") return ROLE_ICON_PATHS.ADC;
  if (normalized === "SUPPORT") return ROLE_ICON_PATHS.SUPPORT;
  return undefined;
}

/**
 * Fallback champion tile URL from Data Dragon
 */
function fallbackTileUrl(championKey: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${championKey}_0.jpg`;
}

/**
 * Fallback champion splash URL from Data Dragon
 */
function fallbackSplashUrl(championKey: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championKey}_0.jpg`;
}

function parseJsonField<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    const parsed = JSON.parse(json);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

interface CounterpickOrSynergyItem {
  champion_key?: string;
  champion_name?: string;
  role?: string;
  reason?: string;
}

/**
 * QuickStat matching PlayerProfileHeroCard style
 */
function QuickStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-black/42 border border-white/20 rounded-xl px-5 py-3 text-center min-w-25 backdrop-blur-xs">
      <p className="text-xs text-gray-400 font-heading uppercase tracking-wider">
        {label}
      </p>
      <p className={`font-heading font-bold text-xl mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

/**
 * MobileQuickStat matching PlayerProfileHeroCard style
 */
function MobileQuickStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-navy-800 p-3 text-center">
      <p className="text-xs text-gray-400 dark:text-gray-500 font-heading uppercase tracking-wider">
        {label}
      </p>
      <p className={`font-heading font-bold text-lg mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

interface ChampionStatsSummary {
  champion_key: string;
  champion_name: string;
  total_games: number;
  total_wins: number;
  win_rate: number;
  pick_rate: number;
  avg_kills: number;
  avg_deaths: number;
  avg_assists: number;
  avg_kda: number;
  avg_gold: number;
  avg_damage: number;
  role_distribution: { role: string; games: number; percentage: number }[];
  best_against: { vs_champion_key: string; vs_champion_name: string; games: number; wins: number; win_rate: number }[];
  worst_against: { vs_champion_key: string; vs_champion_name: string; games: number; wins: number; win_rate: number }[];
  top_players: { player_id: string; player_name: string; team_name: string; games: number; win_rate: number; avg_kda: number }[];
  weekly_history: { week_label: string; games: number; win_rate: number; avg_kda: number }[];
}

export default function ChampionProfile({ champion, onClose }: ChampionProfileProps) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<ChampionStatsSummary | null>(null);

  // Parse JSON fields
  const roles = parseJsonField<string[]>(champion.roles_json, []);
  const counterpicks = parseJsonField<CounterpickOrSynergyItem[]>(
    champion.counterpicks_json,
    [],
  );
  const synergies = parseJsonField<CounterpickOrSynergyItem[]>(
    champion.synergies_json,
    [],
  );

  // Fetch champion stats
  useEffect(() => {
    invoke<ChampionStatsSummary>("get_champion_stats", { championKey: champion.champion_key })
      .then(setStats)
      .catch(() => { /* stats not available */ });
  }, [champion.champion_key]);

  // Determine image URLs
  const splashUrl =
    champion.image_splash_url || fallbackSplashUrl(champion.champion_key);
  const tileUrl =
    champion.image_tile_url || fallbackTileUrl(champion.champion_key);

  // Handle click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-navy-500 bg-navy-900 shadow-2xl">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Hero Banner - matching PlayerProfileHeroCard style */}
        <Card accent="primary" className="mb-0 rounded-b-none border-0">
          <div className="relative p-8 rounded-t-xl overflow-hidden">
            {splashUrl ? (
              <>
                <div
                  className="absolute inset-0 bg-cover opacity-100"
                  style={{
                    backgroundImage: `url(${splashUrl})`,
                    backgroundPosition: "center 12%",
                  }}
                />
                <div className="absolute inset-0 bg-linear-to-r from-black/88 via-black/28 to-transparent" />
              </>
            ) : (
              <div className="absolute inset-0 bg-linear-to-r from-navy-700 to-navy-800" />
            )}

            <div className="relative z-10 flex items-center gap-6">
              {/* Champion Avatar */}
              <div className="relative w-24 h-24 shrink-0">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-primary-500/40">
                  <img
                    src={tileUrl}
                    alt={champion.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>

              {/* Champion Info */}
              <div className="flex-1">
                <h2 className="text-3xl font-heading font-bold text-white uppercase tracking-wide">
                  {champion.name}
                </h2>
                <div className="flex items-center gap-3 mt-2">
                  {roles.map((role) => {
                    const iconPath = mapRoleToIconPath(role);
                    if (!iconPath) return null;
                    return (
                      <div
                        key={role}
                        className="flex items-center gap-1 rounded-lg bg-black/40 px-2 py-1"
                      >
                        <img
                          src={iconPath}
                          alt={role}
                          className="h-5 w-5"
                          title={role}
                        />
                        <span className="text-xs font-heading text-gray-200">
                          {role}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-gray-400 text-sm mt-2">
                  {champion.champion_key}
                </p>
              </div>

              {/* QuickStats - Desktop */}
              <div className="hidden md:flex items-center gap-3">
                <div className="grid grid-cols-3 gap-3 flex-1">
                  <QuickStat
                    label={t("champions.winRate", "Win Rate")}
                    value={stats ? `${stats.win_rate.toFixed(1)}%` : "--"}
                    color={stats && stats.win_rate >= 55 ? "text-green-400" : stats && stats.win_rate >= 45 ? "text-accent-300" : "text-red-400"}
                  />
                  <QuickStat
                    label={t("champions.pickRate", "Pick Rate")}
                    value={stats ? `${stats.pick_rate.toFixed(1)}%` : "--"}
                    color="text-primary-400"
                  />
                  <QuickStat
                    label={t("champions.games", "Games")}
                    value={stats ? `${stats.total_games}` : "--"}
                    color="text-white"
                  />
                  <QuickStat
                    label={t("champions.kda", "KDA")}
                    value={stats ? `${stats.avg_kda.toFixed(1)}` : "--"}
                    color={stats && stats.avg_kda >= 3.5 ? "text-green-400" : stats && stats.avg_kda >= 2.0 ? "text-accent-300" : "text-red-400"}
                  />
                  <QuickStat
                    label={t("champions.damage", "Dmg/G")}
                    value={stats ? `${(stats.avg_damage / 1000).toFixed(1)}k` : "--"}
                    color="text-orange-400"
                  />
                  <QuickStat
                    label={t("champions.gold", "Gold/G")}
                    value={stats ? `${(stats.avg_gold / 1000).toFixed(1)}k` : "--"}
                    color="text-yellow-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* QuickStats - Mobile */}
          <div className="grid grid-cols-3 gap-px bg-gray-200 dark:bg-navy-600 md:hidden">
            <MobileQuickStat
              label={t("champions.winRate", "Win Rate")}
              value={stats ? `${stats.win_rate.toFixed(1)}%` : "--"}
              color={stats && stats.win_rate >= 55 ? "text-green-500" : "text-accent-500"}
            />
            <MobileQuickStat
              label={t("champions.pickRate", "Pick Rate")}
              value={stats ? `${stats.pick_rate.toFixed(1)}%` : "--"}
              color="text-primary-500"
            />
            <MobileQuickStat
              label={t("champions.games", "Games")}
              value={stats ? `${stats.total_games}` : "--"}
              color="text-gray-700 dark:text-gray-200"
            />
            <MobileQuickStat
              label={t("champions.kda", "KDA")}
              value={stats ? `${stats.avg_kda.toFixed(1)}` : "--"}
              color={stats && stats.avg_kda >= 3.5 ? "text-green-500" : "text-gray-700 dark:text-gray-200"}
            />
            <MobileQuickStat
              label={t("champions.damage", "Dmg/G")}
              value={stats ? `${(stats.avg_damage / 1000).toFixed(1)}k` : "--"}
              color="text-orange-500"
            />
            <MobileQuickStat
              label={t("champions.gold", "Gold/G")}
              value={stats ? `${(stats.avg_gold / 1000).toFixed(1)}k` : "--"}
              color="text-yellow-600"
            />
          </div>
        </Card>

        {/* Content - Cards below banner */}
        <div className="max-h-[calc(90vh-18rem)] overflow-y-auto p-6 space-y-4">
          {/* Counterpicks Card */}
          <Card>
            <CardHeader>
              <span className="text-red-400">{t("champions.counterpicks", "Counterpicks")}</span>
            </CardHeader>
            <CardBody>
              {counterpicks.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {counterpicks.map((cp, idx) => {
                    const champKey = cp.champion_key || cp.champion_name || `unknown-${idx}`;
                    const imgUrl = fallbackTileUrl(champKey);
                    return (
                      <div
                        key={`cp-${idx}`}
                        className="flex items-center gap-2 rounded-lg border border-red-400/20 bg-navy-800/50 p-2"
                      >
                        <img
                          src={imgUrl}
                          alt={cp.champion_name || champKey}
                          className="h-10 w-10 rounded object-cover"
                          onError={(e) => {
                            const img = e.currentTarget;
                            img.onerror = null;
                            img.src = fallbackTileUrl(champKey);
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-heading font-semibold text-gray-100 truncate">
                            {cp.champion_name || champKey}
                          </p>
                          {cp.role && (
                            <p className="text-[10px] text-gray-400">
                              {cp.role}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <AlertTriangle className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    {t("champions.noCounterpicks", "Sin counterpicks registrados")}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Synergies Card */}
          <Card>
            <CardHeader>
              <span className="text-emerald-400">{t("champions.synergies", "Sinergias")}</span>
            </CardHeader>
            <CardBody>
              {synergies.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {synergies.map((syn, idx) => {
                    const champKey = syn.champion_key || syn.champion_name || `unknown-${idx}`;
                    const imgUrl = fallbackTileUrl(champKey);
                    return (
                      <div
                        key={`syn-${idx}`}
                        className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-navy-800/50 p-2"
                      >
                        <img
                          src={imgUrl}
                          alt={syn.champion_name || champKey}
                          className="h-10 w-10 rounded object-cover"
                          onError={(e) => {
                            const img = e.currentTarget;
                            img.onerror = null;
                            img.src = fallbackTileUrl(champKey);
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-heading font-semibold text-gray-100 truncate">
                            {syn.champion_name || champKey}
                          </p>
                          {syn.role && (
                            <p className="text-[10px] text-gray-400">
                              {syn.role}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Users className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    {t("champions.noSynergies", "Sin sinergias registradas")}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

          {/* Stats-derived matchup cards */}
          {stats && stats.best_against.length > 0 && (
            <Card>
              <CardHeader>
                <span className="flex items-center gap-2 text-green-400">
                  <Swords className="w-4 h-4" />
                  {t("champions.bestMatchups", "Mejores Matchups")}
                </span>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {stats.best_against.map((m, idx) => (
                    <div key={`bm-${idx}`} className="flex items-center gap-2 rounded-lg border border-green-400/20 bg-navy-800/50 p-2">
                      <img src={fallbackTileUrl(m.vs_champion_key)} alt={m.vs_champion_name} className="h-10 w-10 rounded object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-heading font-semibold text-gray-100 truncate">{m.vs_champion_name}</p>
                        <p className="text-xs text-green-400">{m.win_rate.toFixed(0)}% WR ({m.games}g)</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {stats && stats.worst_against.length > 0 && (
            <Card>
              <CardHeader>
                <span className="flex items-center gap-2 text-red-400">
                  <Swords className="w-4 h-4" />
                  {t("champions.worstMatchups", "Peores Matchups")}
                </span>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {stats.worst_against.map((m, idx) => (
                    <div key={`wm-${idx}`} className="flex items-center gap-2 rounded-lg border border-red-400/20 bg-navy-800/50 p-2">
                      <img src={fallbackTileUrl(m.vs_champion_key)} alt={m.vs_champion_name} className="h-10 w-10 rounded object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-heading font-semibold text-gray-100 truncate">{m.vs_champion_name}</p>
                        <p className="text-xs text-red-400">{m.win_rate.toFixed(0)}% WR ({m.games}g)</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {stats && stats.top_players.length > 0 && (
            <Card>
              <CardHeader>
                <span className="flex items-center gap-2 text-yellow-400">
                  <Crown className="w-4 h-4" />
                  {t("champions.topPlayers", "Mejores Jugadores")}
                </span>
              </CardHeader>
              <CardBody>
                <div className="space-y-2">
                  {stats.top_players.map((p, idx) => (
                    <div key={`tp-${idx}`} className="flex items-center gap-3 rounded-lg border border-navy-600 bg-navy-800/50 p-2">
                      <span className="text-xs font-heading font-bold text-gray-400 w-5 text-center">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-heading font-semibold text-gray-100 truncate">{p.player_name}</p>
                        <p className="text-[10px] text-gray-400">{p.team_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-heading font-bold text-green-400">{p.win_rate.toFixed(0)}%</p>
                        <p className="text-[10px] text-gray-400">{p.games}g · {p.avg_kda.toFixed(1)} KDA</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {stats && stats.weekly_history.length > 0 && (
            <Card>
              <CardHeader>
                <span className="flex items-center gap-2 text-primary-400">
                  <TrendingUp className="w-4 h-4" />
                  {t("champions.weeklyHistory", "Historial Semanal")}
                </span>
              </CardHeader>
              <CardBody>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-heading">
                    <thead>
                      <tr className="text-gray-400 uppercase tracking-wider border-b border-navy-600">
                        <th className="text-left py-2 pr-4">Semana</th>
                        <th className="text-right py-2 pr-4">G</th>
                        <th className="text-right py-2 pr-4">WR</th>
                        <th className="text-right py-2">KDA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.weekly_history.map((w, idx) => (
                        <tr key={`wh-${idx}`} className="border-b border-navy-700/50">
                          <td className="py-1.5 pr-4 text-gray-300">{w.week_label}</td>
                          <td className="text-right py-1.5 pr-4 text-gray-300">{w.games}</td>
                          <td className={`text-right py-1.5 pr-4 font-bold ${w.win_rate >= 55 ? "text-green-400" : w.win_rate >= 45 ? "text-accent-300" : "text-red-400"}`}>{w.win_rate.toFixed(0)}%</td>
                          <td className="text-right py-1.5 text-gray-300">{w.avg_kda.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          )}
      </div>
    </div>
  );
}
