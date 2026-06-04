import { useEffect, useState, type ReactNode } from "react";
import { EyeOff, Pencil, Shield, User } from "lucide-react";
import type { PlayerData } from "../../store/gameStore";
import { formatPlayerMarketValue, formatPlayerWage } from "./PlayerProfile.helpers";
import { resolvePlayerPhoto } from "../../lib/playerPhotos";
import { resolveTeamLogo } from "../../lib/teamLogos";
import type {
  PlayerProfileScoutStatus,
  ScoutAvailability,
} from "./PlayerProfile.scouting";
import PlayerProfileScoutAction from "./PlayerProfileScoutAction";
import { CountryFlag, RoleBadge, Card } from "../ui";

type TranslateFn = (
  key: string,
  options?: Record<string, string | number>,
) => string;

interface PlayerProfileHeroCardProps {
  player: PlayerData;
  ovr: number;
  primaryRole?: "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";
  /** @deprecated Legacy prop name kept for older focused tests. */
  primaryPosition?: string;
  age: number;
  teamName: string;
  annualSuffix: string;
  language: string;
  isOwnClub: boolean;
  scoutAvailability: ScoutAvailability;
  scoutStatus: PlayerProfileScoutStatus;
  scoutError: string | null;
  onScout: () => void;
  onRerollRole?: (role: "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT") => void;
  rerollingRole?: boolean;
  insigniaChampionId?: string | null;
  onSelectTeam?: (id: string) => void;
  onStartPotentialResearch?: () => void;
  potentialResearchSubmitting?: boolean;
  isPotentialResearchBlockedByOther?: boolean;
  academyActionLabel?: string | null;
  academyActionLoading?: boolean;
  onAcademyAction?: (() => void) | null;
  t: TranslateFn;
  teamLogoUrl?: string | null;
}

export default function PlayerProfileHeroCard({
  player,
  ovr,
  primaryRole = "MID",
  age,
  teamName,
  annualSuffix,
  isOwnClub,
  scoutAvailability,
  scoutStatus,
  scoutError,
  onScout,
  onRerollRole,
  rerollingRole = false,
  insigniaChampionId = null,
  onSelectTeam,
  onStartPotentialResearch,
  potentialResearchSubmitting = false,
  isPotentialResearchBlockedByOther = false,
  academyActionLabel = null,
  academyActionLoading = false,
  onAcademyAction = null,
  t,
  language = "en",
  teamLogoUrl,
}: PlayerProfileHeroCardProps) {
  const role = primaryRole;
  const playerPhoto = resolvePlayerPhoto(player.id, player.match_name, player.profile_image_url);
  const [insigniaBackground, setInsigniaBackground] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState(false);
  const potentialRevealed = player.potential_revealed ?? null;
  const potentialEta = player.potential_research_eta_days ?? null;
  const potentialActive = potentialEta !== null && potentialEta > 0;
  const potentialProgress = potentialActive ? 7 - potentialEta : 0;
  const canStartPotentialResearch =
    isOwnClub &&
    !potentialActive &&
    potentialRevealed === null &&
    !isPotentialResearchBlockedByOther &&
    Boolean(onStartPotentialResearch) &&
    !potentialResearchSubmitting;
  const potentialValueLabel =
    potentialRevealed !== null ? String(potentialRevealed) : "??";

  useEffect(() => {
    if (!insigniaChampionId) {
      setInsigniaBackground(null);
      return;
    }

    // Always use skin 0 from local splash path
    setInsigniaBackground(`/champion-splash/${insigniaChampionId}.webp`);
  }, [insigniaChampionId]);

  return (
    <Card accent="primary" className="mb-5">
      <div className="relative p-8 rounded-t-xl overflow-hidden">
        {insigniaBackground ? (
          <>
            <div className="absolute inset-0 bg-cover opacity-100" style={{ backgroundImage: `url(${insigniaBackground})`, backgroundPosition: "center 12%" }} />
            <div className="absolute inset-0 bg-linear-to-r from-black/88 via-black/28 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-linear-to-r from-navy-700 to-navy-800" />
        )}

        <div className="relative z-10 flex items-start gap-6">
          <div className="relative w-24 h-24 shrink-0">
            <div
              className={`w-24 h-24 rounded-2xl overflow-hidden border-2 ${
                ovr >= 75
                  ? "border-primary-500/40"
                  : ovr >= 55
                    ? "border-accent-500/40"
                    : "border-gray-500/40"
              }`}
            >
              {playerPhoto ? (
                <img
                  src={playerPhoto}
                  alt={player.match_name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-navy-700 flex items-center justify-center text-gray-400">
                  <User className="w-10 h-10" />
                </div>
              )}
            </div>
            <div className="absolute -bottom-3 right-0 bg-navy-900 border border-navy-500 rounded-lg px-2 py-1 font-heading font-bold text-lg text-accent-300 leading-none">
              {ovr}
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-heading font-bold text-white uppercase tracking-wide">
                {player.match_name}
              </h2>
              {player.nationality && (
                <CountryFlag
                  code={player.nationality}
                  locale={language}
                  className="w-6 h-4 rounded-sm shadow-sm"
                />
              )}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <RoleBadge role={role} size="sm" />
              {isOwnClub && academyActionLabel && onAcademyAction ? (
                <button
                  type="button"
                  onClick={onAcademyAction}
                  disabled={academyActionLoading}
                  className={`px-2.5 py-1 rounded-md text-xs font-heading font-bold uppercase tracking-wide border transition-colors ${
                    academyActionLoading
                      ? "bg-gray-600/30 border-gray-500 text-gray-300 cursor-wait"
                      : "bg-primary-500/20 border-primary-400 text-primary-200 hover:bg-primary-500/30"
                  }`}
                >
                  {academyActionLoading ? "Procesando..." : academyActionLabel}
                </button>
              ) : null}
              {isOwnClub ? (
                <button
                  type="button"
                  onClick={() => setEditingRole((prev) => !prev)}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-white/15 text-gray-200 hover:text-primary-300 hover:border-primary-400/60 transition-colors"
                  title={t("playerProfile.editPosition", { defaultValue: "Cambiar posición" })}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              ) : null}
              <span className="text-gray-400 text-sm">
                {t("common.age")} {age}
              </span>
            </div>

            {isOwnClub && editingRole ? (
              <div className="mt-3 rounded-lg border border-amber-300/30 bg-amber-500/10 p-3 max-w-xl">
                <p className="text-xs text-amber-200 mb-2">
                  {t("playerProfile.rerollWarning", {
                    defaultValue:
                      "Cambiar posición hace un reroll y puede modificar el OVR del jugador.",
                  })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"] as const).map((candidateRole) => (
                    <button
                      key={candidateRole}
                      type="button"
                      disabled={rerollingRole}
                      onClick={() => {
                        if (!onRerollRole) return;
                        onRerollRole(candidateRole);
                        setEditingRole(false);
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-heading font-bold uppercase tracking-wide border transition-colors ${
                        candidateRole === role
                          ? "bg-primary-500/15 border-primary-400 text-primary-300"
                          : "bg-white/5 border-white/15 text-gray-200 hover:border-primary-400/60"
                      } ${rerollingRole ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      {candidateRole}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <p className="text-gray-400 text-sm mt-2 flex items-center gap-1.5">
              {(() => {
                const logoUrl = teamLogoUrl || resolveTeamLogo(teamName);
                return logoUrl ? (
                  <img src={logoUrl} alt={teamName} className="w-4 h-4 object-contain" />
                ) : (
                  <Shield className="w-4 h-4" />
                );
              })()}
              {player.team_id ? (
                <button
                  onClick={() => onSelectTeam?.(player.team_id!)}
                  className="hover:text-primary-400 transition-colors underline underline-offset-2"
                >
                  {teamName}
                </button>
              ) : (
                <span>{teamName}</span>
              )}
            </p>

            {isOwnClub ? (
              <div className="mt-3 inline-flex items-center gap-3 rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-gray-200">
                <span className="font-heading font-bold uppercase tracking-wider text-gray-400">
                  {t("common.potential", { defaultValue: "Potencial" })}
                </span>
                <span className="font-heading font-bold text-accent-300">{potentialValueLabel}</span>
                {potentialActive ? (
                  <span className="text-xs text-gray-300">
                    {t("playerProfile.potentialResearchProgress", {
                      defaultValue: `Investigando… ${potentialProgress}/7`,
                      current: potentialProgress,
                      total: 7,
                    })}
                  </span>
                ) : canStartPotentialResearch ? (
                  <button
                    type="button"
                    onClick={onStartPotentialResearch}
                    disabled={potentialResearchSubmitting}
                    className="rounded-md border border-primary-400/60 px-2 py-1 text-xs font-heading font-bold uppercase tracking-wide text-primary-200 hover:bg-primary-500/20 disabled:opacity-60"
                  >
                    {t("playerProfile.startPotentialResearch", { defaultValue: "Investigar potencial" })}
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="mt-3">
              <PlayerProfileScoutAction
                availability={scoutAvailability}
                scoutStatus={scoutStatus}
                scoutError={scoutError}
                onScout={onScout}
              />
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <div className="grid grid-cols-4 gap-3 flex-1">
              <QuickStat
                label={t("common.ovr")}
                value={String(ovr)}
                color="text-accent-300"
              />
              <QuickStat
                label={t("common.condition", { defaultValue: "Condition" })}
                value={`${player.condition}%`}
                color={player.condition >= 70 ? "text-primary-400" : "text-red-400"}
              />
              <QuickStat
                label={t("common.fitness")}
                value={`${player.fitness ?? 75}%`}
                color={player.fitness != null && player.fitness >= 70 ? "text-green-400" : "text-red-400"}
              />
              <QuickStat
                label={t("common.morale")}
                value={`${player.morale}%`}
                color={player.morale >= 70 ? "text-primary-400" : "text-accent-400"}
              />
              <QuickStat
                label={t("common.potential", { defaultValue: "Potencial" })}
                value={potentialRevealed !== null ? String(potentialRevealed) : "—"}
                color="text-gray-200"
                icon={potentialRevealed === null ? <EyeOff className="w-4 h-4" /> : undefined}
              />
              <QuickStat
                label={t("common.value")}
                value={formatPlayerMarketValue(player.market_value)}
                color="text-white"
              />
              <QuickStat
                label={t("common.wage")}
                value={formatPlayerWage(player.wage, annualSuffix)}
                color="text-white"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px bg-gray-200 dark:bg-navy-600 md:hidden">
        <MobileQuickStat
          label={t("common.ovr")}
          value={String(ovr)}
          color="text-accent-500"
        />
        <MobileQuickStat
          label={t("common.condition", { defaultValue: "Energía" })}
          value={`${player.condition}%`}
          color={player.condition >= 70 ? "text-primary-500" : "text-red-500"}
        />
        <MobileQuickStat
          label={t("common.fitness")}
          value={`${player.fitness ?? 75}%`}
          color={player.fitness != null && player.fitness >= 70 ? "text-green-500" : "text-red-500"}
        />
        <MobileQuickStat
          label={t("common.morale")}
          value={`${player.morale}%`}
          color={player.morale >= 70 ? "text-primary-500" : "text-accent-500"}
        />
        <MobileQuickStat
          label={t("common.potential", { defaultValue: "Potencial" })}
          value={potentialRevealed !== null ? String(potentialRevealed) : "—"}
          color="text-gray-700 dark:text-gray-200"
          icon={potentialRevealed === null ? <EyeOff className="w-4 h-4" /> : undefined}
        />
        <MobileQuickStat
          label={t("common.value")}
          value={formatPlayerMarketValue(player.market_value)}
          color="text-gray-700 dark:text-gray-200"
        />
        <MobileQuickStat
          label={t("common.wage")}
          value={formatPlayerWage(player.wage, annualSuffix)}
          color="text-gray-700 dark:text-gray-200"
        />
      </div>
    </Card>
  );
}

// NOTE: getChampionSplashPath was replaced by direct `/champion-splash/{id}.webp` path.
// All skin randomization logic removed per design decision (skin 0 always).

function QuickStat({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  icon?: ReactNode;
}) {
  return (
    <div className="bg-black/42 border border-white/20 rounded-xl px-5 py-3 text-center min-w-25 backdrop-blur-xs">
      <p className="text-xs text-gray-400 font-heading uppercase tracking-wider">
        {label}
      </p>
      <p className={`font-heading font-bold text-xl mt-0.5 ${color} inline-flex items-center gap-1 justify-center`}>
        {icon ?? value}
      </p>
    </div>
  );
}

function MobileQuickStat({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  icon?: ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-navy-800 p-3 text-center">
      <p className="text-xs text-gray-400 dark:text-gray-500 font-heading uppercase tracking-wider">
        {label}
      </p>
      <p className={`font-heading font-bold text-lg mt-0.5 ${color} inline-flex items-center gap-1 justify-center`}>
        {icon ?? value}
      </p>
    </div>
  );
}
