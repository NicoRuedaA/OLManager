import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BedDouble,
  Brain,
  Crosshair,
  Feather,
  Flame,
  HeartPulse,
  Info,
  Scale,
  Shield,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  DEFAULT_TRAINING_FOCUS,
  TRAINING_FOCUS_ATTRS,
  TRAINING_FOCUS_IDS,
  normalizeTrainingFocus,
} from "../../lib/trainingFocus";
import { formatStaffEffectPercent, getLolStaffEffectsForTeam } from "../../lib/lolStaffEffects";
import { resolvePlayerPhoto } from "../../lib/playerPhotos";
import { ROLE_ICON_PATHS } from "../../lib/roleIcons";
import type { GameStateData } from "../../store/gameStore";
import { setTraining, setTrainingSchedule } from "../../services/trainingService";
import { Card, CardBody, CardHeader, ProgressBar } from "../ui";
import TrainingSettingsPanel from "./TrainingSettingsPanel";
import { getTrainingStaffAdvice } from "./trainingAdvice";

type SoloQTier = "Challenger" | "Grandmaster" | "Master";

const SOLOQ_POINTS_BASELINE = 3000;
const SOLOQ_POINTS_MIN = 3000;
const SOLOQ_POINTS_MAX = 7000;
const SOLOQ_GRANDMASTER_LP_CUTOFF = 800;
const SOLOQ_CHALLENGER_LP_CUTOFF = 1300;

function hashText(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / (24 * 60 * 60 * 1000)));
}

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function weekdayFromIso(iso: string): number {
  const date = new Date(iso);
  return (date.getUTCDay() + 6) % 7;
}

function isSoloQDay(dateIso: string, schedule: string): boolean {
  const activeDays = SCHEDULE_TRAINING_DAYS[schedule] ?? SCHEDULE_TRAINING_DAYS.Balanced;
  return activeDays.includes(weekdayFromIso(dateIso));
}

function intensityMultiplier(intensity: string): number {
  if (intensity === "High") return 1.25;
  if (intensity === "Low") return 0.75;
  return 1.0;
}

function focusMultiplier(focus: string | null | undefined): number {
  if (!focus) return 0.85;
  if (focus === "ChampionPoolPractice") return 1.25;
  if (focus === "IndividualCoaching") return 1.0;
  if (focus === "Scrims") return 0.85;
  if (focus === "MacroSystems") return 0.75;
  if (focus === "VODReview") return 0.7;
  return 0.85;
}

function computeSoloQ(
  player: GameStateData["players"][number],
  gameState: GameStateData,
  masterySignal: number,
  focus: string | null | undefined,
  intensity: string,
  schedule: string,
): { tier: SoloQTier; lp: number; delta: number } {
  const ovr = Math.round((
    player.attributes.mechanics +
    player.attributes.laning +
    player.attributes.teamfighting +
    player.attributes.macro_play +
    player.attributes.consistency +
    player.attributes.shotcalling +
    player.attributes.champion_pool +
    player.attributes.discipline +
    player.attributes.mental_resilience
  ) / 9);
  const dayIndex = daysBetween(gameState.clock.start_date, gameState.clock.current_date);
  const baseline = 3520 + (ovr - 76) * 52 + ((hashText(player.id) % 121) - 60);

  let points = baseline;
  const focusMult = focusMultiplier(focus);
  const intensityMult = intensityMultiplier(intensity);
  for (let day = 1; day <= dayIndex; day += 1) {
    const currentIso = addDays(gameState.clock.start_date, day);
    if (!isSoloQDay(currentIso, schedule)) continue;
    const baseGain = 10 + ((ovr - 75) * 0.8) + (masterySignal * 0.08);
    const gain = Math.round(baseGain * intensityMult * focusMult);
    points += Math.max(-20, Math.min(30, gain));
    points = Math.max(SOLOQ_POINTS_MIN, Math.min(SOLOQ_POINTS_MAX, points));
  }

  const lp = Math.max(0, Math.round(points - SOLOQ_POINTS_BASELINE));
  let delta = 0;
  if (dayIndex > 0) {
    const yesterdayIso = addDays(gameState.clock.start_date, dayIndex);
    if (isSoloQDay(yesterdayIso, schedule)) {
      const baseGain = 10 + ((ovr - 75) * 0.8) + (masterySignal * 0.08);
      delta = Math.max(-20, Math.min(30, Math.round(baseGain * intensityMult * focusMult)));
    }
  }

  if (lp >= SOLOQ_CHALLENGER_LP_CUTOFF) return { tier: "Challenger", lp, delta };
  if (lp >= SOLOQ_GRANDMASTER_LP_CUTOFF) return { tier: "Grandmaster", lp, delta };
  return { tier: "Master", lp, delta };
}

function soloQTierClass(tier: SoloQTier): string {
  if (tier === "Challenger") return "text-yellow-300";
  if (tier === "Grandmaster") return "text-red-300";
  return "text-fuchsia-300";
}

function soloQEmblemUrl(tier: SoloQTier): string {
  if (tier === "Challenger") {
    return "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/challenger.png";
  }
  if (tier === "Grandmaster") {
    return "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/grandmaster.png";
  }
  return "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/master.png";
}

type UiRole = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";

function inferRoleIcon(player: GameStateData["players"][number]): string {
  const key = String(player.natural_position || player.position || "").toLowerCase().replace(/[^a-z]/g, "");
  let role: UiRole = "SUPPORT";
  if (key.includes("defender") && !key.includes("midfielder")) role = "TOP";
  else if (key.includes("midfielder") && !key.includes("attacking")) role = "JUNGLE";
  else if (key.includes("attackingmidfielder")) role = "MID";
  else if (key.includes("forward") || key.includes("striker")) role = "ADC";
  return ROLE_ICON_PATHS[role];
}

interface TrainingTabProps {
  gameState: GameStateData;
  onGameUpdate?: (state: GameStateData) => void;
}

const TRAINING_FOCUS_ICONS: Record<string, ReactNode> = {
  Scrims: <HeartPulse className="w-6 h-6" />,
  VODReview: <Brain className="w-6 h-6" />,
  IndividualCoaching: <Crosshair className="w-6 h-6" />,
  ChampionPoolPractice: <Zap className="w-6 h-6" />,
  MacroSystems: <Shield className="w-6 h-6" />,
  MentalResetRecovery: <BedDouble className="w-6 h-6" />,
};

const INTENSITY_IDS = ["Low", "Medium", "High"] as const;

const INTENSITY_COLORS: Record<string, string> = {
  Low: "text-blue-500",
  Medium: "text-accent-500",
  High: "text-red-500",
};

const SCHEDULE_IDS = ["Intense", "Balanced", "Light"] as const;

const SCHEDULE_ICONS: Record<string, ReactNode> = {
  Intense: <Flame className="w-5 h-5" />,
  Balanced: <Scale className="w-5 h-5" />,
  Light: <Feather className="w-5 h-5" />,
};

const SCHEDULE_COLORS: Record<string, string> = {
  Intense: "text-red-500",
  Balanced: "text-primary-500",
  Light: "text-blue-500",
};

const SCHEDULE_TRAINING_DAYS: Record<string, number[]> = {
  Intense: [0, 1, 2, 3, 4, 5],
  Balanced: [0, 1, 3, 4],
  Light: [1, 3],
};

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function getWeekdayFromDate(dateStr: string): number {
  const date = new Date(dateStr);
  return (date.getUTCDay() + 6) % 7;
}

export default function TrainingTab({
  gameState,
  onGameUpdate,
}: TrainingTabProps) {
  const { t } = useTranslation();
  const myTeam = gameState.teams.find(
    (team) => team.id === gameState.manager.team_id,
  );

  if (!myTeam) {
    return (
      <p className="text-gray-500 dark:text-gray-400">{t("common.noTeam")}</p>
    );
  }

  const currentFocus = normalizeTrainingFocus(myTeam.training_focus);
  const currentIntensity = myTeam.training_intensity || "Medium";
  const currentSchedule = myTeam.training_schedule || "Balanced";
  const [isSaving, setIsSaving] = useState(false);

  const roster = gameState.players.filter((player) => player.team_id === myTeam.id);
  const masterySignalByPlayer = useMemo(() => {
    const bucket = new Map<string, number[]>();
    (gameState.champion_masteries ?? []).forEach((entry) => {
      const list = bucket.get(entry.player_id) ?? [];
      list.push(Number(entry.mastery ?? 25));
      bucket.set(entry.player_id, list);
    });
    const signal = new Map<string, number>();
    bucket.forEach((values, playerId) => {
      const top = [...values].sort((a, b) => b - a).slice(0, 3);
      const avg = top.length > 0 ? top.reduce((sum, value) => sum + value, 0) / top.length : 25;
      signal.set(playerId, Math.max(0, avg - 60));
    });
    return signal;
  }, [gameState.champion_masteries]);
  const avgCondition =
    roster.length > 0
      ? Math.round(
          roster.reduce((sum, player) => sum + player.condition, 0) / roster.length,
        )
      : 0;
  const avgMorale =
    roster.length > 0
      ? Math.round(
          roster.reduce((sum, player) => sum + player.morale, 0) / roster.length,
        )
      : 0;
  const exhaustedCount = roster.filter((player) => player.condition < 40).length;
  const criticalCount = roster.filter((player) => player.condition < 25).length;

  const todayWeekday = getWeekdayFromDate(gameState.clock.current_date);
  const trainingDays =
    SCHEDULE_TRAINING_DAYS[currentSchedule] || SCHEDULE_TRAINING_DAYS.Balanced;
  const isTodayTraining = trainingDays.includes(todayWeekday);

  const handleSetTraining = async (focus: string, intensity: string) => {
    setIsSaving(true);
    try {
      const updated = await setTraining(focus, intensity);
      onGameUpdate?.(updated);
    } catch (error) {
      console.error("Failed to set training:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetSchedule = async (schedule: string) => {
    setIsSaving(true);
    try {
      const updated = await setTrainingSchedule(schedule);
      onGameUpdate?.(updated);
    } catch (error) {
      console.error("Failed to set schedule:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const activeFocusAttrs =
    TRAINING_FOCUS_ATTRS[currentFocus] ||
    TRAINING_FOCUS_ATTRS[DEFAULT_TRAINING_FOCUS];
  const staffAdvice = getTrainingStaffAdvice(t, {
    criticalCount,
    avgCondition,
    exhaustedCount,
    currentSchedule,
    currentFocus,
  });
  const staffEffects = getLolStaffEffectsForTeam(gameState, myTeam.id);
  const staffImpactRows = [
    { label: t("training.staffImpact.learning"), value: staffEffects.development },
    { label: t("training.staffImpact.scrims"), value: (staffEffects.tactics * 0.55) + (staffEffects.analysis * 0.45) },
    { label: t("training.staffImpact.recovery"), value: staffEffects.recovery },
  ];

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 flex flex-col gap-5">
        {staffAdvice ? (
          <div
            className={`flex items-start gap-3 p-4 rounded-xl border-2 ${
              staffAdvice.level === "critical"
                ? "bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-500/40"
                : staffAdvice.level === "warn"
                  ? "bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40"
                  : "bg-blue-50 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/40"
            }`}
          >
            {staffAdvice.level === "critical" ? (
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            ) : staffAdvice.level === "warn" ? (
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            ) : (
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p
                className={`text-xs font-heading font-bold uppercase tracking-wider mb-0.5 ${
                  staffAdvice.level === "critical"
                    ? "text-red-600 dark:text-red-400"
                    : staffAdvice.level === "warn"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-blue-600 dark:text-blue-400"
                }`}
              >
                {staffAdvice.level === "critical"
                  ? t("training.staffAlert")
                  : staffAdvice.level === "warn"
                    ? t("training.staffWarning")
                    : t("training.staffSuggestion")}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {staffAdvice.message}
              </p>
            </div>
          </div>
        ) : null}

        <TrainingSettingsPanel
          currentFocus={currentFocus}
          currentIntensity={currentIntensity}
          currentSchedule={currentSchedule}
          isSaving={isSaving}
          todayWeekday={todayWeekday}
          isTodayTraining={isTodayTraining}
          activeFocusAttrs={activeFocusAttrs}
          onSetTraining={handleSetTraining}
          onSetSchedule={handleSetSchedule}
          scheduleIds={SCHEDULE_IDS}
          scheduleIcons={SCHEDULE_ICONS}
          scheduleColors={SCHEDULE_COLORS}
          dayKeys={DAY_KEYS}
          trainingFocusIds={TRAINING_FOCUS_IDS}
          trainingFocusIcons={TRAINING_FOCUS_ICONS}
          trainingFocusAttrs={TRAINING_FOCUS_ATTRS}
          intensityIds={INTENSITY_IDS}
          intensityColors={INTENSITY_COLORS}
        />

      </div>

      <div className="flex flex-col gap-5">
        <Card accent="primary">
          <CardHeader>{t("training.soloQRanks")}</CardHeader>
          <CardBody>
            <div className="space-y-2">
              {roster
                .slice()
                .sort((a, b) => a.match_name.localeCompare(b.match_name))
                .map((player) => {
                  const playerFocus = normalizeTrainingFocus(player.training_focus ?? currentFocus);
                  const soloQ = computeSoloQ(
                    player,
                    gameState,
                    masterySignalByPlayer.get(player.id) ?? 0,
                    playerFocus,
                    currentIntensity,
                    currentSchedule,
                  );
                  return (
                    <div key={player.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-navy-600">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-navy-900/60 dark:border-navy-600">
                          <img
                            src={resolvePlayerPhoto(player.id) ?? undefined}
                            alt={player.match_name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                          <img
                            src={inferRoleIcon(player)}
                            alt="role"
                            className="absolute bottom-0 left-0 h-4 w-4 rounded-tr bg-navy-900/90 p-0.5"
                            loading="lazy"
                          />
                        </div>
                        <p className="truncate text-sm font-heading font-bold uppercase tracking-wider text-gray-800 dark:text-gray-100">
                          {player.match_name}
                        </p>
                        <p className={`text-[11px] font-heading uppercase tracking-wide ${soloQTierClass(soloQ.tier)}`}>
                          {soloQ.tier} · {soloQ.lp} LP
                          <span className={`ml-1 ${soloQ.delta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                            {soloQ.delta >= 0 ? `+${soloQ.delta}` : soloQ.delta}
                          </span>
                        </p>
                      </div>
                      <img
                        src={soloQEmblemUrl(soloQ.tier)}
                        alt={soloQ.tier}
                        className="h-7 w-7 shrink-0 object-contain"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  );
                })}
            </div>
          </CardBody>
        </Card>

        <Card accent="primary">
          <CardHeader>{t("training.staffImpact.title")}</CardHeader>
          <CardBody>
            <div className="space-y-2 text-sm">
              {staffImpactRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <span className="text-gray-600 dark:text-gray-400">{row.label}</span>
                  <span className="font-heading font-bold text-gray-800 dark:text-gray-100">
                    {formatStaffEffectPercent(row.value)}
                  </span>
                </div>
              ))}
              <p className="pt-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-navy-700">
                {t(
                  "training.staffImpact.note",
                  "Staff improves learning, preparation and recovery conservatively; player attributes still drive results.",
                )}
              </p>
            </div>
          </CardBody>
        </Card>

        <Card accent="accent">
          <CardHeader>{t("training.squadFitness")}</CardHeader>
          <CardBody>
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t("training.avgCondition")}
                  </span>
                  <span className="font-heading font-bold text-gray-800 dark:text-gray-100">
                    {avgCondition}%
                  </span>
                </div>
                <ProgressBar value={avgCondition} variant="auto" size="md" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t("training.avgMorale")}
                  </span>
                  <span className="font-heading font-bold text-gray-800 dark:text-gray-100">
                    {avgMorale}%
                  </span>
                </div>
                <ProgressBar value={avgMorale} variant="auto" size="md" />
              </div>
              {exhaustedCount > 0 || criticalCount > 0 ? (
                <div className="mt-1 pt-2 border-t border-gray-100 dark:border-navy-700">
                  {criticalCount > 0 ? (
                    <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />{" "}
                      {t("training.criticalCondition", { count: criticalCount })}
                    </p>
                  ) : null}
                  {exhaustedCount > 0 ? (
                    <p className="text-xs text-amber-500 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                      <AlertTriangle className="w-3 h-3" />{" "}
                      {t("training.exhaustedPlayers", { count: exhaustedCount })}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </CardBody>
        </Card>

      </div>
    </div>
  );
}
