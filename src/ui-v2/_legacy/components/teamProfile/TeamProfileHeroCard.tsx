import { Calendar, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Card, TeamLocation } from "@/ui-v2/_legacy/components/ui";
import type { TeamProfileTranslate } from "@/ui-v2/_legacy/components/teamProfile/TeamProfile.types";
import { QuickStat } from "@/ui-v2/_legacy/components/teamProfile/TeamProfile.primitives";
import type { TeamProfileViewModel } from "@/ui-v2/_legacy/components/teamProfile/TeamProfile.types";
import type { TeamData } from "@/store/gameStore";
import { resolveTeamLogo } from "@/lib/teams/teamLogos";

function defaultTeamLogoSrc(teamId: string): string {
  const slug = teamId.replace(/^lec-/, "");
  if (slug === "shifters") {
    return "/teams-icons/shifters.webp";
  }
  return `/teams-icons/${slug}.webp`;
}

function academyLogoFromMetadata(team: TeamData): string | null {
  const academy = team.academy as
    | {
        branding?: { current_logo_url?: string | null };
        acquisition?: { original_logo_url?: string | null };
        source_identity?: { original_logo_url?: string | null };
        current_logo_url?: string | null;
        original_logo_url?: string | null;
      }
    | null
    | undefined;

  return (
    academy?.branding?.current_logo_url ??
    academy?.acquisition?.original_logo_url ??
    academy?.source_identity?.original_logo_url ??
    academy?.current_logo_url ??
    academy?.original_logo_url ??
    null
  );
}

function teamLogoSrc(team: TeamData): string {
  // Use logo_url from backend if available (already mapped to /teams-icons/)
  if (team.logo_url) return team.logo_url;

  const academyLogo = academyLogoFromMetadata(team);
  if (academyLogo) {
    return academyLogo;
  }

  if (team.team_kind === "Academy") {
    const exampleLogo = resolveTeamLogo(team.name);
    if (exampleLogo) {
      return exampleLogo;
    }
  }

  return defaultTeamLogoSrc(team.id);
}

interface TeamProfileHeroCardProps {
  team: TeamData;
  viewModel: TeamProfileViewModel;
  locale: string;
  t: TeamProfileTranslate;
}

export default function TeamProfileHeroCard({
  team,
  viewModel,
  locale,
  t,
}: TeamProfileHeroCardProps) {
  const fallbackLogoSrc = useMemo(() => defaultTeamLogoSrc(team.id), [team.id]);
  const [logoSrc, setLogoSrc] = useState(() => teamLogoSrc(team));

  useEffect(() => {
    setLogoSrc(teamLogoSrc(team));
  }, [
    team.id,
    team.name,
    team.team_kind,
    team.academy?.branding?.current_logo_url,
    team.academy?.acquisition?.original_logo_url,
    team.academy?.source_identity?.original_logo_url,
    (team.academy as { current_logo_url?: string | null } | null | undefined)
      ?.current_logo_url,
    (team.academy as { original_logo_url?: string | null } | null | undefined)
      ?.original_logo_url,
  ]);

  return (
    <>
      <style>{`@keyframes breathe { 0%,100% { background-position: 0% 0%; } 50% { background-position: 6% 3%; } }`}</style>
      <Card className="mb-5 overflow-hidden">
      <div
        className="p-8 relative overflow-hidden"
        style={{
          animation: "breathe 12s ease-in-out infinite",
          background: `
            radial-gradient(ellipse 140% 80% at 15% 40%, ${team.colors.primary}99 0%, transparent 70%),
            linear-gradient(135deg, ${team.colors.primary}, ${team.colors.secondary}40)
          `,
          backgroundSize: "105% 105%",
        }}
      >
        <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`, backgroundSize: '256px 256px' }} />
        <div className="flex items-start gap-6">
          <div
            className="w-24 h-24 rounded-2xl flex items-center justify-center font-heading font-bold text-3xl text-white border-2 border-white/30"
            style={{ backgroundColor: team.colors.primary }}
          >
            {logoSrc ? (
              <img
                src={logoSrc}
                alt={`${team.name} logo`}
                className="w-16 h-16 object-contain [filter:drop-shadow(0_4px_6px_rgba(0,0,0,0.8))]"
                loading="lazy"
                onError={() => {
                  if (logoSrc !== fallbackLogoSrc) {
                    setLogoSrc(fallbackLogoSrc);
                    return;
                  }
                  setLogoSrc("");
                }}
              />
            ) : (
              <span className="text-sm font-bold tracking-wide uppercase">
                {team.short_name}
              </span>
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-3xl font-heading font-bold text-white uppercase tracking-wide drop-shadow">
              {team.name}
            </h2>
            <div className="flex items-center gap-4 mt-2 text-white/80 text-sm">
              <TeamLocation
                city={team.city}
                countryCode={team.country}
                locale={locale}
                className="text-white/80"
              />
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> {t("teams.est")} {team.founded_year}
              </span>
            </div>
            {team.competition_id && (
              <div className="flex items-center gap-1.5 mt-1 text-white/80 text-sm">
                <img
                  src={`/competitions-icons/${team.competition_id}.webp`}
                  alt={team.competition_id}
                  className="w-4 h-4 object-contain"
                />
                {team.competition_id.toUpperCase()}
              </div>
            )}
            {viewModel.manager && (
              <p className="text-white/70 text-sm mt-1 flex items-center gap-1.5">
                <Users className="w-4 h-4" /> {t("teamProfile.managerLabel")} {viewModel.manager.first_name} {viewModel.manager.last_name}
              </p>
            )}
          </div>

          <div className="hidden md:grid grid-cols-2 gap-3">
            <QuickHeroStat label={t("teams.avgOvr")} value={String(viewModel.avgOvr)} />
            <QuickHeroStat
              label={t("manager.reputation")}
              value={String(team.reputation)}
              valueClassName="text-accent-300"
            />
            <QuickHeroStat
              label={t("teamProfile.leaguePos")}
              value={viewModel.leaguePos > 0 ? `#${viewModel.leaguePos}` : "—"}
            />
            <QuickHeroStat
              label={t("teams.squad")}
              value={String(viewModel.roster.length)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-px bg-muted md:hidden">
        <QuickStat
          label={t("teams.avgOvr")}
          value={String(viewModel.avgOvr)}
          color="text-primary"
        />
        <QuickStat
          label={t("teams.rep")}
          value={String(team.reputation)}
          color="text-primary"
        />
        <QuickStat
          label={t("common.position")}
          value={viewModel.leaguePos > 0 ? `#${viewModel.leaguePos}` : "—"}
          color="text-foreground/90"
        />
        <QuickStat
          label={t("teams.squad")}
          value={String(viewModel.roster.length)}
          color="text-foreground/90"
        />
      </div>
    </Card>
    </>
  );
}

function QuickHeroStat({
  label,
  value,
  valueClassName = "text-white",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="bg-black/20 backdrop-blur rounded-xl px-5 py-3 text-center min-w-[100px]">
      <p className="text-xs text-white/60 font-heading uppercase tracking-wider">
        {label}
      </p>
      <p className={`font-heading font-bold text-2xl mt-0.5 ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}



