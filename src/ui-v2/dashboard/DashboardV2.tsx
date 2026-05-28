import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { Eye, Gamepad2 } from "lucide-react";

import { useGameStore } from "@/store/gameStore";
import type { GameStateData, PlayerSelectionOptions } from "@/store/gameStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useAdvanceTime, type MatchModeType } from "@/hooks/useAdvanceTime";
import { resolveTeamLogo } from "@/lib/teamLogos";
import {
  formatDateFull,
  isSeasonComplete as isLeagueSeasonComplete,
} from "@/lib/helpers";
import DashboardWorkspaceContent from "@/components/dashboard/DashboardWorkspaceContent";
import DashboardOverlays from "@/components/dashboard/DashboardOverlays";
import FiredModal from "@/components/dashboard/FiredModal";
import {
  createDashboardProfileNavigationState,
  goBackDashboardProfile,
  hasDashboardProfileHistory,
  navigateDashboardProfiles,
  selectDashboardPlayer,
  selectDashboardTeam,
  type DashboardNavigateContext,
} from "@/components/dashboard/dashboardProfileNavigation";
import { createDashboardTabContentModel } from "@/components/dashboard/dashboardTabContentModel";
import {
  getDashboardAlerts,
  getManagerTeamName,
  getTodayMatchFixture,
  getUnreadMessagesCount,
} from "@/components/dashboard/dashboardHelpers";
import type { DashboardMatchModeMeta } from "@/components/dashboard/DashboardHeader";

import { DashboardSidebarV2 } from "./DashboardSidebarV2";
import { DashboardHeaderV2 } from "./DashboardHeaderV2";
import { HomeTabV2 } from "./tabs/HomeTabV2";
import { InboxTabV2 } from "./tabs/InboxTabV2";
import { ScheduleTabV2 } from "./tabs/ScheduleTabV2";

const TAB_TRANSLATION_KEYS: Record<string, string> = {
  Home: "dashboard.home",
  Inbox: "dashboard.inbox",
  Manager: "dashboard.manager",
  Squad: "dashboard.squad",
  Tactics: "dashboard.tactics",
  Training: "dashboard.training",
  Scrims: "dashboard.scrims",
  Meta: "dashboard.meta",
  Staff: "dashboard.staff",
  Finances: "dashboard.finances",
  Transfers: "dashboard.transfers",
  Players: "dashboard.players",
  Teams: "dashboard.teams",
  Tournaments: "dashboard.tournaments",
  ChampionsWorld: "dashboard.champions_world",
  Schedule: "dashboard.schedule",
  News: "dashboard.news",
  Social: "dashboard.social",
  Scouting: "dashboard.scouting",
  Youth: "dashboard.youthAcademy",
};

export default function DashboardV2() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    hasActiveGame,
    managerName,
    gameState,
    setGameState,
    setGameActive,
    clearGame,
    markClean,
  } = useGameStore();
  const [probedNoGame, setProbedNoGame] = useState(false);
  const { settings, loaded: settingsLoaded, loadSettings } = useSettingsStore();

  const [isSaving, setIsSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [profileNavigation, setProfileNavigation] = useState(() =>
    createDashboardProfileNavigationState("Home"),
  );
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isExitingToMenu, setIsExitingToMenu] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [viewingChampionKey, setViewingChampionKey] = useState<string | null>(null);

  useEffect(() => {
    if (!settingsLoaded) loadSettings();
  }, [settingsLoaded, loadSettings]);

  useEffect(() => {
    if (hasActiveGame) {
      invoke<GameStateData>("get_active_game")
        .then(setGameState)
        .catch((err) => console.error("Failed to fetch game state:", err));
      return;
    }
    invoke<GameStateData | null>("get_active_game")
      .then((state) => {
        if (state) {
          const name =
            state.manager.nickname?.trim() ||
            `${state.manager.first_name} ${state.manager.last_name}`;
          setGameActive(true, name);
          setGameState(state);
        } else {
          setProbedNoGame(true);
        }
      })
      .catch(() => setProbedNoGame(true));
  }, [hasActiveGame, setGameState, setGameActive]);

  const isUnemployed = gameState?.manager.team_id === null;
  const todayMatchFixture = gameState ? getTodayMatchFixture(gameState) : null;
  const hasMatchToday = todayMatchFixture !== null;
  const seasonComplete = isLeagueSeasonComplete(gameState?.leagues?.[0]);

  const {
    isAdvancing,
    showMatchConfirm,
    setShowMatchConfirm,
    matchMode,
    blockerModal,
    setBlockerModal,
    autoDelegationNotice,
    handleContinue,
    handleConfirmMatch,
  } = useAdvanceTime(
    setGameState,
    hasMatchToday,
    settings.default_match_mode,
    settings.scrim_review_mode,
    settingsLoaded,
    isUnemployed ?? false,
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await invoke("save_game");
      markClean();
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 2000);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setIsSaving(false);
    }
  }, [markClean]);

  const handleExitToMenu = async () => {
    if (isExitingToMenu) return;
    setIsExitingToMenu(true);
    try {
      await invoke("exit_to_menu");
    } catch (err) {
      console.error("Failed to exit:", err);
    } finally {
      clearGame();
      navigate("/");
    }
  };

  const handleCloseQuit = async (save: boolean) => {
    setShowCloseConfirm(false);
    if (save) {
      try {
        await invoke("save_game");
        markClean();
      } catch (err) {
        console.error("Auto-save on close failed:", err);
      }
    }
  };

  const handleNavClick = (tab: string) => {
    setViewingChampionKey(null);
    setProfileNavigation((s) => navigateDashboardProfiles(s, tab));
  };

  const handleNavigate = (tab: string, context?: DashboardNavigateContext) => {
    setViewingChampionKey(null);
    setProfileNavigation((s) => navigateDashboardProfiles(s, tab, context));
  };

  const handleBack = () => setProfileNavigation((s) => goBackDashboardProfile(s));

  const selectPlayer = (id: string, options?: PlayerSelectionOptions) =>
    setProfileNavigation((s) => selectDashboardPlayer(s, id, options));

  const selectTeam = (id: string) =>
    setProfileNavigation((s) => selectDashboardTeam(s, id));

  const MODE_META: Record<MatchModeType, DashboardMatchModeMeta> = useMemo(
    () => ({
      live: {
        label: t("continueMenu.goToField"),
        icon: <Gamepad2 className="w-4 h-4" />,
        desc: t("continueMenu.goToFieldDesc"),
        buttonColorClass: "from-primary-500 to-primary-600",
        dropdownColorClass: "from-primary-600 to-primary-700",
      },
      spectator: {
        label: t("continueMenu.watchSpectator"),
        icon: <Eye className="w-4 h-4" />,
        desc: t("continueMenu.watchSpectatorDesc"),
        buttonColorClass: "from-indigo-500 to-indigo-600",
        dropdownColorClass: "from-indigo-600 to-indigo-700",
      },
      delegate: {
        label: t("continueMenu.watchSpectator"),
        icon: <Eye className="w-4 h-4" />,
        desc: t("continueMenu.watchSpectatorDesc"),
        buttonColorClass: "from-indigo-500 to-indigo-600",
        dropdownColorClass: "from-indigo-600 to-indigo-700",
      },
    }),
    [t],
  );
  const currentModeMeta = MODE_META[matchMode];

  const currentDate = gameState
    ? formatDateFull(gameState.clock.current_date, settings.language)
    : "";
  const unreadMessagesCount = gameState ? getUnreadMessagesCount(gameState) : 0;
  const myTeamName = gameState ? getManagerTeamName(gameState) : null;
  const liveManagerName = gameState
    ? gameState.manager.nickname?.trim() ||
      `${gameState.manager.first_name} ${gameState.manager.last_name}`
    : managerName;
  const teamLogo = useMemo(() => resolveTeamLogo(myTeamName), [myTeamName]);
  const hasProfileHistory = hasDashboardProfileHistory(profileNavigation);
  const activeTabLabel = TAB_TRANSLATION_KEYS[profileNavigation.activeTab]
    ? t(TAB_TRANSLATION_KEYS[profileNavigation.activeTab])
    : profileNavigation.activeTab;

  const dashboardAlerts = gameState
    ? getDashboardAlerts(gameState, hasMatchToday, t)
    : [];
  if (autoDelegationNotice) {
    dashboardAlerts.unshift({
      id: "scrim_auto_delegate_notice",
      text: autoDelegationNotice,
      tab: "Scrims",
      severity: "info",
    });
  }

  const dashboardTabContentModel = gameState
    ? createDashboardTabContentModel({
        activeTab: profileNavigation.activeTab,
        gameState,
        seasonComplete,
        visitedOnboardingTabs: new Set<string>(),
        initialMessageId: profileNavigation.initialMessageId,
        handlers: {
          onSelectPlayer: selectPlayer,
          onSelectTeam: selectTeam,
          onGameUpdate: setGameState,
          onNavigate: handleNavigate,
          onViewChampion: (k) => setViewingChampionKey(k),
        },
      })
    : null;

  if (!hasActiveGame && probedNoGame) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <div className="text-lg font-medium">No active game</div>
        <p className="text-sm text-muted-foreground">
          Start a game from the legacy UI (set VITE_UI_V2=false), then come back.
        </p>
      </div>
    );
  }

  if (!gameState || !dashboardTabContentModel) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <DashboardSidebarV2
        activeTab={profileNavigation.activeTab}
        onNavClick={handleNavClick}
        unreadMessagesCount={unreadMessagesCount}
        managerName={liveManagerName}
        teamName={myTeamName}
        teamLogo={teamLogo}
        isUnemployed={isUnemployed ?? false}
        onNavigateSettings={() => navigate("/settings", { state: { from: "/dashboard" } })}
        onExitClick={() => !isExitingToMenu && setShowExitConfirm(true)}
      />

      <DashboardOverlays
        blockerModal={blockerModal}
        currentModeMeta={currentModeMeta}
        handleConfirmMatch={handleConfirmMatch}
        handleExitToMenu={handleExitToMenu}
        handleNavigate={handleNavigate}
        handleCloseQuit={handleCloseQuit}
        isExitingToMenu={isExitingToMenu}
        matchMode={matchMode}
        setBlockerModal={setBlockerModal}
        setShowCloseConfirm={setShowCloseConfirm}
        setShowExitConfirm={setShowExitConfirm}
        setShowMatchConfirm={setShowMatchConfirm}
        showCloseConfirm={showCloseConfirm}
        showExitConfirm={showExitConfirm}
        showMatchConfirm={showMatchConfirm}
        teams={gameState.teams}
        todayMatchFixture={todayMatchFixture}
      />
      <FiredModal />

      <main className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeaderV2
          activeTabLabel={activeTabLabel}
          currentDate={currentDate}
          hasProfileHistory={hasProfileHistory}
          isAdvancing={isAdvancing}
          isSaving={isSaving}
          saveFlash={saveFlash}
          hasMatchToday={hasMatchToday}
          onBack={handleBack}
          onSave={handleSave}
          onContinue={handleContinue}
        />

        {profileNavigation.activeTab === "Home" &&
        !viewingChampionKey &&
        !profileNavigation.selectedPlayerId &&
        !profileNavigation.selectedTeamId &&
        !seasonComplete ? (
          <div className="flex-1 overflow-y-auto">
            <HomeTabV2 gameState={gameState} onNavigate={handleNavigate} />
          </div>
        ) : profileNavigation.activeTab === "Inbox" &&
          !viewingChampionKey &&
          !profileNavigation.selectedPlayerId &&
          !profileNavigation.selectedTeamId ? (
          <div className="flex-1 overflow-hidden">
            <InboxTabV2
              gameState={gameState}
              onGameUpdate={setGameState}
              initialMessageId={profileNavigation.initialMessageId ?? null}
              onNavigate={handleNavigate}
            />
          </div>
        ) : profileNavigation.activeTab === "Schedule" &&
          !viewingChampionKey &&
          !profileNavigation.selectedPlayerId &&
          !profileNavigation.selectedTeamId ? (
          <div className="flex-1 overflow-y-auto">
            <ScheduleTabV2 gameState={gameState} onSelectTeam={selectTeam} />
          </div>
        ) : (
          <DashboardWorkspaceContent
            dashboardAlerts={dashboardAlerts}
            gameState={gameState}
            profileNavigation={profileNavigation}
            dashboardTabContentModel={dashboardTabContentModel}
            onBack={handleBack}
            onNavigate={handleNavigate}
            onSelectPlayer={selectPlayer}
            onSelectTeam={selectTeam}
            onGameUpdate={setGameState}
            isUnemployed={isUnemployed ?? false}
            viewingChampionKey={viewingChampionKey}
            onCloseChampion={() => setViewingChampionKey(null)}
            onViewChampion={(k) => setViewingChampionKey(k)}
          />
        )}
      </main>
    </div>
  );
}
