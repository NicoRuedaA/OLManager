import { useTranslation } from "react-i18next";
import type { JSX } from "react";
import { MatchSnapshot, EnginePlayerData } from "./types";
import { Badge } from "../ui";
import { ArrowUpDown, AlertTriangle, Wand2 } from "lucide-react";
import { resolvePlayerPhoto } from "../../lib/playerPhotos";
import { calcOvr } from "../../lib/lolPlayerStats";

export type LolRole = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";

export const LOL_ROLE_ORDER: LolRole[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

export const ROLE_KEY_STATS: Record<LolRole, { label: string; key: string }[]> = {
  TOP: [
    { label: "MEC", key: "mechanics" },
    { label: "TF", key: "teamfighting" },
    { label: "DISC", key: "discipline" },
  ],
  JUNGLE: [
    { label: "MAC", key: "macro_play" },
    { label: "SHOT", key: "shotcalling" },
    { label: "DISC", key: "discipline" },
  ],
  MID: [
    { label: "MEC", key: "mechanics" },
    { label: "LAN", key: "laning" },
    { label: "MAC", key: "macro_play" },
  ],
  ADC: [
    { label: "LAN", key: "laning" },
    { label: "MEC", key: "mechanics" },
    { label: "MENT", key: "mental_resilience" },
  ],
  SUPPORT: [
    { label: "SHOT", key: "shotcalling" },
    { label: "MAC", key: "macro_play" },
    { label: "TF", key: "teamfighting" },
  ],
};

export function getPlayerLolRole(player: EnginePlayerData): LolRole {
  // Engine sends role as PascalCase (Top, Jungle, Mid, Adc, Support)
  const engineRole = String(player.role || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (engineRole === "TOP") return "TOP";
  if (engineRole === "JUNGLE") return "JUNGLE";
  if (engineRole === "MID") return "MID";
  if (engineRole === "ADC") return "ADC";
  if (engineRole === "SUPPORT") return "SUPPORT";

  return "JUNGLE";
}

/** Delegates to the shared OVR formula so every view uses the same calculation. */
export function getPositionOvr(p: EnginePlayerData): number {
  return calcOvr(
    p.mechanics,
    p.laning,
    p.teamfighting,
    p.macro_play,
    p.consistency,
    p.shotcalling,
    p.champion_pool,
    p.discipline,
    p.mental_resilience,
  );
}

export function condColor(c: number): string {
  if (c >= 75) return "text-primary-400";
  if (c >= 50) return "text-amber-400";
  return "text-red-400";
}

export function statColor(v: number): string {
  if (v >= 75) return "text-primary-400 font-bold";
  if (v >= 60) return "text-gray-200";
  return "text-gray-500";
}

export function getStatVal(p: EnginePlayerData, key: string): number {
  return (p as unknown as Record<string, number>)[key] ?? 0;
}

const LOL_ROLE_ICON_URLS: Record<LolRole, string> = {
  TOP: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-top.png",
  JUNGLE: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-jungle.png",
  MID: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-middle.png",
  ADC: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom.png",
  SUPPORT: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-utility.png",
};

export function parseFormationNeeds(_formation: string): Record<string, number> {
  return {
    TOP: 1,
    JUNGLE: 1,
    MID: 1,
    ADC: 1,
    SUPPORT: 1,
  };
}

interface PreMatchLineupProps {
  homeTeam: MatchSnapshot["home_team"];
  homeBench: EnginePlayerData[];
  awayTeam: MatchSnapshot["home_team"];
  awayBench: EnginePlayerData[];
  homeTeamColor: string;
  awayTeamColor: string;
  userSide: "Home" | "Away";
  selectedStarterId: string | null;
  isAutoSelecting: boolean;
  onSelectStarter: (id: string | null) => void;
  onSwap: (benchPlayerId: string) => void;
  onAutoSelect: () => void;
}

/** Renders a full lineup + bench column for one team. */
function TeamLineupColumn({
  team,
  bench,
  teamColor,
  isUserSide,
  selectedStarterId,
  onSelectStarter,
  onSwap,
}: {
  team: MatchSnapshot["home_team"];
  bench: EnginePlayerData[];
  teamColor: string;
  isUserSide: boolean;
  selectedStarterId: string | null;
  onSelectStarter: (id: string | null) => void;
  onSwap: (benchPlayerId: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const startersLabel = `${t("match.lineup")} 5`;

  return (
    <div className="bg-white dark:bg-navy-800 rounded-xl border border-gray-200 dark:border-navy-700 shadow-sm p-4 transition-colors duration-300">
      {/* Header: Alineación 5 + Auto-select (user only) */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          {startersLabel}
        </h3>
        <div className="flex items-center gap-2">
          {selectedStarterId && isUserSide && (
            <button
              onClick={() => onSelectStarter(null)}
              className="text-[10px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 font-heading uppercase tracking-wider"
            >
              {t("match.cancel")}
            </button>
          )}
          <Badge variant="primary" size="sm">
            {t("match.nPlayers", { count: team.players.length })}
          </Badge>

        </div>
      </div>

      {selectedStarterId && isUserSide && (
        <p className="text-[10px] text-accent-400 font-heading uppercase tracking-wider mb-2">
          {t("match.swapPrompt")}
        </p>
      )}

      {/* Per-role lineup */}
      {LOL_ROLE_ORDER.map((role) => {
        const players = team.players.filter((p) => getPlayerLolRole(p) === role);
        const keyStats = ROLE_KEY_STATS[role] || [];
        return (
          <div key={role} className="mb-1">
            {players.length === 0 ? (
              <div className="flex items-center gap-2 py-1.5 px-2 text-[11px] text-gray-500 dark:text-gray-400">
                <img src={LOL_ROLE_ICON_URLS[role]} alt={role} className="w-5 h-5 object-contain flex-shrink-0" title={role} />
                {t("match.noBenchAvailable2")}
              </div>
            ) : (
              players.map((p) => {
                const ovr = getPositionOvr(p);
                const isSelected = isUserSide && selectedStarterId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (!isUserSide) return;
                      onSelectStarter(isSelected ? null : p.id);
                    }}
                    className={`flex items-center gap-2 py-1.5 px-2 rounded w-full text-left transition-all ${
                      !isUserSide
                        ? "cursor-default"
                        : isSelected
                          ? "bg-primary-500/20 ring-1 ring-primary-500/50"
                          : "hover:bg-gray-100 dark:hover:bg-navy-700/50"
                    }`}
                  >
                    {resolvePlayerPhoto(p.id, p.name) ? (
                      <img
                        src={resolvePlayerPhoto(p.id, p.name) || ""}
                        alt={p.name}
                        className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-heading font-bold flex-shrink-0"
                        style={{
                          backgroundColor: teamColor + "30",
                          color: teamColor,
                        }}
                      >
                        {p.name.substring(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm text-gray-800 dark:text-gray-200 font-medium flex-1 truncate">
                      {p.name}
                    </span>
                    <img src={LOL_ROLE_ICON_URLS[role]} alt={role} className="w-5 h-5 object-contain" title={role} />
                    {isSelected && <ArrowUpDown className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />}
                    <div className="flex items-center gap-0">
                      <span
                        className={`text-[10px] font-heading font-bold tabular-nums w-7 text-center ${
                          ovr >= 70 ? "text-primary-400" : ovr >= 50 ? "text-gray-300" : "text-red-400"
                        }`}
                      >
                        {ovr}
                      </span>
                      {keyStats.map((s) => (
                        <span
                          key={s.label}
                          className={`text-[10px] font-heading tabular-nums w-7 text-center ${statColor(
                            getStatVal(p, s.key),
                          )}`}
                        >
                          {getStatVal(p, s.key)}
                        </span>
                      ))}
                    </div>
                    <span className={`text-xs tabular-nums w-8 text-right ${condColor(p.condition)}`}>
                      {Math.round(p.condition)}%
                    </span>
                  </button>
                );
              })
            )}
          </div>
        );
      })}

      {/* Bench / Substitutes */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-navy-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
            {t("match.substitutes")}
          </h3>
          <Badge variant="neutral" size="sm">
            {t("match.nAvailable", { count: bench.length })}
          </Badge>
        </div>
        {bench.length === 0 ? (
          <p className="text-xs text-gray-600 dark:text-gray-500">{t("match.noBenchAvailable2")}</p>
            ) : (
            <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 px-2 pb-1">
              <span className="w-7" />
              <span className="flex-1" />
              <span className="text-[8px] font-heading uppercase tracking-widest text-gray-600 dark:text-gray-500 w-8 text-center">
                POS
              </span>
              <span className="text-[8px] font-heading uppercase tracking-widest text-gray-600 w-[84px] text-center">
                {t("match.keyStats")}
              </span>
              <span className="text-[8px] font-heading uppercase tracking-widest text-gray-600 w-8 text-right">
                FIT
              </span>
            </div>
            {bench.map((bp) => {
              const role = getPlayerLolRole(bp);
              const keyStats = ROLE_KEY_STATS[role] || [];
              const canSwap = isUserSide && selectedStarterId;
              return (
                <button
                  key={bp.id}
                  onClick={() => {
                    if (!isUserSide) return;
                    if (selectedStarterId) onSwap(bp.id);
                  }}
                  className={`flex items-center gap-2 py-1.5 px-2 rounded w-full text-left transition-all ${
                    canSwap
                      ? "hover:bg-primary-500/20 hover:ring-1 hover:ring-primary-500/50 cursor-pointer"
                      : isUserSide
                        ? "hover:bg-gray-100 dark:hover:bg-navy-700/50"
                        : "cursor-default"
                  }`}
                >
                  {resolvePlayerPhoto(bp.id, bp.name) ? (
                    <img
                      src={resolvePlayerPhoto(bp.id, bp.name) || ""}
                      alt={bp.name}
                      className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-navy-600 flex items-center justify-center text-[10px] font-heading font-bold text-gray-500 dark:text-gray-400 flex-shrink-0 transition-colors duration-300">
                      {bp.name.substring(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium flex-1 truncate">
                    {bp.name}
                  </span>
                  <img
                    src={LOL_ROLE_ICON_URLS[role]}
                    alt={role}
                    className="w-5 h-5 object-contain"
                    title={role}
                  />
                  <div className="flex items-center gap-0">
                    {keyStats.map((s) => (
                      <span
                        key={s.label}
                        className={`text-[10px] font-heading tabular-nums w-7 text-center ${statColor(
                          getStatVal(bp, s.key),
                        )}`}
                      >
                        {getStatVal(bp, s.key)}
                      </span>
                    ))}
                  </div>
                  <span className={`text-xs tabular-nums w-8 text-right ${condColor(bp.condition)}`}>
                    {Math.round(bp.condition)}%
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PreMatchLineup({
  homeTeam,
  homeBench,
  awayTeam,
  awayBench,
  homeTeamColor,
  awayTeamColor,
  userSide,
  selectedStarterId,
  isAutoSelecting,
  onSelectStarter,
  onSwap,
  onAutoSelect,
}: PreMatchLineupProps) {
  const { t } = useTranslation();
  const autoSelectLabel = t("match.autoSelectXI").replace(/XI/g, "5");

  return (
    <div className="flex flex-col gap-4">
      {/* Formation fit bar */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-gray-200 dark:border-navy-700 shadow-sm p-3 flex items-center justify-between transition-colors duration-300">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-heading uppercase tracking-widest text-gray-700 dark:text-gray-500">
            {t("match.formationFit")}
          </span>
          {LOL_ROLE_ORDER.map((role) => {
            const homeCount = homeTeam.players.filter((p) => getPlayerLolRole(p) === role).length;
            const awayCount = awayTeam.players.filter((p) => getPlayerLolRole(p) === role).length;
            const actual = userSide === "Home" ? homeCount : awayCount;
            const ok = actual === 1;
            return (
              <div key={role} className="flex items-center gap-1">
                <span className="text-[10px] font-heading uppercase tracking-widest text-gray-600 dark:text-gray-400">
                  {role === "JUNGLE" ? "JG" : role}
                </span>
                <span
                  className={`text-sm font-heading font-bold tabular-nums ${ok ? "text-primary-700 dark:text-primary-400" : "text-amber-600 dark:text-amber-400"}`}
                >
                  {actual}/1
                </span>
                {!ok && <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
              </div>
            );
          })}
        </div>
        <button
          onClick={onAutoSelect}
          disabled={isAutoSelecting}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-heading font-bold uppercase tracking-wider transition-all ${
            isAutoSelecting
              ? "bg-gray-200 dark:bg-navy-700 text-gray-600 dark:text-gray-400 cursor-wait"
              : "bg-accent-100 text-accent-700 hover:bg-accent-200 dark:bg-accent-500/20 dark:text-accent-300 dark:hover:bg-accent-500/30"
          }`}
        >
          <Wand2 className="w-3.5 h-3.5" />
          {isAutoSelecting ? t("match.selecting") : autoSelectLabel}
        </button>
      </div>

      {/* Two-column grid: HOME left, AWAY right */}
      <div className="grid grid-cols-2 gap-4">
        <TeamLineupColumn
          team={homeTeam}
          bench={homeBench}
          teamColor={homeTeamColor}
          isUserSide={userSide === "Home"}
          selectedStarterId={selectedStarterId}
          onSelectStarter={onSelectStarter}
          onSwap={onSwap}
        />
        <TeamLineupColumn
          team={awayTeam}
          bench={awayBench}
          teamColor={awayTeamColor}
          isUserSide={userSide === "Away"}
          selectedStarterId={selectedStarterId}
          onSelectStarter={onSelectStarter}
          onSwap={onSwap}
        />
      </div>
    </div>
  );
}
