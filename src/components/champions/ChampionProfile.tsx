import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { ROLE_ICON_PATHS } from "../../lib/roleIcons";

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

function inferRoleHints(items: CounterpickOrSynergyItem[]): string[] {
  const rolesSet = new Set<string>();
  items.forEach((item) => {
    if (item.role) {
      rolesSet.add(item.role);
    }
  });
  return Array.from(rolesSet);
}

export default function ChampionProfile({ champion, onClose }: ChampionProfileProps) {
  const { t } = useTranslation();
  const [showFullImage, setShowFullImage] = useState(false);

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

        {/* Splash/Tile Image */}
        <div
          className="relative h-64 w-full cursor-pointer overflow-hidden"
          onClick={() => setShowFullImage(!showFullImage)}
        >
          <img
            src={showFullImage ? splashUrl : tileUrl}
            alt={champion.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-900 via-navy-900/50 to-transparent" />

          {/* Champion Name Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h2 className="text-3xl font-heading font-bold text-white">
              {champion.name}
            </h2>
            <div className="flex gap-2 mt-2">
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
        </div>

        {/* Content */}
        <div className="max-h-[calc(90vh-16rem)] overflow-y-auto p-6 space-y-6">
          {/* Counterpicks Section */}
          {counterpicks.length > 0 && (
            <section className="rounded-xl border border-red-400/30 bg-red-500/5 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-lg font-heading font-bold uppercase tracking-wider text-red-300">
                {t("champions.counterpicks", "Counterpicks")}
              </h3>
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
              {inferRoleHints(counterpicks).length > 0 && (
                <p className="mt-2 text-xs text-gray-400">
                  <span className="font-heading">Roles: </span>
                  {inferRoleHints(counterpicks).join(", ")}
                </p>
              )}
            </section>
          )}

          {/* Synergies Section */}
          {synergies.length > 0 && (
            <section className="rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-lg font-heading font-bold uppercase tracking-wider text-emerald-300">
                {t("champions.synergies", "Sinergias")}
              </h3>
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
              {inferRoleHints(synergies).length > 0 && (
                <p className="mt-2 text-xs text-gray-400">
                  <span className="font-heading">Roles: </span>
                  {inferRoleHints(synergies).join(", ")}
                </p>
              )}
            </section>
          )}

          {/* Empty state if no counterpicks or synergies */}
          {counterpicks.length === 0 && synergies.length === 0 && (
            <div className="rounded-xl border border-navy-600 bg-navy-800/50 p-6 text-center">
              <p className="text-sm text-gray-400">
                {t(
                  "champions.noData",
                  "No hay información de counterpicks o sinergias disponible.",
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}