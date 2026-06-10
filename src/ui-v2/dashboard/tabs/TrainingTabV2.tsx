import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  BedDouble,
  Brain,
  Crosshair,
  Feather,
  Flame,
  Gauge,
  HeartPulse,
  Info,
  Scale,
  Shield,
  Users,
  X,
  Zap,
} from "lucide-react";

import type { GameStateData } from "@/store/gameStore";
import {
  setTraining,
  setTrainingSchedule,
  setTrainingGroups,
  type TrainingGroupData,
} from "@/services/trainingService";
import { getTrainingStaffAdvice } from "@/lib/training/advice";
import {
  buildPlayerGroupMap,
  reassignPlayerTrainingGroup,
  sortTrainingRoster,
} from "@/lib/training/groupsModel";
import {
  DEFAULT_TRAINING_FOCUS,
  RECOVERY_TRAINING_FOCUS,
  TRAINING_FOCUS_ATTRS,
  TRAINING_FOCUS_IDS,
  normalizeTrainingFocus,
  normalizeOptionalTrainingFocus,
} from "@/lib/teams/trainingFocus";
import {
  formatStaffEffectPercent,
  getLolStaffEffectsForTeam,
} from "@/lib/teams/lolStaffEffects";
import { resolvePlayerPhoto } from "@/lib/players/playerPhotos";
import { resolvePlayerCurrentLolRole } from "@/lib/players/lolIdentity";
import { ROLE_ICON_PATHS } from "@/lib/players/roleIcons";
import { translatePositionAbbreviation } from "@/lib/squad/helpers";
import {
  LOL_VISIBLE_STAT_LABEL_KEYS,
  type LolVisibleStatId,
} from "@/lib/players/lolPlayerStats";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/ui-v2/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui-v2/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/ui-v2/components/ui/tabs";
import { cn } from "@/ui-v2/lib/utils";

// ─── SoloQ constants & helpers (from legacy tab) ─────────────

type SoloQTier = "Challenger" | "Grandmaster" | "Master";

const SOLOQ_POINTS_BASELINE = 3000;
const SOLOQ_POINTS_MIN = 3000;
const SOLOQ_POINTS_MAX = 7000;
const SOLOQ_GRANDMASTER_LP_CUTOFF = 800;
const SOLOQ_CHALLENGER_LP_CUTOFF = 1300;

function hashText(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
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

const SCHEDULE_TRAINING_DAYS: Record<string, number[]> = {
  Intense: [0, 1, 2, 3, 4, 5],
  Balanced: [0, 1, 3, 4],
  Light: [1, 3],
};

function isSoloQDay(dateIso: string, schedule: string): boolean {
  const activeDays =
    SCHEDULE_TRAINING_DAYS[schedule] ?? SCHEDULE_TRAINING_DAYS.Balanced;
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
  const ovr = Math.round(
    (player.attributes.mechanics +
      player.attributes.laning +
      player.attributes.teamfighting +
      player.attributes.macro_play +
      player.attributes.consistency +
      player.attributes.shotcalling +
      player.attributes.champion_pool +
      player.attributes.discipline +
      player.attributes.mental_resilience) /
      9,
  );
  const dayIndex = daysBetween(
    gameState.clock.start_date,
    gameState.clock.current_date,
  );
  const baseline =
    3520 + (ovr - 76) * 52 + ((hashText(player.id) % 121) - 60);

  let points = baseline;
  const focusMult = focusMultiplier(focus);
  const intensityMult = intensityMultiplier(intensity);
  for (let day = 1; day <= dayIndex; day++) {
    const currentIso = addDays(gameState.clock.start_date, day);
    if (!isSoloQDay(currentIso, schedule)) continue;
    const baseGain = 10 + (ovr - 75) * 0.8 + masterySignal * 0.08;
    const gain = Math.round(baseGain * intensityMult * focusMult);
    points += Math.max(-20, Math.min(30, gain));
    points = Math.max(SOLOQ_POINTS_MIN, Math.min(SOLOQ_POINTS_MAX, points));
  }

  const lp = Math.max(0, Math.round(points - SOLOQ_POINTS_BASELINE));
  let delta = 0;
  if (dayIndex > 0) {
    const yesterdayIso = addDays(gameState.clock.start_date, dayIndex - 1);
    if (isSoloQDay(yesterdayIso, schedule)) {
      const baseGain = 10 + (ovr - 75) * 0.8 + masterySignal * 0.08;
      delta = Math.max(
        -20,
        Math.min(30, Math.round(baseGain * intensityMult * focusMult)),
      );
    }
  }

  if (lp >= SOLOQ_CHALLENGER_LP_CUTOFF)
    return { tier: "Challenger", lp, delta };
  if (lp >= SOLOQ_GRANDMASTER_LP_CUTOFF)
    return { tier: "Grandmaster", lp, delta };
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

// ─── UI constants ────────────────────────────────────────────

const SCHEDULE_IDS = ["Intense", "Balanced", "Light"] as const;

const SCHEDULE_ICONS: Record<string, ReactNode> = {
  Intense: <Flame className="size-5" />,
  Balanced: <Scale className="size-5" />,
  Light: <Feather className="size-5" />,
};

const SCHEDULE_DAY_COUNT: Record<string, number> = {
  Intense: 6,
  Balanced: 4,
  Light: 2,
};

const INTENSITY_IDS = ["Low", "Medium", "High"] as const;

const INTENSITY_COLORS: Record<string, string> = {
  Low: "text-blue-500",
  Medium: "text-amber-500",
  High: "text-red-500",
};

const TRAINING_FOCUS_ICONS: Record<string, ReactNode> = {
  Scrims: <HeartPulse className="size-5" />,
  VODReview: <Brain className="size-5" />,
  IndividualCoaching: <Crosshair className="size-5" />,
  ChampionPoolPractice: <Zap className="size-5" />,
  MacroSystems: <Shield className="size-5" />,
  MentalResetRecovery: <BedDouble className="size-5" />,
};

// ─── Props ───────────────────────────────────────────────────

interface TrainingTabV2Props {
  gameState: GameStateData;
  onGameUpdate: (state: GameStateData) => void;
}

// ─── Component ───────────────────────────────────────────────

export function TrainingTabV2({
  gameState,
  onGameUpdate,
}: TrainingTabV2Props) {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupFocus, setNewGroupFocus] = useState(DEFAULT_TRAINING_FOCUS);

  const myTeam = gameState.teams.find(
    (tm) => tm.id === gameState.manager.team_id,
  );

  // ─── Mastery signal (can compute before team guard) ─────────────
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
      const avg =
        top.length > 0
          ? top.reduce((sum, value) => sum + value, 0) / top.length
          : 25;
      signal.set(playerId, Math.max(0, avg - 60));
    });
    return signal;
  }, [gameState.champion_masteries]);

  // ─── Edge: no active team ───────────────────────────────────────
  if (!myTeam) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">
              {t("common.noTeam", {
                defaultValue: "Sin equipo activo",
              })}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Derived data ─────────────────────────────────────────────
  const currentFocus = normalizeTrainingFocus(myTeam.training_focus);
  const currentIntensity = myTeam.training_intensity || "Medium";
  const currentSchedule = myTeam.training_schedule || "Balanced";

  const roster = gameState.players.filter(
    (player) => player.team_id === myTeam.id,
  );
  const hasRoster = roster.length > 0;

  const todayWeekday = weekdayFromIso(gameState.clock.current_date);
  const trainingDays =
    SCHEDULE_TRAINING_DAYS[currentSchedule] ??
    SCHEDULE_TRAINING_DAYS.Balanced;
  const isTodayTraining = trainingDays.includes(todayWeekday);

  const avgCondition =
    roster.length > 0
      ? Math.round(
          roster.reduce((sum, p) => sum + p.condition, 0) / roster.length,
        )
      : 0;
  const avgMorale =
    roster.length > 0
      ? Math.round(
          roster.reduce((sum, p) => sum + p.morale, 0) / roster.length,
        )
      : 0;
  const exhaustedCount = roster.filter((p) => p.condition < 40).length;
  const criticalCount = roster.filter((p) => p.condition < 25).length;

  const activeFocusAttrs =
    TRAINING_FOCUS_ATTRS[currentFocus] ??
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
    {
      label: t("training.staffImpact.learning", {
        defaultValue: "Learning",
      }),
      value: staffEffects.development,
    },
    {
      label: t("training.staffImpact.scrims", {
        defaultValue: "Scrims",
      }),
      value: staffEffects.tactics * 0.55 + staffEffects.analysis * 0.45,
    },
    {
      label: t("training.staffImpact.recovery", {
        defaultValue: "Recovery",
      }),
      value: staffEffects.recovery,
    },
  ];

  // ─── Training groups data ──────────────────────────────────────
  const groups: TrainingGroupData[] = (
    ((myTeam as any)?.training_groups ?? []) as TrainingGroupData[]
  ).map((group) => ({
    ...group,
    focus: normalizeTrainingFocus(group.focus),
  }));
  const teamFocus = normalizeTrainingFocus(myTeam.training_focus);
  const playerGroupMap = buildPlayerGroupMap(groups);
  const sortedRoster = sortTrainingRoster(roster);

  // ─── Stat label helper ─────────────────────────────────────────
  const statLabel = (statId: LolVisibleStatId): string =>
    t(LOL_VISIBLE_STAT_LABEL_KEYS[statId], { defaultValue: statId });

  // ─── Handlers ─────────────────────────────────────────────────
  const handleSetTraining = async (focus: string, intensity: string) => {
    setIsSaving(true);
    try {
      const updated = await setTraining(focus, intensity);
      onGameUpdate(updated);
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
      onGameUpdate(updated);
    } catch (error) {
      console.error("Failed to set schedule:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const saveGroups = useCallback(
    async (nextGroups: TrainingGroupData[]) => {
      setIsSaving(true);
      try {
        const updated = await setTrainingGroups(nextGroups);
        onGameUpdate(updated);
      } catch (error) {
        console.error("Failed to save training groups:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [onGameUpdate],
  );

  const setPlayerGroup = (playerId: string, groupId: string) => {
    saveGroups(reassignPlayerTrainingGroup(groups, playerId, groupId));
  };

  const handleDeleteGroup = (groupId: string) => {
    saveGroups(groups.filter((g) => g.id !== groupId));
  };

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return;
    const newGroup: TrainingGroupData = {
      id: `group-${Date.now()}`,
      name: newGroupName.trim(),
      focus: newGroupFocus,
      player_ids: [],
    };
    saveGroups([...groups, newGroup]);
    setNewGroupName("");
    setNewGroupFocus(DEFAULT_TRAINING_FOCUS);
    setShowCreateGroup(false);
  };

  // ─── Day labels for schedule indicator ────────────────────────
  const dayShortLabels = [
    t("training.days.mon", { defaultValue: "M" }),
    t("training.days.tue", { defaultValue: "T" }),
    t("training.days.wed", { defaultValue: "W" }),
    t("training.days.thu", { defaultValue: "T" }),
    t("training.days.fri", { defaultValue: "F" }),
    t("training.days.sat", { defaultValue: "S" }),
    t("training.days.sun", { defaultValue: "S" }),
  ];

  // ─── Tab state ───────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("training");

  // ─── SoloQ Ranks ─────────────────────────────────────────────
  const soloQRanksCard = (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
          {t("training.soloQRanks", {
            defaultValue: "SoloQ Ranks",
          })}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {!hasRoster ? (
          <p className="py-4 text-center font-heading text-xs uppercase tracking-wider text-muted-foreground">
            {t("training.emptyRoster", { defaultValue: "Empty roster" })}
          </p>
        ) : (
          <div className="space-y-2">
            {sortedRoster.map((player) => {
              const role = resolvePlayerCurrentLolRole(player, myTeam);
              const playerFocus = normalizeTrainingFocus(
                player.training_focus ?? currentFocus,
              );
              const soloQ = computeSoloQ(
                player,
                gameState,
                masterySignalByPlayer.get(player.id) ?? 0,
                playerFocus,
                currentIntensity,
                currentSchedule,
              );
              const photo = resolvePlayerPhoto(
                player.id,
                player.match_name,
                player.profile_image_url,
              );

              return (
                <div
                  key={player.id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                >
                  {/* Avatar + role badge */}
                  <div className="relative size-9 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                    {photo && (
                      <img
                        src={photo}
                        alt={player.match_name}
                        className="size-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                    <img
                      src={ROLE_ICON_PATHS[role]}
                      alt={role}
                      className="absolute bottom-0 left-0 size-4 rounded-tr bg-card/90 p-0.5"
                      loading="lazy"
                    />
                  </div>

                  {/* Name + tier/LP */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading text-sm font-bold uppercase tracking-wider text-foreground">
                      {player.match_name}
                    </p>
                    <p className="font-heading text-xs uppercase tracking-wide text-muted-foreground">
                      <span className={soloQTierClass(soloQ.tier)}>
                        {t(`training.soloQTiers.${soloQ.tier}`, {
                          defaultValue: soloQ.tier,
                        })}
                      </span>
                      <span className="tabular-nums">
                        {" · "}
                        {soloQ.lp} LP
                      </span>
                      <span
                        className={cn(
                          "ml-1 tabular-nums",
                          soloQ.delta >= 0
                            ? "text-emerald-400"
                            : "text-red-400",
                        )}
                      >
                        {soloQ.delta >= 0
                          ? `+${soloQ.delta}`
                          : soloQ.delta}
                      </span>
                    </p>
                  </div>

                  {/* Rank emblem */}
                  <img
                    src={soloQEmblemUrl(soloQ.tier)}
                    alt=""
                    className="size-7 shrink-0 object-contain"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0">
        <TabsList variant="line">
          <TabsTrigger value="training">
            {t("training.tab.training", { defaultValue: "Entrenamiento" })}
          </TabsTrigger>
          <TabsTrigger value="soloq">
            {t("training.tab.soloq", { defaultValue: "SoloQ" })}
          </TabsTrigger>
        </TabsList>

        {/* ═══ Tab: Training Settings ═══ */}
        <TabsContent value="training" className="flex flex-col">
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-[1fr]">
            {/* ── Left column: Settings ─────────────────────────────── */}
            <div className="flex flex-col gap-4 lg:col-span-2 h-full">
          {/* ── Staff Advice Banner ────────────────────────────── */}
          {staffAdvice && (
            <div
              className={cn(
                "flex items-start gap-3 rounded-xl border-2 p-4",
                staffAdvice.level === "critical" &&
                  "border-red-500/40 bg-red-500/10",
                staffAdvice.level === "warn" &&
                  "border-amber-500/40 bg-amber-500/10",
                staffAdvice.level === "ok" &&
                  "border-emerald-500/40 bg-emerald-500/10",
              )}
            >
              {staffAdvice.level === "critical" ? (
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-400" />
              ) : staffAdvice.level === "warn" ? (
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-400" />
              ) : (
                <Info className="mt-0.5 size-5 shrink-0 text-emerald-400" />
              )}
              <div>
                <p
                  className={cn(
                    "mb-0.5 font-heading text-xs font-bold uppercase tracking-wider",
                    staffAdvice.level === "critical" && "text-red-400",
                    staffAdvice.level === "warn" && "text-amber-400",
                    staffAdvice.level === "ok" && "text-emerald-400",
                  )}
                >
                  {staffAdvice.level === "critical"
                    ? t("training.staffAlert", { defaultValue: "Alerta" })
                    : staffAdvice.level === "warn"
                      ? t("training.staffWarning", { defaultValue: "Advertencia" })
                      : t("training.staffSuggestion", { defaultValue: "Sugerencia" })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {staffAdvice.message}
                </p>
              </div>
            </div>
          )}

          {/* ── Schedule Card ───────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
                {t("training.weeklySchedule", {
                  defaultValue: "Weekly Schedule",
                })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                {SCHEDULE_IDS.map((scheduleId) => {
                  const isActive = currentSchedule === scheduleId;
                  const dayCount = SCHEDULE_DAY_COUNT[scheduleId];
                  const activeDays =
                    SCHEDULE_TRAINING_DAYS[scheduleId] ??
                    SCHEDULE_TRAINING_DAYS.Balanced;

                  return (
                    <button
                      key={scheduleId}
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSetSchedule(scheduleId)}
                      className={cn(
                        "flex flex-1 flex-col gap-2 rounded-xl border-2 p-3 text-left transition-all",
                        isActive
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50",
                        isSaving && "pointer-events-none opacity-60",
                      )}
                    >
                      <div
                        className={cn(
                          "text-primary",
                          isActive && "text-primary",
                        )}
                      >
                        {SCHEDULE_ICONS[scheduleId]}
                      </div>
                      <p className="font-heading text-sm font-bold uppercase tracking-wider text-foreground">
                        {t(`training.schedules.${scheduleId}.label`)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dayCount}{" "}
                        {t("training.daysPerWeek", {
                          defaultValue: "days/week",
                        })}
                      </p>
                      {/* Day indicator dots */}
                      <div className="flex gap-1">
                        {dayShortLabels.map((label, idx) => (
                          <span
                            key={idx}
                            className={cn(
                              "flex size-4 items-center justify-center rounded-full text-[8px] font-heading font-bold",
                              activeDays.includes(idx)
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground/50",
                            )}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                {t(`training.schedules.${currentSchedule}.detail`)}{" "}
                {t("training.todayIs", {
                  defaultValue: "Today is {{day}} — {{type}}",
                  day: dayShortLabels[todayWeekday],
                  type: isTodayTraining
                    ? t("training.aTrainingDay", {
                        defaultValue: "training day",
                      })
                    : t("training.aRestDay", { defaultValue: "rest day" }),
                })}
              </p>
            </CardContent>
          </Card>

          {/* ── Training Focus + Intensity Card ─────────────────── */}
          <Card className="flex-1">
            <CardHeader>
              <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
                {t("training.trainingFocus", {
                  defaultValue: "Training Focus",
                })}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {/* Focus grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {TRAINING_FOCUS_IDS.map((focusId) => {
                  const isActive = currentFocus === focusId;
                  const attrs = TRAINING_FOCUS_ATTRS[focusId] ?? [];

                  return (
                    <button
                      key={focusId}
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        handleSetTraining(focusId, currentIntensity)
                      }
                      className={cn(
                        "flex flex-col gap-2 rounded-xl border-2 p-3 text-left transition-all",
                        isActive
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50",
                        isSaving && "pointer-events-none opacity-60",
                      )}
                    >
                      <div className="text-muted-foreground">
                        {TRAINING_FOCUS_ICONS[focusId]}
                      </div>
                      <p className="font-heading text-sm font-bold uppercase tracking-wider text-foreground">
                        {t(`training.focuses.${focusId}.label`)}
                      </p>
                      <p className="text-xs leading-tight text-muted-foreground">
                        {t(`training.focuses.${focusId}.desc`)}
                      </p>
                      {attrs.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {attrs.map((attr) => (
                            <span
                              key={attr}
                              className="rounded bg-muted px-1.5 py-0.5 font-heading text-[10px] uppercase tracking-wider text-muted-foreground"
                            >
                              {statLabel(attr)}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Intensity row */}
              <div className="mt-5 border-t border-border pt-4">
                <div className="mb-3 flex items-center gap-2">
                  <Gauge className="size-4 text-muted-foreground" />
                  <span className="font-heading text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t("training.intensity", { defaultValue: "Intensity" })}
                  </span>
                </div>
                <div className="flex gap-3">
                  {INTENSITY_IDS.map((intensityId) => (
                    <button
                      key={intensityId}
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        handleSetTraining(currentFocus, intensityId)
                      }
                      className={cn(
                        "flex-1 rounded-lg border-2 py-5 px-3 text-left transition-all",
                        currentIntensity === intensityId
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50",
                        isSaving && "pointer-events-none opacity-60",
                      )}
                    >
                      <p
                        className={cn(
                          "font-heading text-sm font-bold uppercase tracking-wider",
                          INTENSITY_COLORS[intensityId],
                        )}
                      >
                        {t(`training.intensities.${intensityId}.label`)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t(`training.intensities.${intensityId}.desc`)}
                      </p>
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  {t("training.trainingAppliedNote", {
                    defaultValue: "Training is applied daily.",
                  })}
                  {activeFocusAttrs.length > 0 && (
                    <>
                      {" "}
                      {t("training.currentlyTraining", {
                        defaultValue:
                          "Currently training {{attrs}} at {{intensity}} intensity.",
                        attrs: activeFocusAttrs
                          .map((a) => statLabel(a))
                          .join(", "),
                        intensity: t(
                          `training.intensities.${currentIntensity}.label`,
                        ),
                      })}
                    </>
                  )}
                  {currentFocus === RECOVERY_TRAINING_FOCUS && (
                    <>
                      {" "}
                      {t("training.recoveryNote", {
                        defaultValue: "Recovery focus active.",
                      })}
                    </>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right column: Stats ───────────────────────────────── */}
        <div className="flex flex-col gap-4 h-full">
          {/* ── Staff Impact Card ───────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
                {t("training.staffImpact.title", {
                  defaultValue: "Staff Impact",
                })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {staffImpactRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-heading font-bold text-foreground tabular-nums">
                      {formatStaffEffectPercent(row.value)}
                    </span>
                  </div>
                ))}
                <p className="border-t border-border pt-2 text-xs text-muted-foreground">
                  {t("training.staffImpact.note", {
                    defaultValue:
                      "Staff impact scales with coach quality and specialisation.",
                  })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ── Squad Fitness Card ──────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
                {t("training.squadFitness", {
                  defaultValue: "Squad Fitness",
                })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {/* Condition */}
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t("training.avgCondition", {
                        defaultValue: "Avg Condition",
                      })}
                    </span>
                    <span className="font-heading font-bold text-foreground tabular-nums">
                      {avgCondition}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        avgCondition > 70
                          ? "bg-emerald-500"
                          : avgCondition > 40
                            ? "bg-amber-500"
                            : "bg-red-500",
                      )}
                      style={{ width: `${avgCondition}%` }}
                    />
                  </div>
                </div>

                {/* Morale */}
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t("training.avgMorale", {
                        defaultValue: "Avg Morale",
                      })}
                    </span>
                    <span className="font-heading font-bold text-foreground tabular-nums">
                      {avgMorale}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        avgMorale > 70
                          ? "bg-emerald-500"
                          : avgMorale > 40
                            ? "bg-amber-500"
                            : "bg-red-500",
                      )}
                      style={{ width: `${avgMorale}%` }}
                    />
                  </div>
                </div>

                {/* Alerts */}
                {(exhaustedCount > 0 || criticalCount > 0) && (
                  <div className="border-t border-border pt-2">
                    {criticalCount > 0 && (
                      <p className="flex items-center gap-1 text-xs text-red-400">
                        <AlertTriangle className="size-3 shrink-0" />
                        {t("training.criticalCondition", {
                          defaultValue: "{{count}} player(s) critical condition",
                          count: criticalCount,
                        })}
                      </p>
                    )}
                    {exhaustedCount > 0 && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-400">
                        <AlertTriangle className="size-3 shrink-0" />
                        {t("training.exhaustedPlayers", {
                          defaultValue: "{{count}} player(s) exhausted",
                          count: exhaustedCount,
                        })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ═══ Training Groups ═══ */}
          <Card className="flex-1">
            <CardHeader>
              <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
                {t("training.groups.trainingGroups", {
                  defaultValue: "Training Groups",
                })}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {/* Group badges */}
              {groups.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5"
                    >
                      <span className="text-muted-foreground">
                        {TRAINING_FOCUS_ICONS[group.focus] ?? (
                          <Users className="size-4" />
                        )}
                      </span>
                      <span className="font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                        {group.name}
                      </span>
                      <span className="font-heading text-[10px] tabular-nums text-muted-foreground">
                        {group.player_ids.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(group.id)}
                        disabled={isSaving}
                        className="ml-1 flex size-4 items-center justify-center rounded-full text-muted-foreground/50 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!hasRoster || groups.length === 0 || showCreateGroup ? (
                <div>
                  {!hasRoster ? (
                    <p className="py-4 text-center font-heading text-sm uppercase tracking-wider text-muted-foreground">
                      {t("training.emptyRoster")}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {groups.length === 0 && !showCreateGroup && (
                        <>
                          <p className="py-4 text-center font-heading text-sm uppercase tracking-wider text-muted-foreground">
                            {t("training.groups.noGroups")}
                          </p>
                          <p className="mt-3 text-center text-xs text-muted-foreground">
                            {t("training.groups.trainingGroupsDesc")}
                          </p>
                          <div className="flex justify-center">
                            <button
                              type="button"
                              onClick={() => setShowCreateGroup(true)}
                              className="rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                            >
                              + {t("training.groups.addGroup", "Añadir grupo")}
                            </button>
                          </div>
                        </>
                      )}
                      {showCreateGroup && (
                        <div className="mx-auto max-w-md space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                          <p className="font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                            {t("training.groups.newGroup", "Nuevo grupo")}
                          </p>
                          <input
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder={t("training.groups.groupNamePlaceholder", "Nombre del grupo")}
                            className="w-full rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-foreground outline-none"
                          />
                          <select
                            value={newGroupFocus}
                            onChange={(e) => setNewGroupFocus(e.target.value)}
                            className="w-full rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-foreground outline-none"
                          >
                            {TRAINING_FOCUS_IDS.map((f) => (
                              <option key={f} value={f}>
                                {t(`training.focuses.${f}.label`)}
                              </option>
                            ))}
                          </select>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => { setShowCreateGroup(false); setNewGroupName(""); }}
                              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                            >
                              {t("common.cancel")}
                            </button>
                            <button
                              type="button"
                              onClick={handleAddGroup}
                              disabled={!newGroupName.trim()}
                              className="rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                            >
                              {t("common.create", "Crear")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-heading text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("common.player", { defaultValue: "Player" })}
                      </TableHead>
                      <TableHead className="font-heading text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("common.position", { defaultValue: "Pos" })}
                      </TableHead>
                      <TableHead className="font-heading text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("training.groups.group", {
                          defaultValue: "Group",
                        })}
                      </TableHead>
                      <TableHead className="font-heading text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("training.effectiveFocus", {
                          defaultValue: "Focus",
                        })}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRoster.map((player) => {
                      const playerGroup = playerGroupMap.get(player.id);
                      const playerFocus = normalizeOptionalTrainingFocus(
                        player.training_focus,
                      );
                      const hasIndividualFocus = !!playerFocus;
                      const effectiveFocus =
                        playerFocus ||
                        (playerGroup ? playerGroup.focus : teamFocus);

                      return (
                        <TableRow key={player.id}>
                          <TableCell className="font-heading text-sm font-bold text-foreground">
                            {player.match_name}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {translatePositionAbbreviation(
                              t,
                              player.natural_position || player.position,
                            )}
                          </TableCell>
                          <TableCell>
                            <select
                              value={playerGroup?.id ?? ""}
                              onChange={(e) =>
                                setPlayerGroup(player.id, e.target.value)
                              }
                              disabled={isSaving}
                              className={cn(
                                "w-full max-w-[130px] rounded-md border bg-transparent px-2 py-1 font-heading text-xs uppercase tracking-wider text-foreground transition-colors",
                                "border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
                                isSaving && "pointer-events-none opacity-50",
                              )}
                            >
                              <option value="">
                                {t("training.groups.teamDefault", {
                                  defaultValue: "Team default",
                                })}
                              </option>
                              {groups.map((group) => (
                                <option key={group.id} value={group.id}>
                                  {group.name}
                                </option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "inline-block rounded px-2 py-0.5 font-heading text-[11px] uppercase tracking-wider",
                                hasIndividualFocus
                                  ? "border border-primary/30 bg-primary/10 text-primary"
                                  : "text-muted-foreground",
                              )}
                            >
                              {t(`training.focuses.${effectiveFocus}.label`)}
                              {hasIndividualFocus && " *"}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              <p className="mt-3 text-xs text-muted-foreground">
                {t("training.groups.trainingGroupsDesc", {
                  defaultValue:
                    "Assign players to training groups to customise their focus. Groups with a custom focus override the team default.",
                })}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      </TabsContent>

      {/* ═══ Tab: SoloQ Ranks ═══ */}
      <TabsContent value="soloq" className="flex-1">
        <div className="h-full">
          {soloQRanksCard}
        </div>
      </TabsContent>
    </Tabs>
    </div>
  );
}
