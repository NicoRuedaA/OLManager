import { useEffect, useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, Users, AlertTriangle, TrendingUp, Swords, Crown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGameStore } from "../store/gameStore";
import { ROLE_ICON_PATHS } from "../lib/roleIcons";
import { Card, CardBody, CardHeader } from "../components/ui";
import { resolveChampionTile, resolveChampionSplash } from "../lib/championImages";

export interface ChampionPageProps {
  championKey: string;
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
  a?: string;
  b?: string;
  value?: number;
  champion_key?: string;
  champion_name?: string;
  role?: string;
  reason?: string;
}

/**
 * Extracts the opposing champion key from a counterpick/synergy entry.
 */
function extractOpponentKey(item: CounterpickOrSynergyItem, subjectKey: string): string {
  if (item.champion_key) return item.champion_key;
  if (item.a === subjectKey && item.b) return item.b;
  if (item.b && item.b !== subjectKey) return item.b;
  if (item.a && item.a !== subjectKey) return item.a;
  return item.champion_name || "";
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
  ban_rate: number;
  avg_kills: number;
  avg_deaths: number;
  avg_assists: number;
  avg_kda: number;
  avg_gold: number;
  avg_damage: number;
  avg_cs: number;
  avg_vision: number;
  role_distribution: { role: string; games: number; percentage: number }[];
  best_against: { vs_champion_key: string; vs_champion_name: string; games: number; wins: number; win_rate: number }[];
  worst_against: { vs_champion_key: string; vs_champion_name: string; games: number; wins: number; win_rate: number }[];
  top_players: { player_id: string; player_name: string; team_name: string; games: number; win_rate: number; avg_kda: number }[];
  most_played_players: { player_id: string; player_name: string; team_name: string; games: number; win_rate: number; avg_kda: number }[];
  weekly_history: { week_label: string; games: number; win_rate: number; avg_kda: number }[];
}

export default function ChampionPage({ championKey, onClose }: ChampionPageProps) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<ChampionStatsSummary | null>(null);

  useEffect(() => {
    console.log("[ChampionPage] fetching stats for", championKey);
    invoke<ChampionStatsSummary>("get_champion_stats", { championKey })
      .then((data) => {
        console.log("[ChampionPage] stats received:", data);
        setStats(data);
      })
      .catch((err) => {
        console.error("[ChampionPage] failed to fetch stats:", err);
      });
  }, [championKey]);

  // Get champions from game store - stable selector
  const champions = useGameStore((state) => state.gameState?.champions);

  // Find champion by champion_key
  const champion = useMemo(() => {
    if (!champions || !championKey) return undefined;
    return champions.find((c) => c.champion_key === championKey);
  }, [champions, championKey]);

  // Handle keyboard escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Don't render if no champion (show loading or not found)
  if (!champions) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="text-gray-400">{t("common.loading", "Cargando...")}</div>
      </div>
    );
  }

  if (!champion) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-gray-400 text-lg">{t("champions.notFound", "Campeón no encontrado")}</p>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 mx-auto text-primary-400 hover:text-primary-300 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-heading">{t("common.back", "Volver")}</span>
          </button>
        </div>
      </div>
    );
  }

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

  // Determine image URLs — local webp only
  const splashUrl =
    champion.image_splash_url
    || resolveChampionSplash(champion.champion_key)
    || "";
  const tileUrl =
    champion.image_tile_url
    || resolveChampionTile(champion.champion_key)
    || "";

  return (
    <div className="min-h-screen bg-navy-900">
      {/* Back button - matching PlayerProfile style */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-heading font-bold uppercase tracking-wider">
            {t("common.back")}
          </span>
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-8">
        {/* Hero Card - matching PlayerProfileHeroCard */}
        <Card accent="primary" className="mb-5">
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
              {/* Champion Avatar - matching player photo style */}
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
                  {champion.champion_key}
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

              </div>

              {/* QuickStats - Desktop (solo WR, PR, BR en banner) */}
              <div className="hidden md:flex items-center gap-3">
                <div className="grid grid-cols-3 gap-2 flex-1">
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
                    label={t("champions.banRate", "Ban Rate")}
                    value={stats ? `${stats.ban_rate.toFixed(1)}%` : "--"}
                    color="text-red-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* QuickStats - Mobile (solo WR, PR, BR) */}
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
              label={t("champions.banRate", "Ban Rate")}
              value={stats ? `${stats.ban_rate.toFixed(1)}%` : "--"}
              color="text-red-500"
            />
          </div>
        </Card>

        {/* Main content grid - matching PlayerProfile layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column - Counterpicks */}
          <Card>
            <CardHeader>
              <span className="text-red-400">{t("champions.counterpicks", "Counterpicks")}</span>
            </CardHeader>
            <CardBody>
              {counterpicks.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {counterpicks.map((item, idx) => {
                    const champKey = extractOpponentKey(item, champion.champion_key);
                    const imgUrl = champKey
                      ? (resolveChampionTile(champKey) ?? "")
                      : "";
                    return (
                      <div
                        key={`cp-${idx}`}
                        className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-navy-600 last:border-0"
                      >
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={champKey}
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-navy-700" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-heading font-semibold text-gray-100 truncate">
                            {champKey}
                          </p>
                          {item.value !== undefined && (
                            <p className="text-xs text-gray-400">
                              {item.value} {item.value === 1 ? "game" : "games"}
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

          {/* Right column - Synergies + Role Distribution + Stats cards */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            <Card>
              <CardHeader>
                <span className="text-emerald-400">{t("champions.synergies", "Sinergias")}</span>
              </CardHeader>
              <CardBody>
                {synergies.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {synergies.map((item, idx) => {
                      const champKey = extractOpponentKey(item, champion.champion_key);
                      const imgUrl = champKey
                        ? (resolveChampionTile(champKey) ?? "")
                        : "";
                      return (
                        <div
                          key={`syn-${idx}`}
                          className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-navy-800/50 p-2"
                        >
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={champKey}
                              className="h-10 w-10 rounded object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded bg-navy-700" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-heading font-semibold text-gray-100 truncate">
                              {champKey}
                            </p>
                            {item.value !== undefined && (
                              <p className="text-2xs text-gray-400">
                                {item.value} {item.value === 1 ? "game" : "games"}
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

            {/* Stats detalladas en el cuerpo */}
            {stats && (
              <Card>
                <CardHeader>{t("champions.stats", "Estadísticas")}</CardHeader>
                <CardBody>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                    <div className="text-center p-3 rounded-lg bg-navy-800/50">
                      <p className="text-xs text-gray-400">{t("champions.kda", "KDA")}</p>
                      <p className="text-lg font-heading font-bold mt-1" style={{ color: stats.avg_kda >= 3.5 ? "#4ade80" : stats.avg_kda >= 2.0 ? "#fbbf24" : "#f87171" }}>{stats.avg_kda.toFixed(1)}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-navy-800/50">
                      <p className="text-xs text-gray-400">{t("champions.games", "Games")}</p>
                      <p className="text-lg font-heading font-bold mt-1 text-gray-200">{stats.total_games}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-navy-800/50">
                      <p className="text-xs text-gray-400">{t("champions.damage", "Dmg/G")}</p>
                      <p className="text-lg font-heading font-bold mt-1 text-orange-400">{(stats.avg_damage / 1000).toFixed(1)}k</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-navy-800/50">
                      <p className="text-xs text-gray-400">{t("champions.gold", "Gold/G")}</p>
                      <p className="text-lg font-heading font-bold mt-1 text-yellow-400">{(stats.avg_gold / 1000).toFixed(1)}k</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-navy-800/50">
                      <p className="text-xs text-gray-400">{t("champions.cs", "CS")}</p>
                      <p className="text-lg font-heading font-bold mt-1 text-purple-400">{stats.avg_cs.toFixed(0)}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-navy-800/50">
                      <p className="text-xs text-gray-400">{t("champions.macro_play", "Vision")}</p>
                      <p className="text-lg font-heading font-bold mt-1 text-cyan-400">{stats.avg_vision.toFixed(0)}</p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Stats-derived cards — siempre visibles, con estado vacío */}
            {stats && (
              <Card>
                <CardHeader><span className="flex items-center gap-2 text-primary-400"><Users className="w-4 h-4" />{t("champions.roles", "Roles")}</span></CardHeader>
                <CardBody>
                  {stats.role_distribution.length > 0 ? (
                    <div className="space-y-2">
                      {stats.role_distribution.map((r, idx) => (
                        <div key={`rd-${idx}`} className="flex items-center gap-3">
                          <span className="text-xs font-heading font-bold text-gray-300 w-16 uppercase">{r.role}</span>
                          <div className="flex-1 h-4 rounded-full bg-navy-700 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400" style={{ width: `${r.percentage}%` }} />
                          </div>
                          <span className="text-xs font-heading text-gray-400 w-16 text-right">{r.percentage.toFixed(0)}%</span>
                          <span className="text-xs text-gray-500 w-12 text-right">{r.games}g</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">{t("champions.noData", "Sin datos")}</p>
                  )}
                </CardBody>
              </Card>
            )}

            {stats && (
              <Card>
                <CardHeader><span className="flex items-center gap-2 text-green-400"><Swords className="w-4 h-4" />{t("champions.bestMatchups", "Mejores Matchups")}</span></CardHeader>
                <CardBody>
                  {stats.best_against.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {stats.best_against.map((m, idx) => (
                        <div key={`bm-${idx}`} className="flex items-center gap-2 rounded-lg border border-green-400/20 bg-navy-800/50 p-2">
                          <img
                            src={resolveChampionTile(m.vs_champion_key) ?? ""}
                            alt={m.vs_champion_name}
                            className="h-10 w-10 rounded object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-heading font-semibold text-gray-100 truncate">{m.vs_champion_name}</p>
                            <p className="text-xs text-green-400">{m.win_rate.toFixed(0)}% WR ({m.games}g)</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">{t("champions.noData", "Sin datos")}</p>
                  )}
                </CardBody>
              </Card>
            )}

            {stats && (
              <Card>
                <CardHeader><span className="flex items-center gap-2 text-red-400"><Swords className="w-4 h-4" />{t("champions.worstMatchups", "Peores Matchups")}</span></CardHeader>
                <CardBody>
                  {stats.worst_against.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {stats.worst_against.map((m, idx) => (
                        <div key={`wm-${idx}`} className="flex items-center gap-2 rounded-lg border border-red-400/20 bg-navy-800/50 p-2">
                          <img
                            src={resolveChampionTile(m.vs_champion_key) ?? ""}
                            alt={m.vs_champion_name}
                            className="h-10 w-10 rounded object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-heading font-semibold text-gray-100 truncate">{m.vs_champion_name}</p>
                            <p className="text-xs text-red-400">{m.win_rate.toFixed(0)}% WR ({m.games}g)</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">{t("champions.noData", "Sin datos")}</p>
                  )}
                </CardBody>
              </Card>
            )}

            {stats && (
              <Card>
                <CardHeader><span className="flex items-center gap-2 text-yellow-400"><Crown className="w-4 h-4" />{t("champions.topPlayers", "Mejores Jugadores")}</span></CardHeader>
                <CardBody>
                  {stats.top_players.length > 0 ? (
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
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">{t("champions.noData", "Sin datos")}</p>
                  )}
                </CardBody>
              </Card>
            )}

            {stats && (
              <Card>
                <CardHeader><span className="flex items-center gap-2 text-indigo-400"><Users className="w-4 h-4" />{t("champions.mostPlayed", "Mas Jugados")}</span></CardHeader>
                <CardBody>
                  {stats.most_played_players.length > 0 ? (
                    <div className="space-y-2">
                      {stats.most_played_players.map((p, idx) => (
                        <div key={`mp-${idx}`} className="flex items-center gap-3 rounded-lg border border-navy-600 bg-navy-800/50 p-2">
                          <span className="text-xs font-heading font-bold text-gray-400 w-5 text-center">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-heading font-semibold text-gray-100 truncate">{p.player_name}</p>
                            <p className="text-[10px] text-gray-400">{p.team_name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-heading font-bold text-indigo-400">{p.games}g</p>
                            <p className="text-[10px] text-gray-400">{p.win_rate.toFixed(0)}% WR</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">{t("champions.noData", "Sin datos")}</p>
                  )}
                </CardBody>
              </Card>
            )}

            {stats && (
              <Card>
                <CardHeader><span className="flex items-center gap-2 text-primary-400"><TrendingUp className="w-4 h-4" />{t("champions.weeklyHistory", "Historial Semanal")}</span></CardHeader>
                <CardBody>
                  {stats.weekly_history.length > 0 ? (
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
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">{t("champions.noData", "Sin datos")}</p>
                  )}
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
