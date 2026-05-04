import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Users,
  AlertTriangle,
  X,
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

export default function ChampionProfile({ champion, onClose }: ChampionProfileProps) {
  const { t } = useTranslation();

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
                    value="--"
                    color="text-accent-300"
                  />
                  <QuickStat
                    label={t("champions.pickRate", "Pick Rate")}
                    value="--"
                    color="text-primary-400"
                  />
                  <QuickStat
                    label={t("champions.banRate", "Ban Rate")}
                    value="--"
                    color="text-red-400"
                  />
                  <QuickStat
                    label={t("champions.kda", "KDA")}
                    value="--"
                    color="text-gray-200"
                  />
                  <QuickStat
                    label={t("champions.tier", "Tier")}
                    value="--"
                    color="text-white"
                  />
                  <QuickStat
                    label={t("champions.difficulty", "Dificultad")}
                    value="--"
                    color="text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* QuickStats - Mobile */}
          <div className="grid grid-cols-3 gap-px bg-gray-200 dark:bg-navy-600 md:hidden">
            <MobileQuickStat
              label={t("champions.winRate", "Win Rate")}
              value="--"
              color="text-accent-500"
            />
            <MobileQuickStat
              label={t("champions.pickRate", "Pick Rate")}
              value="--"
              color="text-primary-500"
            />
            <MobileQuickStat
              label={t("champions.banRate", "Ban Rate")}
              value="--"
              color="text-red-500"
            />
            <MobileQuickStat
              label={t("champions.kda", "KDA")}
              value="--"
              color="text-gray-700 dark:text-gray-200"
            />
            <MobileQuickStat
              label={t("champions.tier", "Tier")}
              value="--"
              color="text-gray-700 dark:text-gray-200"
            />
            <MobileQuickStat
              label={t("champions.difficulty", "Dificultad")}
              value="--"
              color="text-gray-700 dark:text-gray-200"
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
      </div>
    </div>
  );
}
