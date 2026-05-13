import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import teamsSeed from "../../../data/draft/teams.json";
import { buildLolScrimPrepInsight } from "../../lib/lolScrimPrep";
import { resolvePlayerPhoto } from "../../lib/playerPhotos";
import { resolveTeamLogo } from "../../lib/teamLogos";
import type { MatchSnapshot } from "./types";
import type { DraftMatchResult, DraftTimelineEvent } from "./draftResultSimulator";

type Side = "blue" | "red";

interface TeamSeed {
  id: string;
  name: string;
  shortName: string;
}

interface DraftResultScreenProps {
  snapshot: MatchSnapshot;
  controlledSide: Side;
  result: DraftMatchResult;
  seriesGames?: DraftResultSeriesGame[];
  seriesLength?: 1 | 3 | 5;
  seriesGameIndex?: number;
  userSeriesWins?: number;
  opponentSeriesWins?: number;
  canUserChooseSide?: boolean;
  onPressConference?: () => void;
  onContinue: (nextUserSide?: Side) => void;
}

export interface DraftResultSeriesGame {
  gameIndex: number;
  result: DraftMatchResult;
  winnerSide?: Side;
}

const TEAM_SEEDS: TeamSeed[] = ((teamsSeed as { data?: { teams?: TeamSeed[] } }).data?.teams ?? []) as TeamSeed[];
const GOLD_CHART_CENTER_Y = 36;
const GOLD_CHART_HALF_HEIGHT = 28;

type GoldDiffPoint = { minute: number; diff: number };

export type GoldChartPoint = GoldDiffPoint & { x: number; y: number };

export function buildGoldAdvantageChartPoints(timeline: GoldDiffPoint[]): GoldChartPoint[] {
  const orderedTimeline = [...timeline]
    .filter((point) => Number.isFinite(point.minute) && Number.isFinite(point.diff))
    .sort((left, right) => left.minute - right.minute);
  const maxAbsGold = Math.max(...orderedTimeline.map((point) => Math.abs(point.diff)), 1000) || 1000;

  return orderedTimeline.map((point, idx) => {
    const x = 6 + (idx / Math.max(1, orderedTimeline.length - 1)) * 88;
    // diff is always blue gold minus red gold. In SVG, lower y renders higher,
    // so a larger blue-side advantage MUST move visually up, while red recovery
    // and red-side leads move down through/below the center line.
    const y = GOLD_CHART_CENTER_Y - (point.diff / maxAbsGold) * GOLD_CHART_HALF_HEIGHT;
    return { ...point, x, y };
  });
}

const TEAM_BRAND_MAP: Record<string, { tricode: string }> = {
  "g2 esports": { tricode: "G2" },
  fnatic: { tricode: "FNC" },
  "team vitality": { tricode: "VIT" },
  vitality: { tricode: "VIT" },
  "team heretics": { tricode: "HRTS" },
  "sk gaming": { tricode: "SK" },
  "movistar koi": { tricode: "MKOI" },
  "mad lions koi": { tricode: "MKOI" },
  "team bds": { tricode: "BDS" },
  giantx: { tricode: "GX" },
  heretics: { tricode: "HRTS" },
  "natus vincere": { tricode: "NAVI" },
  "karmine corp": { tricode: "KC" },
};

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function teamTriCode(name: string): string {
  const normalizedName = normalizeKey(name);
  const fromSeed = TEAM_SEEDS.find((team) => normalizeKey(team.name) === normalizedName);
  if (fromSeed?.shortName) return fromSeed.shortName.toUpperCase();

  const key = name.trim().toLowerCase();
  const known = TEAM_BRAND_MAP[key];
  if (known) return known.tricode;

  const cleaned = name.replace(/[^A-Za-z0-9\s]/g, " ").trim();
  if (!cleaned) return "TEAM";
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return words.map((word) => word[0]).join("").toUpperCase().slice(0, 4);
  return cleaned.slice(0, 4).toUpperCase();
}

function sideTeam(snapshot: MatchSnapshot, side: Side) {
  return side === "blue" ? snapshot.home_team : snapshot.away_team;
}

function eventPillClass(event: DraftTimelineEvent): string {
  const sideBase =
    event.side === "blue"
      ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-200"
      : "border-orange-400/60 bg-orange-500/10 text-orange-200";

  if (event.type === "baron") {
    return `${sideBase} shadow-[0_0_0_1px_rgba(168,85,247,0.35),0_0_14px_rgba(168,85,247,0.45)]`;
  }

  if (event.type === "dragon_soul" || event.type === "elder") {
    return `${sideBase} shadow-[0_0_0_1px_rgba(250,204,21,0.35),0_0_14px_rgba(250,204,21,0.45)]`;
  }

  return sideBase;
}

function formatGoldDiff(value: number): string {
  const absValue = Math.abs(Math.round(value));
  if (absValue >= 1000) {
    const thousands = absValue / 1000;
    return `${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)}k`;
  }

  return absValue.toString();
}

export default function DraftResultScreen({
  snapshot,
  controlledSide,
  result,
  seriesGames,
  seriesLength = 1,
  seriesGameIndex = 1,
  userSeriesWins = 0,
  opponentSeriesWins = 0,
  canUserChooseSide = false,
  onPressConference,
  onContinue,
}: DraftResultScreenProps) {
  const { t } = useTranslation();

  const seriesGamesForTabs = useMemo<DraftResultSeriesGame[]>(() => {
    if (!Array.isArray(seriesGames) || seriesGames.length === 0) {
      return [{ gameIndex: Math.max(1, seriesGameIndex), result, winnerSide: result.winnerSide }];
    }

    return [...seriesGames]
      .filter((entry) => Number.isFinite(entry.gameIndex) && entry.gameIndex >= 1)
      .sort((left, right) => left.gameIndex - right.gameIndex);
  }, [result, seriesGameIndex, seriesGames]);

  const latestSeriesGame = seriesGamesForTabs[seriesGamesForTabs.length - 1];
  const [selectedGameIndex, setSelectedGameIndex] = useState<number>(latestSeriesGame?.gameIndex ?? 1);

  useEffect(() => {
    const hasSelectedGame = seriesGamesForTabs.some((entry) => entry.gameIndex === selectedGameIndex);
    if (!hasSelectedGame) {
      setSelectedGameIndex(latestSeriesGame?.gameIndex ?? 1);
    }
  }, [latestSeriesGame?.gameIndex, selectedGameIndex, seriesGamesForTabs]);

  const selectedSeriesGame =
    seriesGamesForTabs.find((entry) => entry.gameIndex === selectedGameIndex) ?? latestSeriesGame;
  const selectedResult = selectedSeriesGame?.result ?? result;

  const blueTeam = sideTeam(snapshot, "blue");
  const redTeam = sideTeam(snapshot, "red");
  const blueTri = teamTriCode(blueTeam.name);
  const redTri = teamTriCode(redTeam.name);
  const blueLogo = resolveTeamLogo(blueTeam.name);
  const redLogo = resolveTeamLogo(redTeam.name);

  const controlledWon = selectedResult.winnerSide === controlledSide;
  const controlledPrepInsight = buildLolScrimPrepInsight(
    snapshot.lol_scrim_prep,
    controlledSide === "blue" ? "home" : "away",
  );
  const controlledPrepFocus = controlledPrepInsight
    ? t(controlledPrepInsight.focusLabel.key, { defaultValue: controlledPrepInsight.focusLabel.defaultValue })
    : null;
  const title = controlledWon
    ? t("match.victory")
    : t("match.defeat");

  const blueRows = selectedResult.playerResults.filter((row) => row.side === "blue");
  const redRows = selectedResult.playerResults.filter((row) => row.side === "red");

  const chartPoints = buildGoldAdvantageChartPoints(selectedResult.goldDiffTimeline);
  const maxAbsGold = Math.max(...chartPoints.map((point) => Math.abs(point.diff)), 1000) || 1000;
  const finalGoldDiff = chartPoints[chartPoints.length - 1]?.diff ?? 0;
  const leadingSide = finalGoldDiff > 0 ? "blue" : finalGoldDiff < 0 ? "red" : null;
  const leadingTri = leadingSide === "blue" ? blueTri : leadingSide === "red" ? redTri : null;
  const peakGoldDiff = chartPoints.reduce(
    (peak, point) => (Math.abs(point.diff) > Math.abs(peak.diff) ? point : peak),
    { minute: 0, diff: 0 },
  );
  const chartIdSuffix = `${selectedGameIndex}-${blueTri}-${redTri}`.replace(/[^A-Za-z0-9_-]/g, "");
  const goldAxisLabel = `${t("match.draftResult.goldAdvantage")} (+ ${blueTri}, - ${redTri})`;

  const points = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = chartPoints.length > 0
    ? `M ${chartPoints[0].x},${GOLD_CHART_CENTER_Y} L ${chartPoints.map((point) => `${point.x},${point.y}`).join(" L ")} L ${chartPoints[chartPoints.length - 1].x},${GOLD_CHART_CENTER_Y} Z`
    : "";

  const mvpPhoto = resolvePlayerPhoto(selectedResult.mvp.playerId, selectedResult.mvp.playerName);
  const playedSeriesGames = Math.max(latestSeriesGame?.gameIndex ?? 1, seriesGamesForTabs.length);
  const nextGameLabel = `${Math.min(seriesLength, playedSeriesGames + 1)}/${seriesLength}`;
  const targetSeriesWins = seriesLength === 1 ? 1 : seriesLength === 3 ? 2 : 3;
  const seriesWinsFromGames = seriesGamesForTabs.reduce(
    (score, entry) => {
      if (entry.winnerSide === controlledSide) {
        return { ...score, user: score.user + 1 };
      }

      if (entry.winnerSide === "blue" || entry.winnerSide === "red") {
        return { ...score, opponent: score.opponent + 1 };
      }

      return score;
    },
    { user: 0, opponent: 0 },
  );
  const propSeriesWins = userSeriesWins + opponentSeriesWins;
  const gameSeriesWins = seriesWinsFromGames.user + seriesWinsFromGames.opponent;
  const propsClaimFinished = userSeriesWins >= targetSeriesWins || opponentSeriesWins >= targetSeriesWins;
  const propsSupportedByGames =
    propsClaimFinished &&
    propSeriesWins <= seriesLength &&
    gameSeriesWins >= propSeriesWins;
  const shouldUseSeriesGamesScore =
    seriesLength > 1 &&
    gameSeriesWins > 0 &&
    (propSeriesWins === 0 || !propsSupportedByGames);
  const displayedUserSeriesWins = shouldUseSeriesGamesScore ? seriesWinsFromGames.user : userSeriesWins;
  const displayedOpponentSeriesWins = shouldUseSeriesGamesScore ? seriesWinsFromGames.opponent : opponentSeriesWins;
  const displayedSeriesWins = displayedUserSeriesWins + displayedOpponentSeriesWins;
  const displayedWinnerReachedTarget =
    displayedUserSeriesWins >= targetSeriesWins || displayedOpponentSeriesWins >= targetSeriesWins;
  const displayedScoreSupportedByGames =
    displayedSeriesWins <= seriesLength && gameSeriesWins >= displayedSeriesWins;
  const isSeriesFinished =
    seriesLength === 1 ||
    (displayedWinnerReachedTarget && displayedScoreSupportedByGames);

  const renderTimeline = () => {
    const sorted = [...selectedResult.timelineEvents].sort((a, b) => a.minute - b.minute);
    const rows: Array<{ minute: number; blue: typeof sorted; red: typeof sorted }> = [];
    for (const event of sorted) {
      const last = rows[rows.length - 1];
      if (last && last.minute === event.minute) {
        if (event.side === "blue") last.blue.push(event);
        else last.red.push(event);
      } else {
        rows.push({ minute: event.minute, blue: event.side === "blue" ? [event] : [], red: event.side === "red" ? [event] : [] });
      }
    }
    const minMinute = rows.length > 0 ? rows[0].minute : 0;
    const maxMinute = rows.length > 0 ? rows[rows.length - 1].minute : 1;
    const rangeStart = Math.max(minMinute - 1, 0);
    const rangeMinute = Math.max(maxMinute - rangeStart, 1);
    const edgePad = rangeMinute * 0.06;
    const effectiveStart = rangeStart - edgePad;
    const effectiveRange = rangeMinute + 2 * edgePad;
    return (
      <div className="relative overflow-x-hidden overflow-y-hidden h-full">
        <div className="flex flex-col h-full">
          {/* Events area with center line */}
          <div className="relative flex-1 min-h-0 py-1">
            <div className="absolute left-0 right-0 top-1/2"><div className="h-px bg-white/10" /></div>
            {rows.map((row, idx) => {
              const leftPct = `${((row.minute - effectiveStart) / effectiveRange) * 100}%`;
              return (
                <div key={idx} className="absolute top-0 flex flex-col items-center" style={{ left: leftPct, transform: 'translateX(-50%)', height: '100%' }}>
                  <div className="flex flex-col items-center justify-end flex-1 overflow-visible pb-2">
                    {row.blue.map((event, eIdx) => (
                    <span key={`blue-${eIdx}`} className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] whitespace-nowrap mt-1 ${eventPillClass(event)}`}>
                      <span>{event.label}</span>
                    </span>
                    ))}
                  </div>
                  <div className="flex flex-col items-center justify-start flex-1 overflow-visible pt-2">
                    {row.red.map((event, eIdx) => (
                      <span key={`red-${eIdx}`} className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] whitespace-nowrap mb-1 ${eventPillClass(event)}`}>
                        <span>{event.label}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Minute labels row */}
          <div className="relative h-5 flex-shrink-0">
            {rows.map((row, idx) => (
              <span
                key={`marker-${idx}`}
                className="absolute text-[9px] font-bold text-white/30 whitespace-nowrap -translate-x-1/2"
                style={{ left: `${((row.minute - effectiveStart) / effectiveRange) * 100}%` }}
              >
                {row.minute}m
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen overflow-y-auto overflow-x-hidden bg-[#050608] text-white p-4 md:p-6">
      <div className="max-w-[1600px] mx-auto space-y-4">
        <header className="rounded-xl border border-cyan-400/25 bg-[#0a1433] p-5 text-center shadow-[0_0_24px_rgba(0,242,255,0.1)]">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{t("match.matchOver")}</p>
          <h1 className={`mt-1 text-4xl font-heading uppercase ${controlledWon ? "text-green-400" : "text-red-400"}`}>
            {title}
          </h1>

          <div className="mt-3 flex items-center justify-center gap-4 text-3xl font-black">
            {blueLogo ? <img src={blueLogo} alt="" className="w-9 h-9 object-contain" loading="lazy" /> : <span className="text-cyan-300">{blueTri}</span>}
            <span>{selectedResult.blueKills}</span>
            <span className="text-gray-500">-</span>
            <span>{selectedResult.redKills}</span>
            {redLogo ? <img src={redLogo} alt="" className="w-9 h-9 object-contain" loading="lazy" /> : <span className="text-orange-300">{redTri}</span>}
          </div>

          {seriesLength > 1 && seriesGamesForTabs.length > 1 ? (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {seriesGamesForTabs.map((entry) => {
                const isSelected = entry.gameIndex === selectedGameIndex;
                return (
                  <button
                    key={`game-tab-${entry.gameIndex}`}
                    type="button"
                    className={`rounded-md border px-3 py-1 text-xs font-heading font-bold uppercase tracking-wide ${isSelected ? "border-cyan-300 bg-cyan-500/20 text-cyan-100" : "border-white/20 bg-white/5 text-gray-300 hover:bg-white/10"}`}
                    onClick={() => setSelectedGameIndex(entry.gameIndex)}
                  >
                    {t("match.game", { defaultValue: "Game" })} {entry.gameIndex}
                  </button>
                );
              })}
            </div>
          ) : null}
          {seriesLength > 1 ? (
            <p className="mt-1 text-xs text-gray-400">
              {t("match.draftResult.series")} ({seriesLength === 3 ? "Bo3" : "Bo5"}) · {displayedUserSeriesWins} - {displayedOpponentSeriesWins}
            </p>
          ) : null}
        </header>

        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
          <aside className="space-y-4 order-2">
            <div className="rounded-xl border border-yellow-400/25 bg-[#0a1433] p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-yellow-300">{t("match.draftResult.bestOfMatch")}</p>
              <div className="mt-3 flex items-center gap-3">
                {mvpPhoto ? (
                  <img
                    src={mvpPhoto}
                    alt={selectedResult.mvp.playerName}
                    className="w-14 h-14 rounded-full object-cover border border-white/15"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-[#0b1226] border border-white/15 grid place-items-center text-xl font-black">
                    {selectedResult.mvp.playerName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-bold text-lg">{selectedResult.mvp.playerName}</p>
                  <p className="text-sm text-gray-300">
                    {selectedResult.mvp.kills}/{selectedResult.mvp.deaths}/{selectedResult.mvp.assists}
                  </p>
                </div>
              </div>
            </div>

            {controlledPrepInsight ? (
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200">
                    {t(controlledPrepInsight.title.key, { defaultValue: controlledPrepInsight.title.defaultValue })}
                  </p>
                  <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-xs font-bold text-emerald-100">
                    +{controlledPrepInsight.totalSignal}
                  </span>
                </div>
                <p className="mt-2 text-sm text-emerald-50/90">
                  {t(controlledPrepInsight.summary.key, {
                    ...controlledPrepInsight.summary.values,
                    focus: controlledPrepFocus ?? controlledPrepInsight.focusLabel.defaultValue,
                    defaultValue: controlledPrepInsight.summary.defaultValue,
                  })}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {controlledPrepInsight.details.map((detail) => (
                    <span
                      key={detail.key}
                      className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-emerald-100"
                    >
                      {t(detail.key, {
                        ...detail.values,
                        focus: controlledPrepFocus ?? controlledPrepInsight.focusLabel.defaultValue,
                        defaultValue: detail.defaultValue,
                      })}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-xl border border-cyan-400/25 bg-[#0a1433] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200">{t("match.draftResult.goldAdvantage")}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {t("match.draftResult.duration")}: {selectedResult.durationMinutes}m
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400" aria-label={goldAxisLabel}>
                    <span className="text-cyan-200">+ {blueTri}</span>
                    <span className="mx-1 text-gray-600">·</span>
                    <span className="text-orange-200">- {redTri}</span>
                  </p>
                </div>
                <div className={`rounded-lg border px-3 py-2 text-right ${leadingSide === "red" ? "border-orange-400/35 bg-orange-500/10" : leadingSide === "blue" ? "border-cyan-400/35 bg-cyan-500/10" : "border-white/15 bg-white/5"}`}>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">{t("match.draftResult.finalGold")}</p>
                  <p className={`font-heading text-lg font-black ${leadingSide === "red" ? "text-orange-200" : leadingSide === "blue" ? "text-cyan-200" : "text-gray-200"}`}>
                    {leadingTri ? `${leadingTri} +${formatGoldDiff(finalGoldDiff)}` : t("match.draftResult.evenGold")}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-[#061126] p-3 shadow-inner shadow-black/30">
                <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em]">
                  <span className="text-cyan-200">{blueTri}</span>
                  <span className="text-gray-500">+{formatGoldDiff(maxAbsGold)}</span>
                </div>
                <svg viewBox="0 0 100 72" className="h-40 w-full overflow-visible" role="img" aria-label={goldAxisLabel}>
                  <defs>
                    <linearGradient id={`gold-line-${chartIdSuffix}`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#67e8f9" />
                      <stop offset="48%" stopColor="#22d3ee" />
                      <stop offset="52%" stopColor="#fb923c" />
                      <stop offset="100%" stopColor="#fdba74" />
                    </linearGradient>
                    <linearGradient id={`gold-area-${chartIdSuffix}`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.32" />
                      <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.06" />
                      <stop offset="100%" stopColor="#fb923c" stopOpacity="0.22" />
                    </linearGradient>
                    <clipPath id={`gold-blue-clip-${chartIdSuffix}`}>
                      <rect x="0" y="0" width="100" height={GOLD_CHART_CENTER_Y} />
                    </clipPath>
                    <clipPath id={`gold-red-clip-${chartIdSuffix}`}>
                      <rect x="0" y={GOLD_CHART_CENTER_Y} width="100" height={72 - GOLD_CHART_CENTER_Y} />
                    </clipPath>
                    <filter id={`gold-glow-${chartIdSuffix}`} x="-20%" y="-30%" width="140%" height="160%">
                      <feGaussianBlur stdDeviation="1.7" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <rect x="6" y="8" width="88" height="56" rx="3" fill="rgba(255,255,255,0.02)" />
                  {[8, 22, 36, 50, 64].map((y) => (
                    <line key={`gold-grid-${y}`} x1="6" y1={y} x2="94" y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray={y === 36 ? "0" : "2 3"} />
                  ))}
                  <line x1="6" y1="36" x2="94" y2="36" stroke="rgba(255,255,255,0.32)" strokeWidth="0.7" />
                  <text x="2" y="11" fill="rgba(255,255,255,0.45)" fontSize="4">+{formatGoldDiff(maxAbsGold)}</text>
                  <text x="2" y="37.5" fill="rgba(255,255,255,0.45)" fontSize="4">0</text>
                  <text x="2" y="65" fill="rgba(255,255,255,0.45)" fontSize="4">-{formatGoldDiff(maxAbsGold)}</text>

                  {areaPath ? <path d={areaPath} fill={`url(#gold-area-${chartIdSuffix})`} /> : null}
                  {points ? (
                    <>
                      <polyline
                        fill="none"
                        stroke="#67e8f9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.6"
                        filter={`url(#gold-glow-${chartIdSuffix})`}
                        clipPath={`url(#gold-blue-clip-${chartIdSuffix})`}
                        points={points}
                      />
                      <polyline
                        fill="none"
                        stroke="#fb923c"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.6"
                        filter={`url(#gold-glow-${chartIdSuffix})`}
                        clipPath={`url(#gold-red-clip-${chartIdSuffix})`}
                        points={points}
                      />
                    </>
                  ) : null}
                  {chartPoints.length > 0 ? (
                    <circle
                      cx={chartPoints[chartPoints.length - 1].x}
                      cy={chartPoints[chartPoints.length - 1].y}
                      r="2.2"
                      fill={leadingSide === "red" ? "#fb923c" : "#67e8f9"}
                      stroke="#061126"
                      strokeWidth="1.2"
                    />
                  ) : null}
                </svg>
                <div className="mt-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em]">
                  <span className="text-gray-500">0m</span>
                  <span className="text-gray-500">-{formatGoldDiff(maxAbsGold)}</span>
                  <span className="text-orange-200">{redTri}</span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{t("match.draftResult.peakGold")}</p>
                  <p className={`mt-1 font-bold ${peakGoldDiff.diff < 0 ? "text-orange-200" : "text-cyan-200"}`}>
                    {(peakGoldDiff.diff < 0 ? redTri : blueTri)} +{formatGoldDiff(peakGoldDiff.diff)} · {peakGoldDiff.minute}m
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{t("match.draftResult.goldScale")}</p>
                  <p className="mt-1 font-bold text-gray-200">±{formatGoldDiff(maxAbsGold)}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-2">
              {onPressConference && isSeriesFinished ? (
                <button
                  className="rounded-md border border-white/20 bg-white/5 hover:bg-white/10 text-white font-heading font-bold uppercase tracking-wide px-4 py-2"
                  onClick={onPressConference}
                >
                  {t("match.pressConference", { defaultValue: "Press Conference" })}
                </button>
              ) : null}

              {canUserChooseSide ? (
                <div className="flex items-center gap-1 rounded-md border border-white/15 bg-[#081028] px-1 py-1">
                  <button
                    className={`rounded px-3 py-1 text-xs font-heading font-bold uppercase ${controlledSide === "blue" ? "bg-cyan-500/20 text-cyan-200" : "text-gray-300"}`}
                    onClick={() => onContinue("blue")}
                  >
                    {t("match.draftResult.blueNext")}
                  </button>
                  <button
                    className={`rounded px-3 py-1 text-xs font-heading font-bold uppercase ${controlledSide === "red" ? "bg-orange-500/20 text-orange-200" : "text-gray-300"}`}
                    onClick={() => onContinue("red")}
                  >
                    {t("match.draftResult.redNext")}
                  </button>
                </div>
              ) : null}

              <button
                className="rounded-md bg-orange-500 hover:bg-orange-400 text-navy-900 font-heading font-bold uppercase tracking-wide px-6 py-2"
                onClick={() => onContinue()}
              >
                {seriesLength > 1 && !isSeriesFinished
                  ? `${t("match.game", { defaultValue: "Game" })} ${nextGameLabel}`
                  : t("match.continue", { defaultValue: "Continue" })}
              </button>
            </div>
          </aside>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-xl border border-cyan-400/25 bg-[#0a1433] p-4 self-start">
                <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200 mb-3">{blueTri}</p>
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 items-center">
                  {blueRows.map((row) => {
                    const icon = resolvePlayerPhoto(row.playerId, row.playerName);
                    const isMvp = row.playerId === selectedResult.mvp.playerId;
                    return (
                      <div
                        key={`blue-${row.playerId}-${row.role}`}
                        className={`col-span-4 grid grid-cols-subgrid items-center gap-3 rounded-md border px-3 py-2 ${isMvp ? "border-yellow-400/50 bg-yellow-500/10" : "border-white/10 bg-white/5"}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {icon ? <img src={icon} alt={row.playerName} className="w-7 h-7 rounded-full object-cover border border-white/15" loading="lazy" /> : null}
                          <span className="truncate">{row.playerName}</span>
                        </div>
                        <span className="text-sm text-gray-300">{row.kills}/{row.deaths}/{row.assists}</span>
                        <span className="text-sm text-gray-300">{row.gold}</span>
                        <span className="text-sm font-bold text-cyan-300">{row.rating.toFixed(1)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-cyan-400/25 bg-[#0a1433] p-4 self-start">
                <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200 mb-3">{redTri}</p>
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 items-center">
                  {redRows.map((row) => {
                    const icon = resolvePlayerPhoto(row.playerId, row.playerName);
                    const isMvp = row.playerId === selectedResult.mvp.playerId;
                    return (
                      <div
                        key={`red-${row.playerId}-${row.role}`}
                        className={`col-span-4 grid grid-cols-subgrid items-center gap-3 rounded-md border px-3 py-2 ${isMvp ? "border-yellow-400/50 bg-yellow-500/10" : "border-white/10 bg-white/5"}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {icon ? <img src={icon} alt={row.playerName} className="w-7 h-7 rounded-full object-cover border border-white/15" loading="lazy" /> : null}
                          <span className="truncate">{row.playerName}</span>
                        </div>
                        <span className="text-sm text-gray-300">{row.kills}/{row.deaths}/{row.assists}</span>
                        <span className="text-sm text-gray-300">{row.gold}</span>
                        <span className="text-sm font-bold text-orange-300">{row.rating.toFixed(1)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          <section className="rounded-xl border border-cyan-400/25 bg-[#0a1433] p-4 flex-1 w-full flex flex-col">
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-200 mb-3 text-center">{t("match.draftResult.gameTimeline")}</p>
            <div className="space-y-2 flex flex-col flex-1 overflow-hidden">
              <div className="h-px bg-white/10 shrink-0" />
              {renderTimeline()}
            </div>
          </section>
          </div>
        </section>
      </div>
    </div>
  );
}
