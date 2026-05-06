import HomeTab from "../home/HomeTab";
import SquadTab from "../squad/SquadTab";
import TacticsTab from "../tactics/TacticsTab";
import TrainingTab from "../training/TrainingTab";
import ScheduleTab from "../schedule/ScheduleTab";
import FinancesTab from "../finances/FinancesTab";
import TransfersTab from "../transfers/TransfersTab";
import PlayersListTab from "../players/PlayersListTab";
import TeamsListTab from "../teams/TeamsListTab";
import TournamentsTab from "../tournaments/TournamentsTab";
import ScoutingTab from "../scouting/ScoutingTab";
import YouthAcademyTab from "../youthAcademy/YouthAcademyTab";
import StaffTab from "../staff/StaffTab";
import InboxTab from "../inbox/InboxTab";
import ManagerTab from "../manager/ManagerTab";
import NewsTab from "../news/NewsTab";
import SocialTab from "../social/SocialTab";
import ChampionsTab from "../champions/ChampionsTab";
import ChampionsWorldTab from "../world/ChampionsWorldTab";
import ScrimsTab from "../scrims/ScrimsTab";
import EndOfSeasonScreen from "../EndOfSeasonScreen";
import { Card, CardBody } from "../ui";
import type { DashboardTabContentModel } from "./dashboardTabContentModel";

interface DashboardTabContentProps {
  viewModel: DashboardTabContentModel;
}

export default function DashboardTabContent({
  viewModel,
}: DashboardTabContentProps) {
  const {
    activeTab,
    gameState,
    initialMessageId,
    managerId,
    seasonComplete,
    visitedOnboardingTabs,
    handlers: {
      onGameUpdate,
      onNavigate,
      onSelectPlayer,
      onSelectTeam,
      onViewChampion,
    },
  } = viewModel;

  return (
    <>
      {/* End-of-season screen when all fixtures are complete */}
      {seasonComplete && activeTab === "Home" && (
        <EndOfSeasonScreen gameState={gameState} onGameUpdate={onGameUpdate} />
      )}

      {activeTab === "Home" && !seasonComplete && (
        <HomeTab
          gameState={gameState}
          onNavigate={onNavigate}
          onGameUpdate={onGameUpdate}
          visitedOnboardingTabs={visitedOnboardingTabs}
        />
      )}

      {activeTab === "Squad" && (
        <SquadTab
          gameState={gameState}
          managerId={managerId}
          onSelectPlayer={onSelectPlayer}
          onGameUpdate={onGameUpdate}
        />
      )}

      {activeTab === "Tactics" && (
        <TacticsTab
          gameState={gameState}
          onSelectPlayer={onSelectPlayer}
          onGameUpdate={onGameUpdate}
        />
      )}

      {activeTab === "Training" && (
        <TrainingTab gameState={gameState} onGameUpdate={onGameUpdate} />
      )}

      {activeTab === "Scrims" && (
        <ScrimsTab gameState={gameState} onGameUpdate={onGameUpdate} />
      )}

      {activeTab === "Meta" && (
        <ChampionsTab gameState={gameState} onGameUpdate={onGameUpdate} onViewChampion={onViewChampion} />
      )}

      {activeTab === "Schedule" && (
        <ScheduleTab gameState={gameState} onSelectTeam={onSelectTeam} />
      )}

      {activeTab === "Finances" && (
        <FinancesTab
          gameState={gameState}
          onGameUpdate={onGameUpdate}
          onSelectPlayer={onSelectPlayer}
        />
      )}

      {activeTab === "Transfers" && (
        <TransfersTab
          gameState={gameState}
          onSelectPlayer={onSelectPlayer}
          onSelectTeam={onSelectTeam}
          onGameUpdate={onGameUpdate}
        />
      )}

      {activeTab === "Players" && (
        <PlayersListTab
          gameState={gameState}
          onSelectPlayer={onSelectPlayer}
          onSelectTeam={onSelectTeam}
        />
      )}

      {activeTab === "Teams" && (
        <TeamsListTab gameState={gameState} onSelectTeam={onSelectTeam} />
      )}

      {activeTab === "Tournaments" && (
        <TournamentsTab gameState={gameState} onSelectTeam={onSelectTeam} />
      )}

      {activeTab === "ChampionsWorld" && (
        <ChampionsWorldTab champions={gameState.champions} onViewChampion={onViewChampion} />
      )}

      {activeTab === "Staff" && (
        <StaffTab gameState={gameState} onGameUpdate={onGameUpdate} />
      )}

      {activeTab === "Scouting" && (
        <ScoutingTab
          gameState={gameState}
          onGameUpdate={onGameUpdate}
          onSelectPlayer={onSelectPlayer}
          onNavigate={onNavigate}
        />
      )}

      {(activeTab === "Youth" || activeTab === "YouthAcademy") && (
        <YouthAcademyTab
          gameState={gameState}
          onSelectPlayer={onSelectPlayer}
          onGameUpdate={onGameUpdate}
        />
      )}

      {activeTab === "Inbox" && (
        <InboxTab
          gameState={gameState}
          onGameUpdate={onGameUpdate}
          initialMessageId={initialMessageId}
          onNavigate={onNavigate}
        />
      )}

      {activeTab === "Manager" && <ManagerTab gameState={gameState} />}

      {activeTab === "News" && (
        <NewsTab gameState={gameState} onSelectTeam={onSelectTeam} />
      )}

      {activeTab === "Social" && (
        <SocialTab gameState={gameState} onGameUpdate={onGameUpdate} />
      )}

      {![
        "Home",
        "Squad",
        "Tactics",
        "Training",
        "Scrims",
        "Meta",
        "Schedule",
        "Finances",
        "Transfers",
        "Players",
        "Teams",
        "Tournaments",
        "ChampionsWorld",
        "Staff",
        "Scouting",
        "Youth",
        "YouthAcademy",
        "Inbox",
        "Manager",
        "News",
        "Social",
      ].includes(activeTab) && (
        <Card>
          <CardBody>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              View unavailable
            </p>
          </CardBody>
        </Card>
      )}
    </>
  );
}
