import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { TeamProfileProps } from "@/ui-v2/_legacy/components/teamProfile/TeamProfile.types";
import TeamProfileClubDetailsCard from "@/ui-v2/_legacy/components/teamProfile/TeamProfileClubDetailsCard";
import TeamProfileHeroCard from "@/ui-v2/_legacy/components/teamProfile/TeamProfileHeroCard";
import TeamProfileHistoryCard from "@/ui-v2/_legacy/components/teamProfile/TeamProfileHistoryCard";
import TeamProfileLeagueStandingCard from "@/ui-v2/_legacy/components/teamProfile/TeamProfileLeagueStandingCard";
import TeamProfileRecentMatchesCard from "@/ui-v2/_legacy/components/teamProfile/TeamProfileRecentMatchesCard";
import TeamProfileRosterCard from "@/ui-v2/_legacy/components/teamProfile/TeamProfileRosterCard";
import TeamProfileSummaryCard from "@/ui-v2/_legacy/components/teamProfile/TeamProfileSummaryCard";
import { useTeamProfileStats } from "@/ui-v2/_legacy/components/teamProfile/useTeamProfileStats";
import { buildTeamProfileViewModel } from "@/ui-v2/_legacy/components/teamProfile/TeamProfile.viewModel";

export default function TeamProfile({
  team,
  gameState,
  isOwnTeam,
  onClose,
  onSelectPlayer,
}: TeamProfileProps) {
  const { t, i18n } = useTranslation();
  const viewModel = buildTeamProfileViewModel(team, gameState);
  const { recentMatches } = useTeamProfileStats(team.id);

  return (
    <div className="w-[92%] max-w-[2000px] mx-auto">
      <button
        onClick={onClose}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="font-heading font-bold uppercase tracking-wider">
          {t("common.back")}
        </span>
      </button>

      <TeamProfileHeroCard
        team={team}
        viewModel={viewModel}
        locale={i18n.language}
        t={t}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <TeamProfileClubDetailsCard
          team={team}
          rosterSize={viewModel.roster.length}
          t={t}
        />
        <TeamProfileSummaryCard
          team={team}
          isOwnTeam={isOwnTeam}
          viewModel={viewModel}
          t={t}
        />
        <TeamProfileLeagueStandingCard standings={viewModel.standings} t={t} />

        <TeamProfileRecentMatchesCard matches={recentMatches} t={t} />

        <TeamProfileRosterCard
          roster={viewModel.roster}
          currentDate={gameState.clock.current_date}
          isOwnTeam={isOwnTeam}
          locale={i18n.language}
          t={t}
          onSelectPlayer={onSelectPlayer}
        />
        <TeamProfileHistoryCard history={team.history} t={t} />
      </div>
    </div>
  );
}

