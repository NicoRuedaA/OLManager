import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GraduationCap, ScanSearch } from "lucide-react";

import type { GameStateData } from "@/store/gameStore";
import { sendScout } from "@/services/scoutingService";
import { resolveTeamLogo } from "@/lib/teams/teamLogos";
import { calculateAvailableScouts, scoutMaxSlots } from "@/components/scouting/ScoutingTab.helpers";
import { buildAlreadyScoutingIds, filterScoutablePlayers, paginateScoutablePlayers } from "@/components/scouting/ScoutingTab.model";
import ScoutingOverviewCards from "@/components/scouting/ScoutingOverviewCards";
import ScoutingAssignmentsList from "@/components/scouting/ScoutingAssignmentsList";
import ScoutingScoutDetailsCard from "@/components/scouting/ScoutingScoutDetailsCard";
import ScoutingPlayerSearchCard from "@/components/scouting/ScoutingPlayerSearchCard";
import { Card, CardContent } from "@/ui-v2/components/ui/card";

interface ScoutingTabV2Props {
  gameState: GameStateData;
  onGameUpdate: (state: GameStateData) => void;
  onSelectPlayer?: (id: string) => void;
  onNavigate?: (tab: string) => void;
}

const SCOUTING_PAGE_SIZE = 20;

export function ScoutingTabV2({ gameState, onGameUpdate, onSelectPlayer, onNavigate }: ScoutingTabV2Props) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [posFilter, setPosFilter] = useState<string>("All");
  const [sending, setSending] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const myTeamId = gameState.manager.team_id ?? "";
  const myTeam = gameState.teams.find((team) => team.id === myTeamId);
  const academyTeam = myTeam?.academy_team_id
    ? gameState.teams.find((team) => team.id === myTeam.academy_team_id)
    : gameState.teams.find((team) => team.team_kind === "Academy" && team.parent_team_id === myTeamId);
  const academyRosterCount = academyTeam
    ? gameState.players.filter((p) => p.team_id === academyTeam.id).length
    : 0;
  const scouts = gameState.staff.filter((s) => s.role === "Scout" && s.team_id === myTeamId);
  const assignments = gameState.scouting_assignments || [];
  const availableScouts = calculateAvailableScouts(scouts, assignments);

  const allScoutable = filterScoutablePlayers({
    players: gameState.players,
    teams: gameState.teams,
    myTeamId,
    posFilter,
    searchQuery,
  });
  const { totalPages, safePage, players: scoutablePlayers } = paginateScoutablePlayers(allScoutable, page, SCOUTING_PAGE_SIZE);
  const alreadyScoutingIds = buildAlreadyScoutingIds(assignments);

  const handleSendScout = async (playerId: string) => {
    if (availableScouts.length === 0) return;
    setSending(playerId);
    try {
      const updated = await sendScout(availableScouts[0].id, playerId);
      onGameUpdate(updated);
    } catch (err) {
      console.error("Failed to send scout:", err);
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ScanSearch className="size-5 text-primary" />
        <h2 className="font-heading text-lg font-bold uppercase tracking-wider text-foreground">
          {t("scouting.title")}
        </h2>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_1.4fr]">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          <ScoutingOverviewCards
            scouts={scouts}
            assignmentCount={assignments.length}
            availableScoutCount={availableScouts.length}
            totalCapacity={scouts.reduce((s, scout) => s + scoutMaxSlots(scout.attributes.judging_ability), 0)}
            labels={{
              scouts: t("scouting.scouts"),
              activeAssignments: t("scouting.activeAssignments"),
              freeSlots: t("scouting.freeSlots"),
            }}
          />

          {/* Academy card */}
          <Card>
            <CardContent>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    {(() => {
                      const logo = academyTeam ? resolveTeamLogo(academyTeam.name) : null;
                      return logo ? (
                        <img src={logo} alt={academyTeam!.name} className="size-7 object-contain" />
                      ) : (
                        <GraduationCap className="size-5 text-primary" />
                      );
                    })()}
                  </div>
                  <div>
                    <p className="font-heading text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t("scouting.academyScoutingTag")}
                    </p>
                    <p className="mt-1 font-heading text-sm font-bold text-foreground">
                      {academyTeam?.name ?? t("scouting.academyPending")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {academyTeam
                        ? t("scouting.academyRosterCount", { count: academyRosterCount })
                        : t("scouting.academyPipelineHint")}
                    </p>
                  </div>
                </div>
                {!academyTeam && onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate("Youth")}
                    className="rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    {t("scouting.viewAcquisitionOptions")}
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          <ScoutingAssignmentsList
            assignments={assignments}
            scouts={scouts}
            players={gameState.players}
            teams={gameState.teams}
            onSelectPlayer={onSelectPlayer}
          />

          <ScoutingScoutDetailsCard
            scouts={scouts}
            assignments={assignments}
            players={gameState.players}
          />
        </div>

        {/* Right column: player search */}
        <div className="flex flex-col gap-4">
          {scouts.length > 0 ? (
            <ScoutingPlayerSearchCard
              players={scoutablePlayers}
              teams={gameState.teams}
              currentDate={gameState.clock.current_date}
              posFilter={posFilter}
              searchQuery={searchQuery}
              alreadyScoutingIds={alreadyScoutingIds}
              availableScoutCount={availableScouts.length}
              sendingPlayerId={sending}
              safePage={safePage}
              totalPages={totalPages}
              totalPlayers={allScoutable.length}
              pageSize={SCOUTING_PAGE_SIZE}
              onPositionFilterChange={(position) => { setPosFilter(position); setPage(0); }}
              onSearchQueryChange={(query) => { setSearchQuery(query); setPage(0); }}
              onSelectPlayer={onSelectPlayer}
              onSendScout={handleSendScout}
              onPreviousPage={() => setPage((p) => Math.max(0, p - 1))}
              onNextPage={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <ScanSearch className="mx-auto mb-2 size-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t("scouting.noScouts")}</p>
                <p className="mt-1 text-xs text-muted-foreground/60">{t("scouting.noScoutsHint")}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
