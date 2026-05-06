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

const REVIEW_DECISIONS: Array<{
  id: DailyScrimAction;
  label: string;
  description: string;
  benefits: string;
  costs: string;
  whenToPick: string;
  risk: "Bajo" | "Medio" | "Alto";
}> = [
  {
    id: "CancelScrims",
    label: "Cancelar scrims",
    description: "Cortás el plan competitivo del día y pasás a respuesta dirigida.",
    benefits: "Evita sobrecarga tras bloque malo y te deja elegir enfoque correctivo.",
    costs: "Perdés volumen competitivo del día.",
    whenToPick: "Cuando el bloque 1 salió mal y no querés forzar continuidad.",
    risk: "Bajo",
  },
  {
    id: "ContinueToBlock2",
    label: "Continuar al segundo bloque",
    description: "El resultado fue bueno: mantenés el plan del día.",
    benefits: "Aprovecha momentum y conserva el segundo scrim planificado.",
    costs: "Más carga acumulada que descansar ahora.",
    whenToPick: "Cuando el bloque salió bien y querés sostener ritmo competitivo.",
    risk: "Medio",
  },
  {
    id: "VodReview",
    label: "VOD Review",
    description: "Convierte errores en aprendizaje táctico.",
    benefits: "Mejora lectura macro/draft y baja severidad del issue.",
    costs: "Recuperás menos condición que con Mental Reset.",
    whenToPick: "Cuando el problema fue de setup, decisiones o draft.",
    risk: "Bajo",
  },
  {
    id: "MentalReset",
    label: "Mental Reset",
    description: "Protege moral y recuperación.",
    benefits: "Sube moral/condición y corta espiral negativa.",
    costs: "Aprendizaje técnico más bajo esta fase.",
    whenToPick: "Después de derrota dura o racha emocional negativa.",
    risk: "Bajo",
  },
  {
    id: "TargetedDrills",
    label: "Targeted Drills",
    description: "Ataca el problema detectado con más carga.",
    benefits: "Acelera corrección del issue y progreso específico.",
    costs: "Costo moderado de condición.",
    whenToPick: "Si el issue está claro y querés corrección puntual.",
    risk: "Medio",
  },
  {
    id: "OfferRest",
    label: "Ofrecer descanso",
    description: "El resultado fue bueno: cancelás el resto de scrims del día.",
    benefits: "Protege moral y condición tras un bloque positivo.",
    costs: "Menos volumen de práctica ese día.",
    whenToPick: "Cuando ya conseguiste aprendizaje suficiente y querés cuidar al equipo.",
    risk: "Bajo",
  },
  {
    id: "DayOff",
    label: "Day Off",
    description: "Cerrás la jornada y priorizás recuperación total.",
    benefits: "Mayor recuperación de moral/condición para el próximo día.",
    costs: "Menos aprendizaje técnico inmediato.",
    whenToPick: "Después del segundo bloque cuando el equipo llega cargado o emocionalmente tocado.",
    risk: "Bajo",
  },
  {
    id: "PushThrough",
    label: "Push Through",
    description: "Maximiza volumen, con riesgo de fatiga.",
    benefits: "Máximo aprendizaje bruto en corto plazo.",
    costs: "Riesgo alto de fatiga/tilt si venís golpeado.",
    whenToPick: "Solo si el equipo está estable y querés exprimir la semana.",
    risk: "Alto",
  },
];

const DECISION_BY_ID = new Map(REVIEW_DECISIONS.map((option) => [option.id, option]));

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
  const todayFixture = gameState.league?.fixtures.find((fixture) => {
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
    ContinueToBlock2: ["Momentum +", "Fatiga -", "Volumen +"],
    OfferRest: ["Recuperación +", "Fatiga +", "Volumen -"],
    PushThrough: ["Volumen +", "Aprendizaje +", "Mental -"],
    CancelScrims: ["Recuperación +", "Riesgo -", "Volumen -"],
    VodReview: ["Análisis +", "Calidad +", "Recuperación -"],
    MentalReset: ["Mental +", "Recuperación +", "Técnica -"],
    TargetedDrills: ["Issue +", "Mecánicas +", "Fatiga -"],
    DayOff: ["Recuperación +", "Mental +", "Volumen -"],
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
        title: t("home.todayMatch", "Partido oficial"),
        detail: todayFixture.competition,
        accent: "text-primary-500",
        actionLabel: t("dashboard.schedule", "Calendario"),
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
                defaultValue: "Resultado bloque {{block}} vs {{team}}",
              },
            )
            : t("home.todayScrimBlockResult", "Resultado de scrim del bloque actual"),
          detail: t(
            "home.todayScrimBlockDecisionDetail",
            {
              index: dailyBlockMeta?.blockNumber ?? 1,
              total: dailyBlockMeta?.blocksToday ?? 2,
              defaultValue: "Scrim {{index}}/{{total}} del día resuelto. Elegí la decisión del bloque para continuar.",
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
            : t("home.todayScrimOpen", "Bloque de scrim sin rival"),
          detail: t("home.todayScrimDetail", "Revisá el Plan A/B/C antes de avanzar el día."),
          accent: "text-amber-400",
          actionLabel: t("dashboard.scrims", "Scrims"),
          actionTab: "Scrims",
        }
      : {
          icon: <Dumbbell className="h-6 w-6" />,
          title: t("home.todayTraining", "Entrenamiento y preparación"),
          detail: t("home.todayTrainingDetail", "Sin scrim ni partido programado para hoy."),
          accent: "text-accent-500",
          actionLabel: t("dashboard.training", "Entrenamiento"),
          actionTab: "Training",
        };

  const handleReviewDecision = async (decision: DailyScrimAction) => {
    if (!unresolvedReviewReport) return;
    if (decision === "CancelScrims") {
      setShowCancelFollowups(true);
      setDecisionFeedback({
        title: "Scrims del día cancelados",
        detail: "Ahora elegí cómo responder al bloque malo: VOD Review, Mental Reset o Targeted Drills.",
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
          title: "Continuás al segundo bloque",
          detail: "El equipo mantiene el plan del día y conserva el siguiente scrim seleccionado.",
        },
        OfferRest: {
          title: "Ofreciste descanso y cancelaste el bloque siguiente",
          detail: "Aprovechaste el buen resultado para proteger condición y moral del equipo.",
        },
        CancelScrims: {
          title: "Scrims del día cancelados",
          detail: "Elegí respuesta correctiva para cerrar el día.",
        },
        VodReview: {
          title: isFirstDailyBlock ? "Aplicaste VOD Review y cancelaste bloque siguiente" : "Aplicaste VOD Review",
          detail: isFirstDailyBlock
            ? "Se canceló el próximo bloque del día. Convertiste este resultado en aprendizaje macro/draft con costo leve de recuperación."
            : "Mejora aprendizaje macro/draft y reduce severidad del issue, con costo leve de recuperación.",
        },
        MentalReset: {
          title: isFirstDailyBlock ? "Aplicaste Mental Reset y cancelaste bloque siguiente" : "Aplicaste Mental Reset",
          detail: isFirstDailyBlock
            ? "Se canceló el próximo bloque del día. Priorizaste recuperación de moral/condición para estabilizar al equipo."
            : "Recupera moral/condición del equipo y corta tilt, pero con menor crecimiento técnico inmediato.",
        },
        TargetedDrills: {
          title: isFirstDailyBlock ? "Aplicaste Targeted Drills y cancelaste bloque siguiente" : "Aplicaste Targeted Drills",
          detail: isFirstDailyBlock
            ? "Se canceló el próximo bloque del día. Enfocaste la jornada en corregir el problema detectado con carga dirigida."
            : "Acelera corrección del problema detectado y progreso específico, con costo moderado de condición.",
        },
        DayOff: {
          title: "Diste el resto del día libre",
          detail: "El equipo corta carga y recupera moral/condición para llegar mejor al próximo bloque competitivo.",
        },
        PushThrough: {
          title: "Aplicaste Push Through",
          detail: "Maximiza aprendizaje bruto esta fase, pero aumenta riesgo de fatiga/tilt si el equipo está golpeado.",
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
                  {t("home.today", "Hoy")}
                </p>
                <h2 className="mt-1 text-2xl font-heading font-bold text-gray-900 dark:text-white">
                  {activity.title}
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {activity.detail}
                </p>
                <p className="mt-2 text-xs font-heading font-bold uppercase tracking-wider text-primary-500 dark:text-primary-400">
                  {t("home.currentPhase", "Fase actual")}: {t(dayPhaseLabelKey(dayPhase), dayPhase)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canPlanTodayScrim ? (
                <span className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-heading uppercase tracking-wider text-gray-600 dark:border-navy-600 dark:text-gray-300">
                  {t("scrims.reputation", "Rep scrims")}: {team.scrim_reputation ?? 50}
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
                {t("scrims.reviewBlockTitle", "Revision post-scrim")}
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
                {t("scrims.reportFocus", "Foco")}: {unresolvedReviewReport.focus}
                {unresolvedReviewReport.issue ? ` · ${t("scrims.detectedIssue", "Problema detectado")}: ${unresolvedReviewReport.issue}` : ""}
              </p>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                {isFirstDailyBlock
                  ? t(
                    "scrims.blockAInstruction",
                    showCancelFollowups
                      ? "Bloque 1/2: elegí la respuesta técnica tras cancelar los scrims del día."
                      : "Bloque 1/2: definí si seguís con el plan del día o cancelás el siguiente bloque para priorizar recuperación/trabajo dirigido.",
                  )
                  : t(
                    "scrims.blockBInstruction",
                    "Bloque 2/2: cerrá el día con una decisión de recuperación o trabajo dirigido antes de continuar.",
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
                        ? t("common.saving", "Guardando")
                        : isSecondDailyBlock && option.id === "DayOff"
                              ? t("scrims.freeDayOff", "Dar resto del día libre")
                            : option.label}
                    </span>
                    {suggestedDecision === option.id ? (
                      <span className="mt-1 inline-block text-[10px] font-heading uppercase tracking-wider text-primary-600 dark:text-primary-300">
                        Recomendado ahora
                      </span>
                    ) : null}
                    <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                      {option.description}
                    </span>
                    <span className="mt-3 flex flex-wrap gap-2">
                      {decisionImpactTags[option.id].map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] font-heading uppercase tracking-wider text-gray-500 dark:text-gray-400"
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
                Riesgo y recompensa de hoy
              </p>
              <p className="mt-1 text-gray-700 dark:text-gray-200">
                Riesgo: <strong>{riskLevel}</strong>
                {opponentOvr != null ? ` · Gap OVR: ${ovrGap >= 0 ? "+" : ""}${ovrGap}` : ""}
                {todayScrimOpponent ? ` (${todayScrimOpponent.name})` : ""}
              </p>
              <p className="mt-1 text-gray-700 dark:text-gray-200">
                Valor de aprendizaje esperado: <strong>{rewardLevel}</strong>
              </p>
              <p className="mt-1 text-gray-700 dark:text-gray-200">
                Costo de cancelar: <strong>-{cancelCost} rep scrims</strong>
              </p>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                Recomendación: {riskLevel === "Alto"
                  ? "si estás en racha negativa, considerá Mental Reset después del bloque."
                  : "mantené el plan y priorizá ejecución sobre volumen."}
              </p>
            </div>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
