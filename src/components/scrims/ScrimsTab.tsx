import { useState } from "react";
import { CalendarDays, Gauge, Lightbulb, SlidersHorizontal, Swords, Target } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { GameStateData, ScrimFocus } from "../../store/gameStore";
import {
  buildStaffSuggestions,
  buildScrimPlanSignals as deriveScrimPlanSignals,
  deriveDailyScrimBlockMeta,
  deriveTodayScrimContext,
  deriveWeeklyScrimContext,
  effectiveWeeklyScrimSlots,
} from "../../lib/scrimContext";
import { Card, CardBody, CardHeader, Select } from "../ui";
import {
  chooseDailyScrimAction,
  finalizeWeeklyScrimSetup,
  setWeeklyScrimObjective,
  setWeeklyScrimSlots,
  type DailyScrimAction,
} from "../../services/trainingService";
import { useScrimContextWithFallback } from "../../hooks/useScrimContextWithFallback";
import ScrimPlanningCard from "./ScrimPlanningCard";
import { useSettingsStore } from "../../store/settingsStore";

interface ScrimsTabProps {
  gameState: GameStateData;
  onGameUpdate?: (state: GameStateData) => void;
}

const SCRIM_SLOT_OPTIONS = [2, 4, 6];
const ALLOW_SCRIM_CONTEXT_FALLBACK = true;
const SCRIM_OBJECTIVES: ScrimFocus[] = [
  "DraftPrep",
  "ChampionPool",
  "EarlyGame",
  "Teamfighting",
  "Macro",
  "Mental",
];

function teamLogoPath(teamId: string): string {
  const slug = teamId.replace(/^lec-/, "");
  if (slug === "shifters") {
    return "https://static.lolesports.com/teams/1765897071435_600px-Shifters_allmode.png";
  }
  return `/team-logos/${slug}.png`;
}

function scrimFocusLabel(t: ReturnType<typeof useTranslation>["t"], focus: ScrimFocus): string {
  const labels: Record<ScrimFocus, string> = {
    DraftPrep: t("training.scrims.objectives.draftPrep", "Mejorar control del mapa"),
    ChampionPool: t("training.scrims.objectives.championPool", "Expandir champion pool"),
    EarlyGame: t("training.scrims.objectives.earlyGame", "Arreglar early game"),
    Teamfighting: t("training.scrims.objectives.teamfighting", "Mejorar teamfights"),
    Macro: t("training.scrims.objectives.macro", "Pulir macro y objetivos"),
    Mental: t("training.scrims.objectives.mental", "Estabilizar mental"),
  };
  return labels[focus];
}

function scrimFocusImpactText(focus: ScrimFocus | null): string {
  if (!focus) return "Define una dirección semanal para que las decisiones de scrim tengan impacto claro.";
  const map: Record<ScrimFocus, string> = {
    DraftPrep: "Mejora preparación de draft, lectura de bans y planes de composición.",
    ChampionPool: "Amplía picks viables y reduce dependencia de comfort picks.",
    EarlyGame: "Mejora control de líneas, tempo inicial y primeras rotaciones.",
    Teamfighting: "Mejora ejecución de peleas, foco de objetivos y coordinación 5v5.",
    Macro: "Mejora setup de objetivos, control de mapa y decisiones de mid/late.",
    Mental: "Mejora estabilidad mental, recuperación y consistencia bajo presión.",
  };
  return map[focus];
}

function scrimFocusGrowthTags(focus: ScrimFocus | null): { primary: string[]; secondary: string[] } {
  if (!focus) {
    return { primary: [], secondary: [] };
  }
  const map: Record<ScrimFocus, { primary: string[]; secondary: string[] }> = {
    DraftPrep: {
      primary: ["Visión", "Decisiones"],
      secondary: ["Liderazgo"],
    },
    ChampionPool: {
      primary: ["Mecánicas", "Champion Pool"],
      secondary: ["Laning"],
    },
    EarlyGame: {
      primary: ["Laning", "Decisiones"],
      secondary: ["Visión"],
    },
    Teamfighting: {
      primary: ["Teamfighting", "Disciplina"],
      secondary: ["Posicionamiento"],
    },
    Macro: {
      primary: ["Macro", "Decisiones"],
      secondary: ["Coordinación"],
    },
    Mental: {
      primary: ["Resiliencia mental", "Consistencia"],
      secondary: ["Liderazgo"],
    },
  };
  return map[focus];
}

function riskBand(opponentOvr: number, ownOvr: number, repGap: number): "Bajo" | "Medio" | "Alto" {
  if (opponentOvr >= 80) return "Alto";
  if (opponentOvr >= 77) return "Medio";
  const pressure = Math.max(opponentOvr - ownOvr, Math.round(repGap / 4));
  if (pressure >= 4) return "Alto";
  if (pressure >= 2) return "Medio";
  return "Bajo";
}

function learningBand(ovrGap: number): "Bajo" | "Medio" | "Alto" {
  if (ovrGap >= 3) return "Alto";
  if (ovrGap >= 0) return "Medio";
  return "Bajo";
}

function weeklyObjectiveOutcome(
  objective: ScrimFocus | null,
  avgQuality: number,
  played: number,
  cancellations: number,
): "Cumplido" | "Parcial" | "Fallido" {
  if (!objective) return played >= 2 ? "Parcial" : "Fallido";
  if (played >= 3 && avgQuality >= 65 && cancellations <= 1) return "Cumplido";
  if (played >= 2 && avgQuality >= 55) return "Parcial";
  return "Fallido";
}

export default function ScrimsTab({
  gameState,
  onGameUpdate,
}: ScrimsTabProps) {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettingsStore();
  const [isSaving, setIsSaving] = useState(false);
  const [decisionSaving, setDecisionSaving] = useState<string | null>(null);
  const [decisionFeedback, setDecisionFeedback] = useState<string | null>(null);
  const [showCancelFollowups, setShowCancelFollowups] = useState(false);
  const reviewPhaseActive = (gameState.day_phase ?? "Morning") === "ScrimBlock";
  const remoteScrimContext = useScrimContextWithFallback(gameState);
  const myTeam = gameState.teams.find(
    (team) => team.id === gameState.manager.team_id,
  );

  if (!myTeam) {
    return (
      <p className="text-gray-500 dark:text-gray-400">{t("common.noTeam")}</p>
    );
  }

  const fallbackWeeklyContext = deriveWeeklyScrimContext(gameState, myTeam);
  const fallbackTodayContext = deriveTodayScrimContext(gameState, myTeam);
  const weeklyContext = remoteScrimContext?.week ?? (ALLOW_SCRIM_CONTEXT_FALLBACK ? fallbackWeeklyContext : null);
  const todayContext = remoteScrimContext?.today ?? (ALLOW_SCRIM_CONTEXT_FALLBACK ? fallbackTodayContext : null);

  if (!weeklyContext || !todayContext) {
    return (
      <p className="text-gray-500 dark:text-gray-400">
        {t("scrims.loadingContext", "Cargando contexto de scrims...")}
      </p>
    );
  }
  const weeklyCapacity = weeklyContext.capacity;
  const plannedScrims = weeklyContext.planned;
  const played = weeklyContext.played;
  const wins = weeklyContext.wins;
  const losses = weeklyContext.losses;
  const objective = weeklyContext.objective;
  const teamNameById = new Map(gameState.teams.map((team) => [team.id, team.name]));
  const latestReports = weeklyContext.latestReports.slice(0, 3);
  const nextOfficialRivalName = weeklyContext.nextOfficialRivalTeamId
    ? teamNameById.get(weeklyContext.nextOfficialRivalTeamId) ?? weeklyContext.nextOfficialRivalTeamId
    : null;
  const todayOpponentName = (() => {
    const candidate = todayContext.resolvedOpponentTeamId ?? todayContext.opponentTeamId;
    if (!candidate) return null;
    return teamNameById.get(candidate) ?? candidate;
  })();
  const planSignals = deriveScrimPlanSignals(gameState, myTeam.id, weeklyContext);
  const estimatedTodayGap = todayContext.opponentTeamId
    ? Math.max(0, planSignals.maxOpponentOvr - planSignals.ownOvr)
    : 0;
  const estimatedRepGap = todayContext.opponentTeamId
    ? Math.max(0, planSignals.avgOpponentScrimReputation - weeklyContext.reputation)
    : 0;
  const todayRisk = riskBand(planSignals.maxOpponentOvr, planSignals.ownOvr, estimatedRepGap);
  const todayLearning = learningBand(estimatedTodayGap);
  const cancelCost = 5;
  const setupLocked = weeklyContext.setupLocked;
  const assistantControls = settings.scrim_review_mode === "assistant";
  const objectiveGrowth = scrimFocusGrowthTags(objective);
  const weeklyOutcome = weeklyObjectiveOutcome(
    weeklyContext.objective,
    weeklyContext.avgQuality,
    weeklyContext.played,
    weeklyContext.cancellations,
  );
  const weeklyMainGain = weeklyContext.avgQuality >= 65
    ? "Calidad de práctica sólida"
    : weeklyContext.wins > weeklyContext.losses
      ? "Buena ejecución competitiva"
      : "Aprendizaje por exposición";
  const weeklyMainFailure = weeklyContext.topIssue
    ? `Issue recurrente: ${weeklyContext.topIssue}`
    : weeklyContext.cancellations >= 2
      ? "Demasiadas cancelaciones"
      : "Falta de consistencia en la semana";
  const dailyBlockMeta = todayContext.report
    ? deriveDailyScrimBlockMeta(
      effectiveWeeklyScrimSlots(myTeam),
      gameState.clock.current_date,
      todayContext.report.slot_index,
    )
    : null;
  const isFirstBlock = dailyBlockMeta?.blockNumber === 1;
  const resultIsBad = Boolean(todayContext.report && !todayContext.report.won);
  const decisionOptions: Array<{ id: DailyScrimAction; label: string; description: string }> = (() => {
    if (!todayContext.report) return [];
    if (isFirstBlock && resultIsBad && !showCancelFollowups) {
      return [
        { id: "PushThrough", label: "Push Through", description: "Continuar al segundo bloque con más riesgo." },
        { id: "CancelScrims", label: "Cancelar scrims", description: "Cancelar el bloque siguiente y elegir respuesta técnica." },
      ];
    }
    if (isFirstBlock && !resultIsBad) {
      return [
        { id: "ContinueToBlock2", label: "Continuar al segundo bloque", description: "Mantener el plan del día." },
        { id: "OfferRest", label: "Ofrecer descanso", description: "Cancelar bloque siguiente para recuperar." },
      ];
    }
    if (isFirstBlock && resultIsBad && showCancelFollowups) {
      return [
        { id: "VodReview", label: "VOD Review", description: "Analizar errores y ajustar plan." },
        { id: "MentalReset", label: "Mental Reset", description: "Recuperar moral/condición." },
        { id: "TargetedDrills", label: "Targeted Drills", description: "Corregir issue puntual." },
      ];
    }
    return [
      { id: "DayOff", label: "Dar resto del día libre", description: "Cerrar la jornada y priorizar recuperación." },
      { id: "VodReview", label: "VOD Review", description: "Analizar errores y ajustar plan." },
      { id: "MentalReset", label: "Mental Reset", description: "Recuperar moral/condición." },
      { id: "TargetedDrills", label: "Targeted Drills", description: "Corregir issue puntual." },
    ];
  })();
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

  const handleSetWeeklyCapacity = async (slots: number) => {
    if (setupLocked || assistantControls) return;
    setIsSaving(true);
    try {
      const updated = await setWeeklyScrimSlots(slots);
      onGameUpdate?.(updated);
    } catch (error) {
      console.error("Failed to save weekly scrim slots:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetObjective = async (nextObjective: ScrimFocus | null) => {
    if (setupLocked || assistantControls) return;
    setIsSaving(true);
    try {
      const updated = await setWeeklyScrimObjective(nextObjective);
      onGameUpdate?.(updated);
    } catch (error) {
      console.error("Failed to save weekly scrim objective:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReviewDecision = async (decision: DailyScrimAction) => {
    if (!todayContext.report) return;
    if (decision === "CancelScrims") {
      setShowCancelFollowups(true);
      setDecisionFeedback("Scrims cancelados. Elegí VOD Review, Mental Reset o Targeted Drills para cerrar el día.");
      return;
    }
    setDecisionSaving(decision);
    setDecisionFeedback(null);
    try {
      const updated = await chooseDailyScrimAction(todayContext.report.slot_index, decision);
      onGameUpdate?.(updated);
      setDecisionFeedback(t("scrims.reviewDecisionApplied", "Decisión aplicada. El staff adaptó el plan del día según tu elección."));
      setShowCancelFollowups(false);
    } catch (error) {
      console.error("Failed to choose post-scrim decision from ScrimsTab:", error);
    } finally {
      setDecisionSaving(null);
    }
  };

  const handleFinalizeSetup = async () => {
    if (setupLocked || assistantControls) return;
    setIsSaving(true);
    try {
      const updated = await finalizeWeeklyScrimSetup();
      onGameUpdate?.(updated);
    } catch (error) {
      console.error("Failed to finalize weekly scrim setup:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const staffSuggestions = buildStaffSuggestions(
    t,
    objective,
    weeklyCapacity,
    latestReports,
    weeklyContext.lossStreak,
    weeklyContext.cancellations,
    planSignals,
    weeklyContext.reputation,
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <Card accent="primary">
        <CardBody>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-heading font-bold uppercase tracking-wider text-primary-500 dark:text-primary-400">
                {t("scrims.pageKicker", "Preparacion competitiva")}
              </p>
              <h2 className="mt-1 text-3xl font-heading font-bold uppercase tracking-wide text-gray-900 dark:text-white">
                {t("dashboard.scrims", "Scrims")}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
                {t(
                  "scrims.pageDescription",
                  "Planifica rivales, controla resultados semanales y prepara el camino para negociar mejores bloques de practica.",
                )}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-navy-600 dark:bg-navy-900/50">
                <CalendarDays className="mx-auto mb-1 h-4 w-4 text-primary-500" />
                <p className="text-2xl font-heading font-bold text-gray-900 dark:text-white">
                  {plannedScrims}/{weeklyCapacity}
                </p>
                <p className="text-[10px] font-heading uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t("scrims.planned", "Planificadas")}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-navy-600 dark:bg-navy-900/50">
                <Swords className="mx-auto mb-1 h-4 w-4 text-amber-400" />
                <p className="text-2xl font-heading font-bold text-gray-900 dark:text-white">
                  {wins}-{losses}
                </p>
                <p className="text-[10px] font-heading uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t("scrims.weekRecord", "Record semanal")}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-navy-600 dark:bg-navy-900/50">
                <Gauge className="mx-auto mb-1 h-4 w-4 text-accent-500" />
                <p className="text-2xl font-heading font-bold text-gray-900 dark:text-white">
                  {weeklyContext.reputation}
                </p>
                <p className="text-[10px] font-heading uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t("scrims.reputation", "Rep scrims")}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{t("scrims.played", "Jugadas")}: {played}</span>
            <span>{t("scrims.cancellations", "Cancelaciones")}: {weeklyContext.cancellations}</span>
            {nextOfficialRivalName ? (
              <span>
                {t("scrims.nextOfficialRival", "Próximo rival oficial")}: {nextOfficialRivalName}
                {weeklyContext.nextOfficialRivalCompetition ? ` · ${weeklyContext.nextOfficialRivalCompetition}` : ""}
              </span>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            {t("scrims.weeklySetup", "Setup semanal")}
          </span>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <label className="block text-xs font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  {t("training.scrims.weeklyObjective", "Objetivo semanal")}
                </span>
              </label>
              <Select
                value={objective ?? ""}
                onChange={(event) => void handleSetObjective((event.target.value || null) as ScrimFocus | null)}
                disabled={isSaving || setupLocked || assistantControls}
                variant="muted"
                fullWidth
              >
                <option value="">{t("training.scrims.objectives.none", "Sin objetivo definido")}</option>
                {SCRIM_OBJECTIVES.map((focus) => (
                  <option key={focus} value={focus}>{scrimFocusLabel(t, focus)}</option>
                ))}
              </Select>
              <p className="text-xs text-gray-500 dark:text-gray-400">{scrimFocusImpactText(objective)}</p>
              {objective ? (
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-heading uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <span>Crecimiento principal:</span>
                  {objectiveGrowth.primary.map((tag) => (
                    <span key={`primary-${tag}`}>{tag} +</span>
                  ))}
                  <span>· Secundario:</span>
                  {objectiveGrowth.secondary.map((tag) => (
                    <span key={`secondary-${tag}`}>{tag} +</span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t("scrims.weeklyVolume", "Volumen semanal")}
              </p>
              <div className="flex flex-wrap gap-2">
                {SCRIM_SLOT_OPTIONS.map((slots) => (
                  <button
                    key={slots}
                    type="button"
                    disabled={isSaving || setupLocked || assistantControls}
                    onClick={() => void handleSetWeeklyCapacity(slots)}
                    className={`rounded-lg border px-3 py-2 text-sm font-heading font-bold uppercase tracking-wider transition-colors ${
                      weeklyCapacity === slots
                        ? "border-primary-500 bg-primary-500 text-white"
                        : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-navy-600 dark:text-gray-300 dark:hover:border-navy-500"
                    }`}
                  >
                    {slots}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-navy-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {setupLocked
                ? t("scrims.setupLocked", "Configuración semanal bloqueada hasta la próxima semana.")
                : assistantControls
                  ? "El Assistant Coach controla automáticamente scrims esta semana."
                  : t("scrims.setupUnlockWindow", "Puedes configurar objetivo, volumen y rivales antes del primer bloque de scrims de la semana.")}
            </p>
            <button
              type="button"
              disabled={isSaving || setupLocked || assistantControls}
              onClick={() => void handleFinalizeSetup()}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-heading font-bold uppercase tracking-wider text-gray-700 transition-colors hover:border-gray-300 disabled:opacity-60 dark:border-navy-600 dark:text-gray-200 dark:hover:border-navy-500"
            >
              {t("scrims.finalizeSetup", "Fijar elecciones semanales")}
            </button>
          </div>
          {staffSuggestions.length > 0 ? (
            <div className="mt-4 border-t border-gray-100 pt-3 dark:border-navy-700">
              <p className="mb-2 inline-flex items-center gap-2 text-xs font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <Lightbulb className="h-4 w-4" />
                {t("training.scrims.staffSuggestions", "Sugerencias del staff")}
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {staffSuggestions.slice(0, 2).map((suggestion) => (
                  <p key={suggestion} className="rounded-xl border border-gray-200 bg-transparent p-3 text-sm leading-relaxed text-gray-600 dark:border-navy-600 dark:text-gray-300">
                    {suggestion}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <ScrimPlanningCard
        gameState={gameState}
        weeklyContext={weeklyContext}
        onGameUpdate={onGameUpdate}
        isSaving={isSaving}
        setIsSaving={setIsSaving}
        readOnly={assistantControls || setupLocked}
      />

        </div>

        <aside className="flex flex-col gap-5 xl:sticky xl:top-4 xl:self-start">
      <Card>
        <CardHeader>Assistant Coach</CardHeader>
        <CardBody>
          <div className="rounded-xl border border-gray-200 p-3 dark:border-navy-600">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-heading font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Delegación de scrims
              </p>
              <button
                type="button"
                onClick={() => void updateSettings({ scrim_review_mode: settings.scrim_review_mode === "assistant" ? "manual" : "assistant" })}
                className={`rounded-lg border px-3 py-1 text-xs font-heading font-bold uppercase tracking-wider ${settings.scrim_review_mode === "assistant" ? "border-primary-500 bg-primary-500 text-white" : "border-gray-200 text-gray-700 dark:border-navy-600 dark:text-gray-300"}`}
              >
                {settings.scrim_review_mode === "assistant" ? "Assistant" : "Manual"}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              En modo Assistant, Continuar avanza 1 día y el staff resuelve decisiones de scrims automáticamente.
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>{t("scrims.todayBlock", "Bloque de hoy")}</CardHeader>
        <CardBody>
          <div className="rounded-lg border border-gray-200 bg-transparent p-3 text-sm text-gray-700 dark:border-navy-600 dark:text-gray-200">
            <p>
              {todayContext.state === "PlayedNeedsReview"
                ? t("scrims.todayNeedsReview", "El scrim ya se jugó y está pendiente de decisión de review.")
                : todayContext.state === "Reviewed"
                  ? t("scrims.todayReviewed", "El review de hoy ya fue aplicado. Continuá con preparación/training.")
                  : todayContext.state === "Planned"
                    ? t("scrims.todayPlanned", "Hoy hay scrim planificado. Confirmá que Plan A/B/C siga teniendo sentido.")
                    : todayContext.state === "Cancelled"
                      ? t("scrims.todayCancelled", "El bloque de scrim de hoy quedó cancelado. Priorizá recuperación o drills.")
                      : t("scrims.todayNoScrim", "Hoy no hay scrim activo. Ajustá el plan semanal con intención.")}
            </p>
            {todayOpponentName ? (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-gray-200 bg-transparent p-3 dark:border-navy-600">
                {(todayContext.resolvedOpponentTeamId ?? todayContext.opponentTeamId) ? (
                  <img
                    src={teamLogoPath((todayContext.resolvedOpponentTeamId ?? todayContext.opponentTeamId) as string)}
                    alt={`${todayOpponentName} logo`}
                    className="h-9 w-9 shrink-0 rounded-lg bg-black/20 object-contain p-1"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="text-[10px] font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {t("scrims.todayOpponent", "Rival de hoy")}
                  </p>
                  <p className="truncate font-heading text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-white">
                    {todayOpponentName}
                  </p>
                </div>
              </div>
            ) : null}
            {todayContext.state === "Planned" ? (
              <div className="mt-3 space-y-1 text-xs">
                <p>
                  {t("scrims.todayRisk", "Riesgo")}: <strong>{todayRisk}</strong>
                  {estimatedTodayGap > 0 ? ` · Gap OVR +${estimatedTodayGap}` : ""}
                  {estimatedRepGap > 0 ? ` · Gap rep +${estimatedRepGap}` : ""}
                </p>
                <p>
                  {t("scrims.todayLearning", "Valor de aprendizaje")}: <strong>{todayLearning}</strong>
                </p>
                <p>
                  {t("scrims.todayCancelCost", "Costo de cancelar")}: <strong>-{cancelCost} rep scrims</strong>
                </p>
              </div>
            ) : null}
            {(todayContext.state === "PlayedNeedsReview" || todayContext.state === "Reviewed") && todayContext.report ? (
              <div className="mt-3 rounded-lg border border-gray-200 bg-transparent p-4 text-sm dark:border-navy-600">
                <p className="font-heading text-[11px] font-bold uppercase tracking-wider text-gray-300">
                  {t("scrims.postScrimFeedback", "Feedback post-scrim")}
                </p>
                <p className="mt-1 text-gray-900 dark:text-gray-100">
                  {todayContext.report.won
                    ? t("scrims.reviewWin", {
                        team: todayOpponentName ?? todayContext.report.opponent_team_id,
                        defaultValue: "Victoria vs {{team}}",
                      })
                    : t("scrims.reviewLoss", {
                        team: todayOpponentName ?? todayContext.report.opponent_team_id,
                        defaultValue: "Derrota vs {{team}}",
                      })}
                  {` · ${t("scrims.reportQuality", "Calidad")}: ${todayContext.report.quality}`}
                </p>
                <p className="mt-1 text-gray-900 dark:text-gray-100">
                  {t("scrims.reportFocus", "Foco")}: {todayContext.report.focus}
                  {todayContext.report.issue ? ` · ${t("scrims.detectedIssue", "Problema detectado")}: ${todayContext.report.issue}` : ""}
                </p>
                {todayContext.state === "PlayedNeedsReview" && reviewPhaseActive ? (
                  <p className="mt-2 text-gray-600 dark:text-gray-300">
                    {t("scrims.postScrimNextActionReview", "Siguiente acción: elegí una decisión de review en Home para convertir este bloque en progreso concreto.")}
                  </p>
                ) : (
                  <p className="mt-2 text-gray-600 dark:text-gray-300">
                    {t("scrims.postScrimNextActionContinue", "Review ya aplicado: usá este feedback para ajustar rival y enfoque del próximo bloque.")}
                  </p>
                )}
                {todayContext.state === "PlayedNeedsReview" && reviewPhaseActive ? (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {isFirstBlock
                      ? showCancelFollowups
                        ? "Bloque 1/2: ahora elegí respuesta técnica para cerrar el día."
                        : "Bloque 1/2: primero decidí si seguís con presión o cancelás scrims."
                      : "Bloque 2/2: cerrá el día con recuperación o trabajo dirigido."}
                  </p>
                ) : null}
                {todayContext.state === "PlayedNeedsReview" && reviewPhaseActive ? (
                  <div className="mt-3 grid gap-3">
                    {decisionOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        disabled={decisionSaving !== null}
                        onClick={() => void handleReviewDecision(option.id)}
                      className="rounded-xl border-2 border-gray-200 bg-transparent p-4 text-left transition-all hover:border-gray-300 disabled:opacity-60 dark:border-navy-600 dark:hover:border-navy-500"
                      >
                        <span className="block font-heading text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                          {decisionSaving === option.id ? t("common.saving", "Guardando") : option.label}
                        </span>
                        <span className="mt-1 block text-xs leading-snug text-gray-500 dark:text-gray-400">{option.description}</span>
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
                ) : null}
                {decisionFeedback ? (
                  <p className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-gray-700 dark:border-navy-600 dark:bg-navy-800/40 dark:text-gray-300">
                    {decisionFeedback}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>{t("scrims.weeklyReportInline", "Resumen semanal")}</CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t("scrims.recentReports", "Reportes recientes")}
              </p>
              {latestReports.length > 0 ? (
                <div className="space-y-2">
                  {latestReports.map((report) => (
                    <div
                      key={`${report.week_key}-${report.slot_index}`}
                      className="rounded-xl border border-gray-200 bg-transparent p-3 dark:border-navy-600"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <img
                            src={teamLogoPath(report.opponent_team_id)}
                            alt={`${teamNameById.get(report.opponent_team_id) ?? report.opponent_team_id} logo`}
                            className="h-7 w-7 shrink-0 rounded bg-black/20 object-contain p-1"
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                          <p className="truncate font-heading text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                            {teamNameById.get(report.opponent_team_id) ?? report.opponent_team_id}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          {report.won ? "W" : "L"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                        {t("scrims.reportFocus", "Foco")}: {report.focus} · {t("scrims.reportQuality", "Calidad")}: {report.quality}
                      </p>
                      {report.issue ? (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {t("scrims.detectedIssue", "Problema detectado")}: {report.issue}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("scrims.noRecentReports", "Todavía no hay reportes esta semana.")}</p>
              )}
            </div>
            <div className="rounded-xl border border-gray-200 bg-transparent p-3 dark:border-navy-600">
              {weeklyContext.avgQuality > 0 ? (
                <>
                  <p className="font-heading text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {weeklyOutcome}
                  </p>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">
                    {t("training.scrims.weeklyObjective", "Objetivo semanal")}: <strong>{weeklyContext.objective ?? t("training.scrims.objectives.none", "Sin objetivo definido")}</strong>
                  </p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                    {wins}-{losses} · {t("scrims.played", "Jugadas")}: {played} · {t("scrims.reportQuality", "Calidad")}: {weeklyContext.avgQuality}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-[10px] font-heading uppercase tracking-wider text-gray-500 dark:text-gray-400">{weeklyMainGain}</span>
                    <span className="text-[10px] font-heading uppercase tracking-wider text-gray-500 dark:text-gray-400">{weeklyMainFailure}</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("scrims.noWeeklyReportYet", "Completá scrims para generar el resumen semanal.")}</p>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
        </aside>
      </div>
    </div>
  );
}
