import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MatchModeType } from "../hooks/useAdvanceTime";
import { useGameStore } from "../store/gameStore";
import type { GameStateData, PlayerSelectionOptions } from "../store/gameStore";
import DashboardHeader, {
  type DashboardMatchModeMeta,
} from "../components/dashboard/DashboardHeader";
import DashboardOverlays from "../components/dashboard/DashboardOverlays";
import FiredModal from "../components/dashboard/FiredModal";
import DashboardSidebar from "../components/dashboard/DashboardSidebar";
import DashboardWorkspaceContent from "../components/dashboard/DashboardWorkspaceContent";
import {
  createDashboardProfileNavigationState,
  goBackDashboardProfile,
  hasDashboardProfileHistory,
  navigateDashboardProfiles,
  openDashboardSearchPlayer,
  openDashboardSearchTeam,
  selectDashboardPlayer,
  selectDashboardTeam,
  type DashboardNavigateContext,
} from "../components/dashboard/dashboardProfileNavigation";
import { createDashboardTabContentModel } from "../components/dashboard/dashboardTabContentModel";
import {
  isOnboardingPageTab,
  loadVisitedOnboardingTabs,
  saveVisitedOnboardingTabs,
} from "../components/home/HomeTab.helpers";
import {
  getDashboardAlerts,
  getDashboardSearchResults,
  getManagerTeamName,
  getTodayMatchFixture,
  getUnreadMessagesCount,
} from "../components/dashboard/dashboardHelpers";
import { useAdvanceTime } from "../hooks/useAdvanceTime";
import { Eye, Gamepad2 } from "lucide-react";
import {
  formatDateFull,
  isSeasonComplete as isLeagueSeasonComplete,
} from "../lib/helpers";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../store/settingsStore";
import { resolveTeamLogo } from "../lib/teamLogos";

const CLUB_TABS = new Set(["Squad", "Tactics", "Training", "Meta", "Scrims", "Staff", "Scouting", "Youth", "Finances", "Transfers"]);

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

export default function Dashboard(): JSX.Element {
  const navigate = useNavigate();
  const {
    hasActiveGame,
    managerName,
    gameState,
    setGameState,
    clearGame,
    isDirty,
    markClean,
  } = useGameStore();
  const { t } = useTranslation();
  const { settings, loaded: settingsLoaded, loadSettings } = useSettingsStore();

  // Load settings on mount
  useEffect(() => {
    if (!settingsLoaded) loadSettings();
  }, [settingsLoaded, loadSettings]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [viewingChampionKey, setViewingChampionKey] = useState<string | null>(null);
  const [profileNavigation, setProfileNavigation] = useState(() =>
    createDashboardProfileNavigationState("Home"),
  );
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isExitingToMenu, setIsExitingToMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [visitedOnboardingTabs, setVisitedOnboardingTabs] = useState<
    Set<string>
  >(new Set<string>());

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  // Fetch initial state
  useEffect(() => {
    console.log("[Dashboard] mounted, hasActiveGame:", hasActiveGame);
    if (!hasActiveGame) {
      console.log("[Dashboard] no active game, redirecting to /");
      navigate("/");
      return;
    }

    const fetchState = async () => {
      try {
        console.log("[Dashboard] calling get_active_game...");
        const state = await invoke<GameStateData>("get_active_game");
        console.log("[Dashboard] get_active_game returned:", state ? "success" : "null");
        setGameState(state);
      } catch (err) {
        console.error("Failed to fetch game state:", err);
      }
    };

    fetchState();
  }, [hasActiveGame, navigate, setGameState]);

  // Load champions once when game loads (if not already in gameState)
  useEffect(() => {
    if (!gameState) return;
    if (gameState.champions && gameState.champions.length > 0) return;

    const loadChampions = async () => {
      try {
        console.log("[Dashboard] Loading champions for world tab...");
        const champions = await invoke<import("../store/types").ChampionData[]>("get_champions");
        setGameState({ ...gameState, champions });
        console.log(`[Dashboard] Loaded ${champions.length} champions`);
      } catch (err) {
        console.error("Failed to load champions:", err);
      }
    };

    loadChampions();
  }, [gameState]);

  const isUnemployed = gameState?.manager.team_id === null;
  const todayMatchFixture = gameState ? getTodayMatchFixture(gameState) : null;
  const hasMatchToday = todayMatchFixture !== null;

  useEffect(() => {
    if (!gameState) {
      return;
    }

    console.info("[Dashboard] matchDayStatus", {
      currentDate: gameState.clock.current_date,
      fixtureDate: todayMatchFixture?.date ?? null,
      fixtureId: todayMatchFixture?.id ?? null,
      fixtureStatus: todayMatchFixture?.status ?? null,
      hasMatchToday,
      managerTeamId: gameState.manager.team_id,
      matchMode: settings.default_match_mode,
    });
  }, [
    gameState,
    hasMatchToday,
    settings.default_match_mode,
    todayMatchFixture,
  ]);

  useEffect(() => {
    if (!gameState) {
      setVisitedOnboardingTabs(new Set<string>());
      return;
    }

    setVisitedOnboardingTabs(loadVisitedOnboardingTabs(gameState));
  }, [gameState]);

  useEffect(() => {
    if (!isOnboardingPageTab(profileNavigation.activeTab)) {
      return;
    }

    if (!gameState) {
      return;
    }

    setVisitedOnboardingTabs((currentTabs) => {
      if (currentTabs.has(profileNavigation.activeTab)) {
        return currentTabs;
      }

      const nextTabs = new Set(currentTabs);
      nextTabs.add(profileNavigation.activeTab);
      saveVisitedOnboardingTabs(gameState, nextTabs);
      return nextTabs;
    });
  }, [gameState, profileNavigation.activeTab]);

  // Reset to Home tab if current tab is a club tab and manager is unemployed
  useEffect(() => {
    if (isUnemployed && profileNavigation.activeTab && CLUB_TABS.has(profileNavigation.activeTab)) {
      setProfileNavigation((s) => navigateDashboardProfiles(s, "Home"));
    }
  }, [isUnemployed, profileNavigation.activeTab]);

  const seasonComplete = isLeagueSeasonComplete(gameState?.league);

  // Advance-time hook
  const {
    isAdvancing,
    showContinueMenu,
    setShowContinueMenu,
    showMatchConfirm,
    setShowMatchConfirm,
    matchMode,
    setMatchMode,
    blockerModal,
    setBlockerModal,
    autoDelegationNotice,
    handleContinue,
    handleConfirmMatch,
    handleSkipToMatchDay,
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

  // Intercept window close to warn about unsaved changes
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const isClosingRef = useRef(false);
  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisten = appWindow.onCloseRequested(async (event) => {
      if (isClosingRef.current) return;
      if (isDirty) {
        event.preventDefault();
        setShowCloseConfirm(true);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [isDirty]);

  const handleCloseQuit = async (save: boolean) => {
    isClosingRef.current = true;
    setShowCloseConfirm(false);
    if (save) {
      try {
        await invoke("save_game");
        markClean();
      } catch (err) {
        console.error("Auto-save on close failed:", err);
      }
    }
    await getCurrentWindow().destroy();
  };

  const MODE_META: Record<MatchModeType, DashboardMatchModeMeta> = {
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
  };

  const currentModeMeta = MODE_META[matchMode];

  function handleNavClick(tab: string): void {
    setViewingChampionKey(null);
    setProfileNavigation((currentState) =>
      navigateDashboardProfiles(currentState, tab),
    );
  }

  function handleNavigate(tab: string, context?: DashboardNavigateContext): void {
    setViewingChampionKey(null);
    setProfileNavigation((currentState) =>
      navigateDashboardProfiles(currentState, tab, context),
    );
  }

  function handleBack(): void {
    setProfileNavigation((currentState) =>
      goBackDashboardProfile(currentState),
    );
  }

  const handleExitToMenu = async () => {
    if (isExitingToMenu) {
      return;
    }

    setIsExitingToMenu(true);
    try {
      await invoke("exit_to_menu");
      clearGame();
      navigate("/");
    } catch (err) {
      console.error("Failed to exit:", err);
      clearGame();
      navigate("/");
    }
  };

  function selectPlayer(id: string, options?: PlayerSelectionOptions): void {
    setProfileNavigation((currentState) =>
      selectDashboardPlayer(currentState, id, options),
    );
  }

  function selectTeam(id: string): void {
    setProfileNavigation((currentState) =>
      selectDashboardTeam(currentState, id),
    );
  }

  function handleSearchFocus(): void {
    setSearchOpen(true);
  }

  function handleSearchBlur(): void {
    setTimeout(() => setSearchOpen(false), 200);
  }

  function handleSearchQueryChange(query: string): void {
    setSearchQuery(query);
  }

  function handleSelectSearchPlayer(playerId: string): void {
    setProfileNavigation((currentState) =>
      openDashboardSearchPlayer(currentState, playerId),
    );
    setSearchQuery("");
  }

  function handleSelectSearchTeam(teamId: string): void {
    setProfileNavigation((currentState) =>
      openDashboardSearchTeam(currentState, teamId),
    );
    setSearchQuery("");
  }

  function handleToggleContinueMenu(): void {
    setShowContinueMenu((currentValue) => !currentValue);
  }

  function handleSelectMatchMode(mode: MatchModeType): void {
    setMatchMode(mode === "delegate" ? "spectator" : mode);
    setShowContinueMenu(false);
  }

  useEffect(() => {
    if (matchMode === "delegate") {
      setMatchMode("spectator");
    }
  }, [matchMode, setMatchMode]);

  function handleNavigateSettings(): void {
    navigate("/settings", { state: { from: "/dashboard" } });
  }

  const currentDate = gameState
    ? formatDateFull(gameState.clock.current_date, settings.language)
    : "";
  const unreadMessagesCount = gameState ? getUnreadMessagesCount(gameState) : 0;
  const myTeamName = gameState ? getManagerTeamName(gameState) : null;
  const liveManagerName = gameState
    ? (gameState.manager.nickname?.trim() || `${gameState.manager.first_name} ${gameState.manager.last_name}`)
    : managerName;

  const teamLogo = useMemo(() => {
    return resolveTeamLogo(myTeamName);
  }, [myTeamName]);

  const searchResults = gameState
    ? getDashboardSearchResults(gameState, searchQuery)
    : { matchedPlayers: [], matchedTeams: [], matchedChampions: [] };
  const dashboardAlerts = gameState
    ? getDashboardAlerts(gameState, hasMatchToday, t)
    : [];
  const hasProfileHistory = hasDashboardProfileHistory(profileNavigation);
  const activeTabLabel = TAB_TRANSLATION_KEYS[profileNavigation.activeTab]
    ? t(TAB_TRANSLATION_KEYS[profileNavigation.activeTab])
    : profileNavigation.activeTab;
  const dashboardTabContentModel = gameState
    ? createDashboardTabContentModel({
        activeTab: profileNavigation.activeTab,
        gameState,
        seasonComplete,
        visitedOnboardingTabs,
        initialMessageId: profileNavigation.initialMessageId,
        handlers: {
          onSelectPlayer: selectPlayer,
          onSelectTeam: selectTeam,
          onGameUpdate: setGameState,
          onNavigate: handleNavigate,
          onViewChampion: (championKey: string) => setViewingChampionKey(championKey),
        },
      })
    : null;

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-navy-900 flex items-center justify-center transition-colors">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-500 dark:text-gray-400 font-heading uppercase tracking-wider text-sm">
            {t("dashboard.loading")}
          </span>
        </div>
      </div>
    );
  }

  // Push scrim auto-delegation notice if present
  if (autoDelegationNotice) {
    dashboardAlerts.unshift({
      id: "scrim_auto_delegate_notice",
      text: autoDelegationNotice,
      tab: "Scrims",
      severity: "info",
    });
  }

  return (
    <div className="h-screen overflow-hidden bg-gray-100 dark:bg-navy-900 flex transition-colors duration-300">
      <DashboardSidebar
        activeTab={profileNavigation.activeTab}
        collapsed={isSidebarCollapsed}
        onNavClick={handleNavClick}
        onToggleCollapse={() => {
          setIsSidebarCollapsed((currentValue) => !currentValue);
        }}
        unreadMessagesCount={unreadMessagesCount}
        managerName={liveManagerName}
        teamName={myTeamName}
        teamLogo={teamLogo}
        onNavigateSettings={handleNavigateSettings}
        isUnemployed={isUnemployed ?? false}
        onExitClick={() => {
          if (!isExitingToMenu) {
            setShowExitConfirm(true);
          }
        }}
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

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <DashboardHeader
          activeTabLabel={activeTabLabel}
          currentDate={currentDate}
          hasProfileHistory={hasProfileHistory}
          hasMatchToday={hasMatchToday}
          isAdvancing={isAdvancing}
          isSaving={isSaving}
          matchMode={matchMode}
          matchedPlayers={searchResults.matchedPlayers}
          matchedTeams={searchResults.matchedTeams}
          matchedChampions={searchResults.matchedChampions}
          modeMeta={MODE_META}
          onBack={handleBack}
          onContinue={handleContinue}
          onSave={handleSave}
          onSearchBlur={handleSearchBlur}
          onSearchFocus={handleSearchFocus}
          onSearchQueryChange={handleSearchQueryChange}
          onSelectMatchMode={handleSelectMatchMode}
          onSelectSearchPlayer={handleSelectSearchPlayer}
          onSelectSearchTeam={handleSelectSearchTeam}
          onSelectSearchChampion={(championKey: string) => setViewingChampionKey(championKey)}
          onSkipToMatchDay={handleSkipToMatchDay}
          onToggleContinueMenu={handleToggleContinueMenu}
          saveFlash={saveFlash}
          searchOpen={searchOpen}
          searchQuery={searchQuery}
          seasonComplete={seasonComplete}
          showContinueMenu={showContinueMenu}
          isUnemployed={isUnemployed ?? false}
          teams={gameState.teams}
        />

        <DashboardWorkspaceContent
          dashboardAlerts={dashboardAlerts}
          gameState={gameState}
          profileNavigation={profileNavigation}
          dashboardTabContentModel={dashboardTabContentModel ?? createDashboardTabContentModel({
            activeTab: profileNavigation.activeTab,
            gameState,
            seasonComplete,
            visitedOnboardingTabs,
            initialMessageId: profileNavigation.initialMessageId,
            handlers: {
              onSelectPlayer: selectPlayer,
              onSelectTeam: selectTeam,
              onGameUpdate: setGameState,
              onNavigate: handleNavigate,
              onViewChampion: (championKey: string) => setViewingChampionKey(championKey),
            },
          })}
          onBack={handleBack}
          onNavigate={handleNavigate}
          onSelectPlayer={selectPlayer}
          onSelectTeam={selectTeam}
          onGameUpdate={setGameState}
          isUnemployed={isUnemployed ?? false}
          viewingChampionKey={viewingChampionKey}
          onCloseChampion={() => setViewingChampionKey(null)}
          onViewChampion={(championKey: string) => setViewingChampionKey(championKey)}
        />
      </main>
    </div>
  );
}
