import { useMemo, useState } from "react";
import { CalendarClock, Dumbbell, Eye, Swords, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { GameStateData, PostScrimDecision, TeamData } from "../../store/gameStore";
import { dateKey, deriveDailyScrimBlockMeta, deriveTodayScrimContext, effectiveWeeklyScrimSlots } from "../../lib/scrimContext";
import { chooseDailyScrimAction, type DailyScrimAction } from "../../services/trainingService";
import { useScrimContextWithFallback } from "../../hooks/useScrimContextWithFallback";
import { Card, CardBody } from "../ui";

interface HomeTodayPlanCardProps {
  gameState: GameStateData;
  team: TeamData;
  onGameUpdate?: (state: GameStateData) => void;
  onNavigate?: (tab: string) => void;
}

function dayPhaseLabelKey(phase: string): string {
  return `dayPhases.${phase}`;
}

function estimateTeamOvr(gameState: GameStateData, teamId: string): number {
  const players = gameState.players.filter((player) => player.team_id === teamId).slice(0, 5);
  if (players.length === 0) return 74;
  const avg = players.reduce((sum, player) => {
    const a = player.attributes;
    return sum + Math.round((a.mechanics + a.laning + a.teamfighting + a.macro_play + a.consistency + a.shotcalling + a.champion_pool + a.discipline + a.mental_resilience) / 9);
  }, 0) / players.length;
  return Math.round(avg);
}

function buildReviewDecisions(t: (key: string, fallback?: string) => string): Array<{
  id: DailyScrimAction;
  label: string;
  description: string;
  benefits: string;
  costs: string;
  whenToPick: string;
  risk: "Bajo" | "Medio" | "Alto";
}> {
  return [{
    id: "CancelScrims",
    label: t("scrims.decision.cancelScrims"),
    description: t("home.scrimDecision.cancelScrims.desc"),
    benefits: t("home.scrimDecision.cancelScrims.benefits"),
    costs: t("home.scrimDecision.cancelScrims.costs"),
    whenToPick: t("home.scrimDecision.cancelScrims.when"),
    risk: t("common.low") as "Bajo",
  },
  {
    id: "ContinueToBlock2",
    label: t("scrims.decision.continueBlock2"),
    description: t("home.scrimDecision.continueBlock2.desc"),
    benefits: "Aprovecha momentum y conserva el segundo scrim planificado.",
    costs: "Higher accumulated load than resting now.",
    whenToPick: "When block one was stable and you want to sustain competitive pace.",
    risk: t("common.medium") as "Medio",
  },
  {
    id: "VodReview",
    label: t("scrims.decision.vodReview"),
    description: t("home.scrimDecision.vodReview.desc"),
    benefits: "Mejora lectura macro/draft y baja severidad del issue.",
    costs: "Less recovery than Mental Reset.",
    whenToPick: "Cuando el problema fue de setup, decisiones o draft.",
    risk: t("common.low") as "Bajo",
  },
  {
    id: "MentalReset",
    label: t("scrims.decision.mentalReset"),
    description: t("home.scrimDecision.mentalReset.desc"),
    benefits: "Boosts morale/recovery and stops negative spirals.",
    costs: "Lower technical learning this phase.",
    whenToPick: "After a hard loss or emotional downswing.",
    risk: t("common.low") as "Bajo",
  },
  {
    id: "TargetedDrills",
    label: t("scrims.decision.targetedDrills"),
    description: t("home.scrimDecision.targetedDrills.desc"),
    benefits: "Accelerates issue correction and targeted progress.",
    costs: "Moderate recovery cost.",
    whenToPick: "When the issue is clear and you want precise correction.",
    risk: t("common.medium") as "Medio",
  },
  {
    id: "OfferRest",
    label: t("scrims.decision.offerRest"),
    description: t("home.scrimDecision.offerRest.desc"),
    benefits: "Protects morale and recovery after a positive block.",
    costs: "Lower practice volume for the day.",
    whenToPick: "When you already got enough learning and want to protect the team.",
    risk: t("common.low") as "Bajo",
  },
  {
    id: "DayOff",
    label: t("scrims.decision.dayOff"),
    description: t("home.scrimDecision.dayOff.desc"),
    benefits: "Higher morale/recovery for the next day.",
    costs: "Less immediate technical learning.",
    whenToPick: "After block two when the team is physically or emotionally overloaded.",
    risk: t("common.low") as "Bajo",
  },
  {
    id: "PushThrough",
    label: t("scrims.decision.pushThrough"),
    description: t("home.scrimDecision.pushThrough.desc"),
    benefits: "Maximum raw learning in the short term.",
    costs: "High fatigue/tilt risk if the team is already fragile.",
    whenToPick: "Only if team state is stable and you want to maximize the week.",
    risk: t("common.high") as "Alto",
  }];
}

function recommendedDecision(report: NonNullable<ReturnType<typeof deriveTodayScrimContext>["report"]>): PostScrimDecision {
  if (!report.won && (report.issue === "Tilt" || report.severity >= 3)) return "MentalReset";
  if (report.issue === "ObjectiveSetup" || report.issue === "DraftGap") return "VodReview";
  if (report.issue === "ChampionComfort" || report.issue === "LanePressure") return "TargetedDrills";
  return "PushThrough";
}

function shouldPushThroughContext(
  report: NonNullable<ReturnType<typeof deriveTodayScrimContext>["report"]>,
  ownRep: number,
  ownLossStreak: number,
  opponentRep: number,
): boolean {
  return !report.won && (
    report.severity >= 3
    || ownLossStreak >= 3
    || ownRep >= opponentRep + 10
  );
}

export default function HomeTodayPlanCard({
  gameState,
  team,
  onGameUpdate,
  onNavigate,
}: HomeTodayPlanCardProps) {
  const { t } = useTranslation();
  const REVIEW_DECISIONS = useMemo(() => buildReviewDecisions((k, f) => t(k, { defaultValue: f })), [t]);
  const DECISION_BY_ID = useMemo(() => new Map(REVIEW_DECISIONS.map((option) => [option.id, option])), [REVIEW_DECISIONS]);
  const [decisionSaving, setDecisionSaving] = useState<DailyScrimAction | null>(null);
  const [decisionFeedback, setDecisionFeedback] = useState<{ title: string; detail: string } | null>(null);
  const [showCancelFollowups, setShowCancelFollowups] = useState(false);
  const remoteScrimContext = useScrimContextWithFallback(gameState);
  const todayKey = dateKey(gameState.clock.current_date);
  const fallbackScrimContext = useMemo(
    () => deriveTodayScrimContext(gameState, team),
    [gameState, team],
  );
  const scrimContext = remoteScrimContext?.today ?? fallbackScrimContext;
  const todayFixture = gameState.leagues?.[0]?.fixtures.find((fixture) => {
    if (fixture.status !== "Scheduled") return false;
    if (dateKey(fixture.date) !== todayKey) return false;
    return fixture.home_team_id === team.id || fixture.away_team_id === team.id;
  }) ?? null;
  const todayScrimOpponent = scrimContext.opponentTeamId
    ? gameState.teams.find((candidate) => candidate.id === scrimContext.opponentTeamId) ?? null
    : null;
  const dayPhase = gameState.day_phase ?? "Morning";
  const decisionPhaseActive = dayPhase === "ScrimBlock";
  const unresolvedReviewReport = decisionPhaseActive && scrimContext.canReview ? scrimContext.report : null;
  const suggestedDecision = unresolvedReviewReport ? recommendedDecision(unresolvedReviewReport) : null;
  const reviewOpponent = unresolvedReviewReport
    ? gameState.teams.find((candidate) => candidate.id === unresolvedReviewReport.opponent_team_id)
    : null;
  const pushThroughContext = unresolvedReviewReport
    ? shouldPushThroughContext(
      unresolvedReviewReport,
      team.scrim_reputation ?? 50,
      team.scrim_loss_streak ?? 0,
      reviewOpponent?.scrim_reputation ?? 50,
    )
    : false;
  const effectivePushThroughContext = scrimContext.pushThroughRecommended || pushThroughContext;
  void effectivePushThroughContext;
  const dailyBlockMeta = unresolvedReviewReport
    ? deriveDailyScrimBlockMeta(
      effectiveWeeklyScrimSlots(team),
      gameState.clock.current_date,
      unresolvedReviewReport.slot_index,
    )
    : null;
  const canPlanTodayScrim = scrimContext.canCancel;
  const isSecondDailyBlock = dailyBlockMeta?.blockNumber === 2;
  const isFirstDailyBlock = dailyBlockMeta?.blockNumber === 1;
  const resultIsBad = unresolvedReviewReport ? !unresolvedReviewReport.won : false;
  const visibleDecisionIds: DailyScrimAction[] = (() => {
    if (!unresolvedReviewReport) return [];
    if (isFirstDailyBlock) {
      return resultIsBad
        ? (showCancelFollowups
            ? ["VodReview", "MentalReset", "TargetedDrills"]
            : ["PushThrough", "CancelScrims"])
        : ["OfferRest", "ContinueToBlock2"];
    }
    return resultIsBad
      ? ["DayOff", "VodReview", "MentalReset", "TargetedDrills"]
      : ["DayOff"];
  })();
  const visibleDecisionOptions = visibleDecisionIds
    .map((id) => DECISION_BY_ID.get(id))
    .filter((option): option is NonNullable<typeof option> => Boolean(option));
  const decisionImpactTags: Record<DailyScrimAction, string[]> = {
    ContinueToBlock2: [t("scrims.tag.momentumPlus"), t("scrims.tag.fatigueMinus"), t("scrims.tag.volumePlus")],
    OfferRest: [t("scrims.tag.recoveryPlus"), t("scrims.tag.fatiguePlus"), t("scrims.tag.volumeMinus")],
    PushThrough: [t("scrims.tag.volumePlus"), t("scrims.tag.learningPlus"), t("scrims.tag.mentalMinus")],
    CancelScrims: [t("scrims.tag.recoveryPlus"), t("scrims.tag.riskMinus"), t("scrims.tag.volumeMinus")],
    VodReview: [t("scrims.tag.analysisPlus"), t("scrims.tag.qualityPlus"), t("scrims.tag.recoveryMinus")],
    MentalReset: [t("scrims.tag.mentalPlus"), t("scrims.tag.recoveryPlus"), t("scrims.tag.techniqueMinus")],
    TargetedDrills: [t("scrims.tag.issuePlus"), t("scrims.tag.mechanicsPlus"), t("scrims.tag.fatigueMinus")],
    DayOff: [t("scrims.tag.recoveryPlus"), t("scrims.tag.mentalPlus"), t("scrims.tag.volumeMinus")],
  };
  const ownOvr = estimateTeamOvr(gameState, team.id);
  const opponentOvr = todayScrimOpponent ? estimateTeamOvr(gameState, todayScrimOpponent.id) : null;
  const ovrGap = opponentOvr != null ? opponentOvr - ownOvr : 0;
  const riskLevel = ovrGap >= 6 ? "Alto" : ovrGap >= 3 ? "Medio" : "Bajo";
  const rewardLevel = ovrGap >= 3 ? "Alto" : ovrGap >= 0 ? "Medio" : "Bajo";
  const cancelCost = 5;

  const activity = todayFixture
    ? {
        icon: <Trophy className="h-6 w-6" />,
        title: t("home.todayMatch"),
        detail: todayFixture.match_type,
        accent: "text-primary-500",
        actionLabel: t("dashboard.schedule"),
        actionTab: "Schedule",
      }
      : unresolvedReviewReport
      ? {
          icon: <Swords className="h-6 w-6" />,
          title: reviewOpponent
            ? t(
              "home.todayScrimBlockResultVs",
              {
                team: reviewOpponent.name,
                block: dailyBlockMeta?.blockLabel ?? "A",
                defaultValue: "Block {{block}} result vs {{team}}",
              },
            )
            : t("home.todayScrimBlockResult"),
          detail: t(
            "home.todayScrimBlockDecisionDetail",
            {
              index: dailyBlockMeta?.blockNumber ?? 1,
              total: dailyBlockMeta?.blocksToday ?? 2,
              defaultValue: "Scrim {{index}}/{{total}} resolved. Choose the block decision to continue.",
            },
          ),
          accent: "text-amber-400",
          actionLabel: null,
          actionTab: null,
        }
      : scrimContext.state === "Planned"
      ? {
          icon: <Swords className="h-6 w-6" />,
          title: todayScrimOpponent
            ? t("home.todayScrimVs", { team: todayScrimOpponent.name, defaultValue: "Scrim vs {{team}}" })
            : t("home.todayScrimOpen"),
          detail: t("home.todayScrimDetail"),
          accent: "text-amber-400",
          actionLabel: t("dashboard.scrims"),
          actionTab: "Scrims",
        }
      : {
          icon: <Dumbbell className="h-6 w-6" />,
          title: t("home.todayTraining"),
          detail: t("home.todayTrainingDetail"),
          accent: "text-accent-500",
          actionLabel: t("dashboard.training"),
          actionTab: "Training",
        };

  const handleReviewDecision = async (decision: DailyScrimAction) => {
    if (!unresolvedReviewReport) return;
    if (decision === "CancelScrims") {
      setShowCancelFollowups(true);
      setDecisionFeedback({
        title: t("home.scrimFeedback.cancelledTitle"),
        detail: t("home.scrimFeedback.cancelledDetail"),
      });
      return;
    }
    setDecisionSaving(decision);
    setDecisionFeedback(null);
    try {
      const updated = await chooseDailyScrimAction(unresolvedReviewReport.slot_index, decision);
      onGameUpdate?.(updated);
      const feedbackByDecision: Record<DailyScrimAction, { title: string; detail: string }> = {
        ContinueToBlock2: {
          title: "You continue to block two",
          detail: "The team keeps today's plan and preserves the next selected scrim.",
        },
        OfferRest: {
          title: "You offered rest and cancelled the next block",
          detail: "You used the positive result to protect team recovery and morale.",
        },
        CancelScrims: {
          title: "Today's scrims cancelled",
          detail: "Choose a corrective follow-up to close the day.",
        },
        VodReview: {
          title: isFirstDailyBlock ? "Applied VOD Review and cancelled next block" : "Applied VOD Review",
          detail: isFirstDailyBlock
            ? "The next block was cancelled. You converted this result into macro/draft learning with a small recovery cost."
            : "Improves macro/draft learning and lowers issue severity, with a small recovery cost.",
        },
        MentalReset: {
          title: isFirstDailyBlock ? "Applied Mental Reset and cancelled next block" : "Applied Mental Reset",
          detail: isFirstDailyBlock
            ? "The next block was cancelled. You prioritized morale/recovery to stabilize the team."
            : "Recovers morale/recovery and reduces tilt, but with lower immediate technical growth.",
        },
        TargetedDrills: {
          title: isFirstDailyBlock ? "Applied Targeted Drills and cancelled next block" : "Applied Targeted Drills",
          detail: isFirstDailyBlock
            ? "The next block was cancelled. You focused the day on correcting the detected issue with targeted workload."
            : "Accelerates correction of the detected issue and targeted progress, with a moderate recovery cost.",
        },
        DayOff: {
          title: "You gave the rest of the day off",
          detail: "The team cuts load and recovers morale/recovery for the next competitive block.",
        },
        PushThrough: {
          title: "Aplicaste Push Through",
          detail: "Maximizes raw learning this phase, but increases fatigue/tilt risk if the team is fragile.",
        },
      };
      setDecisionFeedback(feedbackByDecision[decision]);
      setShowCancelFollowups(false);
    } catch (error) {
      console.error("Failed to choose post-scrim decision:", error);
    } finally {
      setDecisionSaving(null);
    }
  };

  return (
    <Card accent="primary">
      <CardBody>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className={`rounded-2xl bg-gray-100 p-3 dark:bg-navy-900 ${activity.accent}`}>
                {activity.icon}
              </div>
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <CalendarClock className="h-4 w-4" />
                  {t("home.today")}
                </p>
                <h2 className="mt-1 text-2xl font-heading font-bold text-gray-900 dark:text-white">
                  {activity.title}
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {activity.detail}
                </p>
                <p className="mt-2 text-xs font-heading font-bold uppercase tracking-wider text-primary-500 dark:text-primary-400">
                  {t("home.currentPhase")}: {t(dayPhaseLabelKey(dayPhase), dayPhase)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canPlanTodayScrim ? (
                <span className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-heading uppercase tracking-wider text-gray-600 dark:border-navy-600 dark:text-gray-300">
                  {t("scrims.reputation")}: {team.scrim_reputation ?? 50}
                </span>
              ) : null}
              {activity.actionLabel && activity.actionTab ? (
                <button
                  type="button"
                  onClick={() => onNavigate?.(activity.actionTab)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-3 py-2 text-sm font-heading font-bold uppercase tracking-wider text-white transition-colors hover:bg-primary-600"
                >
                  <Eye className="h-4 w-4" />
                  {activity.actionLabel}
                </button>
              ) : null}
            </div>
          </div>

          {unresolvedReviewReport ? (
            <div className="rounded-xl border border-gray-200 bg-transparent p-4 text-sm dark:border-navy-600">
              <p className="font-heading text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t("scrims.reviewBlockTitle")}
              </p>
              <p className="mt-1 text-gray-700 dark:text-gray-200">
                {unresolvedReviewReport.won
                  ? t("scrims.reviewWin", {
                      team: reviewOpponent?.name ?? unresolvedReviewReport.opponent_team_id,
                      defaultValue: "Victoria vs {{team}}",
                    })
                  : t("scrims.reviewLoss", {
                      team: reviewOpponent?.name ?? unresolvedReviewReport.opponent_team_id,
                      defaultValue: "Derrota vs {{team}}",
                    })}
                {" · "}
                {t("scrims.reportFocus")}: {unresolvedReviewReport.focus}
                {unresolvedReviewReport.issue ? ` · ${t("scrims.detectedIssue")}: ${unresolvedReviewReport.issue}` : ""}
              </p>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                {isFirstDailyBlock
                  ? t(
                    "scrims.blockAInstruction",
                    showCancelFollowups
                      ? "Block 1/2: choose the technical follow-up after cancelling today's scrims."
                      : "Block 1/2: decide whether to stay on plan or cancel the next block to prioritize recovery/targeted work.",
                  )
                  : t(
                    "scrims.blockBInstruction",
                    "Block 2/2: close the day with a recovery or targeted-work decision before continuing.",
                  )}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                {visibleDecisionOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={decisionSaving !== null}
                    onClick={() => void handleReviewDecision(option.id)}
                    className={`rounded-xl border-2 bg-transparent p-4 text-left transition-all hover:border-gray-300 disabled:opacity-60 dark:hover:border-navy-500 ${suggestedDecision === option.id ? "border-primary-500 dark:border-primary-500/70" : "border-gray-200 dark:border-navy-600"}`}
                  >
                    <span className="block font-heading text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                      {decisionSaving === option.id
                        ? t("common.saving")
                        : isSecondDailyBlock && option.id === "DayOff"
                              ? t("scrims.freeDayOff")
                            : option.label}
                    </span>
                    {suggestedDecision === option.id ? (
                      <span className="mt-1 inline-block text-2xs font-heading uppercase tracking-wider text-primary-600 dark:text-primary-300">
                        {t("home.recommendedNow")}
                      </span>
                    ) : null}
                    <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                      {option.description}
                    </span>
                    <span className="mt-3 flex flex-wrap gap-2">
                      {decisionImpactTags[option.id].map((tag) => (
                        <span
                          key={tag}
                          className="text-2xs font-heading uppercase tracking-wider text-gray-500 dark:text-gray-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {decisionFeedback ? (
            <div className="rounded-xl border border-gray-200 bg-transparent p-3 text-sm dark:border-navy-600">
              <p className="font-heading text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                {decisionFeedback.title}
              </p>
              <p className="mt-1 text-gray-700 dark:text-gray-200">
                {decisionFeedback.detail}
              </p>
            </div>
          ) : null}

          {scrimContext.state === "Planned" ? (
            <div className="rounded-xl border border-primary-300/40 bg-primary-500/10 p-3 text-sm dark:border-primary-500/30">
              <p className="font-heading text-xs font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">
                {t("home.riskRewardToday")}
              </p>
              <p className="mt-1 text-gray-700 dark:text-gray-200">
                {t("home.risk")}: <strong>{riskLevel}</strong>
                {opponentOvr != null ? ` · Gap OVR: ${ovrGap >= 0 ? "+" : ""}${ovrGap}` : ""}
                {todayScrimOpponent ? ` (${todayScrimOpponent.name})` : ""}
              </p>
              <p className="mt-1 text-gray-700 dark:text-gray-200">
                {t("home.expectedLearning")}: <strong>{rewardLevel}</strong>
              </p>
              <p className="mt-1 text-gray-700 dark:text-gray-200">
                {t("home.cancelCost")}: <strong>-{cancelCost} {t("scrims.reputation")}</strong>
              </p>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                {t("home.recommendation")}: {riskLevel === "Alto"
                  ? t("home.recommendationHighRisk")
                  : t("home.recommendationNormalRisk")}
              </p>
            </div>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
