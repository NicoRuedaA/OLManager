import { useEffect, useState } from "react";
import { EyeOff, Repeat, Search, Shield, ShoppingCart, User } from "lucide-react";
import type { PlayerData } from "@/store/gameStore";
import { formatPlayerMarketValue, formatPlayerWage } from "@/lib/playerProfile/helpers";
import { resolvePlayerPhoto } from "@/lib/players/playerPhotos";
import { resolveTeamLogo } from "@/lib/teams/teamLogos";
import type { PlayerProfileScoutStatus, ScoutAvailability } from "@/lib/playerProfile/scouting";
import PlayerProfileScoutAction from "@/ui-v2/_legacy/components/playerProfile/PlayerProfileScoutAction";
import { CountryFlag } from "@/ui-v2/_legacy/components/ui/CountryFlag";
import { Card, CardContent } from "@/ui-v2/components/ui/card";
import { cn } from "@/ui-v2/lib/utils";
import { ROLE_ICON_PATHS } from "@/lib/players/roleIcons";
import { SOLOQ_EMBLEM_URLS, type SoloQTier } from "@/lib/players/soloq";

type UiRole = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";

interface PlayerProfileHeroCardV2Props {
  player: PlayerData;
  ovr: number;
  primaryRole?: UiRole;
  age: number;
  teamName: string;
  annualSuffix: string;
  language: string;
  isOwnClub: boolean;
  scoutAvailability: ScoutAvailability;
  scoutStatus: PlayerProfileScoutStatus;
  scoutError: string | null;
  onScout: () => void;
  insigniaChampionId?: string | null;
  onSelectTeam?: (id: string) => void;
  onStartPotentialResearch?: () => void;
  potentialResearchSubmitting?: boolean;
  isPotentialResearchBlockedByOther?: boolean;
  academyActionLabel?: string | null;
  academyActionLoading?: boolean;
  onAcademyAction?: (() => void) | null;
  onToggleTransferList?: () => void;
  onToggleLoanList?: () => void;
  t: (key: string, options?: Record<string, string | number>) => string;
  teamLogoUrl?: string | null;
  soloqTier?: SoloQTier;
}

export default function PlayerProfileHeroCardV2({
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
  insigniaChampionId = null,
  onSelectTeam,
  onStartPotentialResearch,
  potentialResearchSubmitting = false,
  isPotentialResearchBlockedByOther = false,
  academyActionLabel = null,
  academyActionLoading = false,
  onAcademyAction = null,
  onToggleTransferList,
  onToggleLoanList,
  t,
  language = "en",
  teamLogoUrl,
  soloqTier,
}: PlayerProfileHeroCardV2Props) {
  const role = primaryRole;
  const playerPhoto = resolvePlayerPhoto(player.id, player.match_name, player.profile_image_url);
  const [insigniaBackground, setInsigniaBackground] = useState<string | null>(null);
  const potentialRevealed = player.potential_revealed ?? null;
  const potentialEta = player.potential_research_eta_days ?? null;
  const potentialActive = potentialEta !== null && potentialEta > 0;
  const potentialProgress = potentialActive ? 7 - potentialEta : 0;
  const canStartPotentialResearch = isOwnClub && !potentialActive && potentialRevealed === null && !isPotentialResearchBlockedByOther && Boolean(onStartPotentialResearch) && !potentialResearchSubmitting;
  const potentialValueLabel = potentialRevealed !== null ? String(potentialRevealed) : "??";

  useEffect(() => {
    if (!insigniaChampionId) { setInsigniaBackground(null); return; }
    setInsigniaBackground(`/champion-splash/${insigniaChampionId}.webp`);
  }, [insigniaChampionId]);

  return (
    <Card className="overflow-hidden">
      <div className="relative">
        {insigniaBackground ? (
          <>
            <div className="absolute inset-0 bg-cover" style={{ backgroundImage: `url(${insigniaBackground})`, backgroundPosition: "center 12%" }} />
            <div className="absolute inset-0 bg-linear-to-r from-black/88 via-black/28 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-linear-to-r from-muted/80 to-muted/40" />
        )}

        <CardContent className="relative z-10 flex flex-col gap-5 p-5 md:flex-row md:items-center">
          {/* Left: photo + ovr */}
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div className="relative">
              <div className={cn("size-24 overflow-hidden rounded-2xl border-2", ovr >= 75 ? "border-primary/40" : "border-border/40")}>
                {playerPhoto ? (
                  <img src={playerPhoto} alt={player.match_name} className="size-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex size-full items-center justify-center bg-muted text-muted-foreground/70">
                    <User className="size-10" />
                  </div>
                )}
                {soloqTier && soloqTier !== "Unranked" && (
                  <div className="absolute -bottom-2 -left-2 size-9 drop-shadow-lg">
                    <img
                      src={SOLOQ_EMBLEM_URLS[soloqTier]}
                      alt={soloqTier}
                      className="size-full object-contain"
                    />
                  </div>
                )}
              </div>
              <div className="absolute -bottom-2 right-0 rounded-lg border border-border bg-card px-2 py-0.5 font-heading text-lg font-bold leading-none text-primary">
                {ovr}
              </div>
            </div>
            {isOwnClub && academyActionLabel && onAcademyAction && (
              <button
                type="button"
                onClick={onAcademyAction}
                disabled={academyActionLoading}
                className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-heading font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
              >
                {academyActionLoading ? "..." : academyActionLabel}
              </button>
            )}
          </div>

          {/* Center: name + details */}
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-heading text-3xl font-bold uppercase tracking-wide text-white">
                {player.match_name}
              </h2>
              {player.nationality && (
                <CountryFlag code={player.nationality} locale={language} className="size-5 rounded-sm shadow-sm" />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <img src={ROLE_ICON_PATHS[role]} alt={role} className="size-5 object-contain" title={role} />
              {player.alternate_positions && player.alternate_positions.length > 0 && player.alternate_positions.map((altRole) => (
                <img key={altRole} src={ROLE_ICON_PATHS[altRole as keyof typeof ROLE_ICON_PATHS] ?? ""} alt={altRole} className="size-5 object-contain opacity-40" title={altRole} />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground/70">
              <span className="flex items-center gap-1">
                {(() => {
                  const logoUrl = teamLogoUrl || resolveTeamLogo(teamName);
                  return logoUrl ? <img src={logoUrl} alt="" className="size-4 object-contain" /> : <Shield className="size-4" />;
                })()}
                {player.team_id ? (
                  <button onClick={() => onSelectTeam?.(player.team_id!)} className="hover:text-primary transition-colors underline underline-offset-2">{teamName}</button>
                ) : (
                  <span>{teamName}</span>
                )}
              </span>
            </div>

            {isOwnClub && (
              <div className="inline-flex w-fit items-center gap-3 rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm">
                <span className="font-heading font-bold uppercase tracking-wider text-muted-foreground/70">{t("common.potential")}</span>
                <span className="font-heading font-bold text-primary">{potentialValueLabel}</span>
                {potentialActive ? (
                  <span className="text-xs text-muted-foreground/80">{t("playerProfile.potentialResearchProgress", { current: potentialProgress, total: 7 })}</span>
                ) : canStartPotentialResearch ? (
                  <button type="button" onClick={onStartPotentialResearch} disabled={potentialResearchSubmitting}
                    className="rounded-md border border-primary/60 p-1.5 text-primary/80 hover:bg-primary/20 disabled:opacity-60"
                    title={t("playerProfile.startPotentialResearch")}
                  >
                    <Search className="size-3.5" />
                  </button>
                ) : null}
                <span className="text-border">|</span>
                <button type="button" onClick={onToggleTransferList} disabled={!onToggleTransferList}
                  className={cn("flex size-7 items-center justify-center rounded-md border transition-colors",
                    player.transfer_listed
                      ? "border-red-500/30 bg-red-500/10 text-red-400"
                      : "border-border text-muted-foreground/50 hover:border-red-500/30 hover:text-red-400"
                  )}
                  title={t("squad.addToTransferList", { defaultValue: "Add to transfer list" })}
                >
                  <ShoppingCart className="size-3.5" />
                </button>
                <button type="button" onClick={onToggleLoanList} disabled={!onToggleLoanList}
                  className={cn("flex size-7 items-center justify-center rounded-md border transition-colors",
                    player.loan_listed
                      ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                      : "border-border text-muted-foreground/50 hover:border-blue-500/30 hover:text-blue-400"
                  )}
                  title={t("squad.addToLoanList", { defaultValue: "Add to loan list" })}
                >
                  <Repeat className="size-3.5" />
                </button>
              </div>
            )}

            <PlayerProfileScoutAction availability={scoutAvailability} scoutStatus={scoutStatus} scoutError={scoutError} onScout={onScout} />
          </div>

          {/* Right: quick stats */}
          <div className="hidden md:block">
             <div className="grid grid-cols-4 gap-2">
              <QuickStatV2 label={t("common.ovr")} value={String(ovr)} color="text-primary" />
              <QuickStatV2 label={t("common.condition")} value={`${player.condition}%`} color={player.condition >= 70 ? "text-emerald-400" : "text-red-400"} />
              <QuickStatV2 label={t("common.fitness")} value={`${player.fitness ?? 75}%`} color={player.fitness != null && player.fitness >= 70 ? "text-emerald-400" : "text-red-400"} />
              <QuickStatV2 label={t("common.morale")} value={`${player.morale}%`} color={player.morale >= 70 ? "text-primary" : "text-red-400"} />
              <QuickStatV2 label={t("common.potential")} value={potentialValueLabel} color="text-foreground/90" icon={potentialRevealed === null ? <EyeOff className="size-4" /> : undefined} />
              <QuickStatV2 label={t("common.value")} value={formatPlayerMarketValue(player.market_value)} color="text-foreground" />
              <QuickStatV2 label={t("common.wage")} value={formatPlayerWage(player.wage, annualSuffix)} color="text-foreground" />
              <QuickStatV2 label={t("common.age")} value={String(age)} color="text-foreground" />
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

function QuickStatV2({ label, value, color, icon }: { label: string; value: string; color: string; icon?: React.ReactNode }) {
  return (
    <div className="min-w-20 rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-center backdrop-blur-xs">
      <p className="font-heading text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</p>
      <p className={cn("mt-0.5 inline-flex items-center justify-center gap-1 font-heading text-lg font-bold", color)}>
        {icon ?? value}
      </p>
    </div>
  );
}
