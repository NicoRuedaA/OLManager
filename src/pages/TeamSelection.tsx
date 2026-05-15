import { useEffect, useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useGameStore,
  GameStateData,
  PlayerData,
  LeagueSelectionData,
  CompetitionSummary,
} from "../store/gameStore";
import {
  Card,
  CardBody,
  Badge,
  TeamLocation,
  ThemeToggle,
} from "../components/ui";
import {
  ArrowLeft,
  Users,
  Trophy,
  Landmark,
  ChevronRight,
  Star,
  Loader2,
  Globe,
  Layers,
} from "lucide-react";
import { getMainTeams } from "../store/academySelectors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OldTeamSelectionData = {
  manager: GameStateData["manager"];
  teams: GameStateData["teams"];
  players: GameStateData["players"];
};

/** Normalised team shape for rendering — works with both legacy TeamData and new TeamSummary. */
interface RenderTeam {
  id: string;
  name: string;
  short_name: string;
  country: string;
  city?: string;
  finance?: number;
  reputation?: number;
  colors?: { primary: string; secondary: string };
  logo_url?: string | null;
  competition_id?: string | null;
  player_count?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampOvr(value: number): number {
  return Math.max(1, Math.min(99, Math.round(value)));
}

function avg(...values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function lolRoleFromPlayer(
  player: PlayerData,
): "top" | "jungle" | "mid" | "bottom" | "support" | "unknown" {
  const position = (player.natural_position || player.position || "").toLowerCase();
  if (position === "top") return "top";
  if (position === "jungle") return "jungle";
  if (position === "mid") return "mid";
  if (position === "adc" || position === "bot" || position === "bottom") return "bottom";
  if (position === "support" || position === "sup") return "support";
  return "unknown";
}

function roleBonus(player: PlayerData): number {
  const a = player.attributes;
  switch (lolRoleFromPlayer(player)) {
    case "top":
      return avg(a.mental_resilience, a.discipline, a.consistency) * 0.08;
    case "jungle":
      return avg(a.macro_play, a.consistency, a.teamfighting) * 0.08;
    case "mid":
      return avg(a.mechanics, a.laning, a.consistency) * 0.08;
    case "bottom":
      return avg(a.laning, a.mechanics, a.consistency) * 0.08;
    case "support":
      return avg(a.teamfighting, a.macro_play, a.shotcalling) * 0.08;
    default:
      return 0;
  }
}

function lolPlayerOvr(player: PlayerData): number {
  const a = player.attributes;
  const mechanics = avg(a.mechanics, a.champion_pool, a.discipline);
  const macro = avg(a.macro_play, a.consistency, a.teamfighting);
  const teamfight = avg(a.teamfighting, a.mental_resilience, a.discipline);
  const consistency = avg(a.consistency, a.macro_play, a.discipline);
  const weighted =
    mechanics * 0.34 + macro * 0.28 + teamfight * 0.22 + consistency * 0.16;
  return clampOvr(weighted + roleBonus(player));
}

/**
 * Resolve a team's logo path.
 * Priority: explicit logoUrl (mapped from /team-logos/ → /teams-icons/) → derived from id.
 * @param teamId  Scoped team id (e.g. "lec-g2")
 * @param logoUrl Optional logo URL from the team data
 * @param competitionId Optional competition id for deriving path
 */
/** Override map for team slugs that don't match the file name. */
const LOGO_SLUG_OVERRIDES: Record<string, string> = {};

function getTeamLogoPath(
  teamId: string,
  logoUrl?: string | null,
  competitionId?: string | null,
): string {
  // 1. Explicit logo URL — map from /team-logos/ to /teams-icons/
  if (logoUrl) {
    const slug = logoUrl.split("/").pop()?.replace(".webp", "") ?? "";
    const overridden = LOGO_SLUG_OVERRIDES[slug] ?? slug;
    return `/teams-icons/${overridden}.webp`;
  }

  // 2. Derive from competition + team id pattern (new flow)
  if (competitionId) {
    const prefix = `${competitionId}-`;
    const rawSlug = teamId.startsWith(prefix) ? teamId.slice(prefix.length) : teamId;
    if (rawSlug === "shifters") {
      return "https://static.lolesports.com/teams/1765897071435_600px-Shifters_allmode.png";
    }
    const slug = LOGO_SLUG_OVERRIDES[rawSlug] ?? rawSlug;
    return `/teams-icons/${slug}.webp`;
  }

  // 3. Legacy fallback: strip "lec-" prefix
  const rawSlug = teamId.replace(/^lec-/, "");
  if (rawSlug === "shifters") {
    return "https://static.lolesports.com/teams/1765897071435_600px-Shifters_allmode.png";
  }
  const slug = LOGO_SLUG_OVERRIDES[rawSlug] ?? rawSlug;
  return `/teams-icons/${slug}.webp`;
}

function isAcademyPlayer(playerId: string): boolean {
  return playerId.includes("-academy-");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TeamSelection() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { gameState, setGameState, setGameActive } = useGameStore();

  // Selection state
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  // New-flow state (league selection)
  const [leagueData, setLeagueData] = useState<LeagueSelectionData | null>(null);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Old-flow fallback state
  const [oldTeamData, setOldTeamData] = useState<OldTeamSelectionData | null>(null);

  // -----------------------------------------------------------------------
  // Data loading: on mount, figure out which flow we're in
  // -----------------------------------------------------------------------
  useEffect(() => {
    // If gameState from store already has teams → use it directly (legacy loaded game)
    if (gameState && gameState.teams.length > 0) {
      console.debug("[TeamSelection] using pre-loaded gameState (legacy flow)");
      return;
    }

    let cancelled = false;
    setIsRecovering(true);
    setErrorMessage(null);

    const loadData = async () => {
      try {
        // Step 1: Try the new get_league_selection_data
        console.debug("[TeamSelection] trying get_league_selection_data");
        const leagueResult = await invoke<LeagueSelectionData>(
          "get_league_selection_data",
        );
        if (cancelled) return;

        console.debug("[TeamSelection] leagueResult:", JSON.stringify(leagueResult));

        if (leagueResult.competitions.length > 0) {
          console.debug(
            "[TeamSelection] leagues loaded:",
            leagueResult.competitions.length,
            "names:",
            leagueResult.competitions.map((c) => c.id),
          );
          setLeagueData(leagueResult);
          // Show league picker regardless of count (user wants to see it)
          return;
        }

        // Step 2: No competitions found → try legacy fallback
        console.debug("[TeamSelection] no competitions, trying legacy fallback");
        const legacyResult = await invoke<OldTeamSelectionData>(
          "get_team_selection_data",
        );
        if (cancelled) return;
        console.debug(
          "[TeamSelection] legacy data recovered, teams:",
          legacyResult.teams.length,
        );
        setOldTeamData(legacyResult);
      } catch (error) {
        console.debug(
          "[TeamSelection] get_league_selection_data failed, trying legacy:",
          error,
        );
        try {
          const legacyResult = await invoke<OldTeamSelectionData>(
            "get_team_selection_data",
          );
          if (cancelled) return;
          console.debug(
            "[TeamSelection] legacy data recovered via fallback, teams:",
            legacyResult.teams.length,
          );
          setOldTeamData(legacyResult);
        } catch (err) {
          console.error("Failed to recover team selection data:", err);
          if (!cancelled) {
            setErrorMessage(
              `No se pudo cargar la selección de equipo: ${String(err)}`,
            );
          }
        }
      } finally {
        if (!cancelled) setIsRecovering(false);
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [gameState, navigate, setGameState]);

  // -----------------------------------------------------------------------
  // Derive visible data from whichever flow is active
  // -----------------------------------------------------------------------

  // Old flow: teams from pre-loaded game state
  const legacyTeams = useMemo(() => {
    if (gameState && gameState.teams.length > 0) {
      return getMainTeams(gameState.teams);
    }
    if (oldTeamData) {
      return getMainTeams(oldTeamData.teams);
    }
    return null;
  }, [gameState, oldTeamData]);

  // New flow: selected competition and its teams
  const selectedCompetition = useMemo<CompetitionSummary | null>(() => {
    if (!leagueData || !selectedCompetitionId) return null;
    return (
      leagueData.competitions.find((c) => c.id === selectedCompetitionId) ?? null
    );
  }, [leagueData, selectedCompetitionId]);

  // -----------------------------------------------------------------------
  // Stats helpers (old flow only — has full PlayerData)
  // -----------------------------------------------------------------------

  const sourcePlayers: PlayerData[] = useMemo(() => {
    if (gameState && gameState.teams.length > 0) return gameState.players;
    if (oldTeamData) return oldTeamData.players;
    return [];
  }, [gameState, oldTeamData]);

  const getTeamPlayers = (teamId: string): PlayerData[] =>
    sourcePlayers.filter((p) => p.team_id === teamId);

  const getCompetitiveRoster = (teamId: string): PlayerData[] => {
    const players = getTeamPlayers(teamId);
    const mainRoster = players.filter((player) => !isAcademyPlayer(player.id));
    const source = mainRoster.length > 0 ? mainRoster : players;
    return source.slice(0, 5);
  };

  const getTeamAvgOvr = (teamId: string): number => {
    const players = getCompetitiveRoster(teamId);
    if (players.length === 0) return 0;
    const total = players.reduce((sum, player) => sum + lolPlayerOvr(player), 0);
    return clampOvr(total / players.length);
  };

  // -----------------------------------------------------------------------
  // UI helpers
  // -----------------------------------------------------------------------

  const getReputationLabel = (
    rep: number,
  ): {
    label: string;
    variant: "primary" | "accent" | "success" | "danger" | "neutral";
  } => {
    if (rep >= 750) return { label: t("teamSelect.repWorldClass"), variant: "accent" };
    if (rep >= 600) return { label: t("teamSelect.repStrong"), variant: "success" };
    if (rep >= 400) return { label: t("teamSelect.repAverage"), variant: "neutral" };
    return { label: t("teamSelect.repDeveloping"), variant: "danger" };
  };

  const formatFinance = (val: number): string => {
    if (val >= 1_000_000) return `€${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `€${(val / 1_000).toFixed(0)}K`;
    return `€${val}`;
  };

  // -----------------------------------------------------------------------
  // Confirm handler
  // -----------------------------------------------------------------------

  const handleConfirm = async () => {
    if (!selectedTeamId || isConfirming) return;
    setIsConfirming(true);
    try {
      const updatedGame = await invoke<GameStateData>("select_team", {
        teamId: selectedTeamId,
      });
      setGameState(updatedGame);
      const mgr = updatedGame.manager;
      const displayName =
        mgr.nickname?.trim() || `${mgr.first_name} ${mgr.last_name}`;
      setGameActive(true, displayName);
      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to select team:", error);
      alert("Failed to select team: " + String(error));
    } finally {
      setIsConfirming(false);
    }
  };

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  if (isRecovering) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-navy-900 flex items-center justify-center">
        <div className="text-center text-gray-600 dark:text-gray-300">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
          <p className="text-sm">{t("worldSelect.creatingWorld")}</p>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  if (errorMessage && !leagueData && !legacyTeams) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-navy-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{errorMessage}</p>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg"
          >
            Volver al menú
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // League picker step (new flow — one or more competitions)
  // -----------------------------------------------------------------------

  console.debug(
    "[TeamSelection] render check — leagueData:",
    !!leagueData,
    "comps:",
    leagueData?.competitions.length ?? 0,
    "selectedCompId:",
    selectedCompetitionId,
    "legacyTeams:",
    !!legacyTeams,
  );

  if (leagueData && leagueData.competitions.length > 0 && !selectedCompetitionId) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-navy-900 transition-colors duration-300">
        <header className="bg-white dark:bg-navy-800 border-b border-gray-200 dark:border-navy-700 px-6 py-4 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-heading font-bold uppercase tracking-wide text-gray-800 dark:text-gray-100">
                {t("teamSelect.selectLeague", "Select League")}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t("teamSelect.selectLeagueSubtitle", "Choose a competition to get started")}
              </p>
            </div>
          </div>
          <ThemeToggle />
        </header>

        <div className="max-w-4xl mx-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {leagueData.competitions.map((comp) => (
              <button
                key={comp.id}
                onClick={() => setSelectedCompetitionId(comp.id)}
                className="text-left transition-all duration-200 rounded-xl hover:scale-[1.01]"
              >
                <Card className="h-full">
                  <div className="p-5 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-navy-700 flex items-center justify-center overflow-hidden">
                        {comp.logo ? (
                          <img
                            src={comp.logo}
                            alt={`${comp.name} logo`}
                            className="w-10 h-10 object-contain"
                          />
                        ) : (
                          <Globe className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-heading font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide text-sm">
                          {comp.name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {comp.region}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Users className="w-3.5 h-3.5" />
                      <span>
                        {comp.team_count} {t("teamSelect.teams", "teams")}
                      </span>
                    </div>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Determine which teams to render
  // -----------------------------------------------------------------------

  const teamsToRender: RenderTeam[] | null = legacyTeams
    ? legacyTeams.map((t) => ({
        id: t.id,
        name: t.name,
        short_name: t.short_name,
        country: t.country,
        city: t.city,
        finance: t.finance,
        reputation: t.reputation,
        colors: t.colors,
        logo_url: t.logo_url,
        competition_id: t.competition_id ?? null,
      }))
    : selectedCompetition
      ? selectedCompetition.teams.map((t) => ({
          id: t.id,
          name: t.name,
          short_name: t.short_name,
          country: t.country,
          city: t.city ?? t.country,
          finance: t.finance ?? undefined,
          reputation: t.reputation ?? undefined,
          colors: t.colors ?? undefined,
          logo_url: t.logo_url,
          competition_id: selectedCompetitionId,
          player_count: t.player_count ?? undefined,
        }))
      : null;

  const selectedTeam = teamsToRender?.find((t) => t.id === selectedTeamId);

  // -----------------------------------------------------------------------
  // Main render — Team grid
  // -----------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-navy-900 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-navy-800 border-b border-gray-200 dark:border-navy-700 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => selectedCompetitionId ? setSelectedCompetitionId(null) : navigate("/")}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-heading font-bold uppercase tracking-wide text-gray-800 dark:text-gray-100">
              {selectedCompetition
                ? selectedCompetition.name
                : t("teamSelect.title")}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t("teamSelect.subtitle")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Competition switcher (multi-competition) */}
          {leagueData && leagueData.competitions.length > 1 && selectedCompetitionId && (
            <div className="relative group mr-2">
              <button
                onClick={() => setSelectedCompetitionId(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-heading font-bold uppercase tracking-wider rounded-lg bg-gray-100 dark:bg-navy-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-navy-600 transition-colors"
                title="Change competition"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{selectedCompetition?.name}</span>
              </button>
            </div>
          )}
          <ThemeToggle />
          {selectedTeam && (
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              className={`bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-6 py-2.5 rounded-lg font-heading font-bold uppercase tracking-wider text-sm shadow-md hover:shadow-lg hover:shadow-primary-500/20 transition-all flex items-center gap-2 ${isConfirming ? "opacity-70 cursor-wait" : ""}`}
            >
              <span>
                {isConfirming
                  ? t("teamSelect.confirming")
                  : t("teamSelect.manage", {
                      name: selectedTeam.short_name,
                    })}
              </span>
              {isConfirming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {teamsToRender?.map((team) => {
            const isSelected = selectedTeamId === team.id;

            // For legacy flow: compute OVR from full player data
            const avgOvr =
              legacyTeams || oldTeamData
                ? getTeamAvgOvr(team.id)
                : 0;

            // Reputation: use provided or default for new-flow teams
            const repInfo = team.reputation
              ? getReputationLabel(team.reputation)
              : { label: "—", variant: "neutral" as const };

            // Player count: from backend for new flow, computed for legacy
            const playerCount = team.player_count ?? (legacyTeams || oldTeamData ? getCompetitiveRoster(team.id).length : undefined);

            return (
              <button
                key={team.id}
                onClick={() => setSelectedTeamId(team.id)}
                className={`text-left transition-all duration-200 rounded-xl ${
                  isSelected
                    ? "ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-navy-900 scale-[1.02]"
                    : "hover:scale-[1.01]"
                }`}
              >
                <Card
                  accent={isSelected ? "primary" : "none"}
                  className="h-full"
                >
                  {/* Team header with gradient */}
                  <div
                    className={`p-4 rounded-t-xl ${isSelected ? "shadow-inner" : ""}`}
                    style={{
                      backgroundImage: `linear-gradient(135deg, rgba(10, 15, 28, 0.52), rgba(10, 15, 28, 0.22)), linear-gradient(135deg, ${team.colors?.primary ?? "#1a1a2e"}, ${team.colors?.secondary ?? "#16213e"}40)`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden ${
                            isSelected ? "bg-white/20" : "bg-white/10"
                          }`}
                        >
                          <img
                            src={getTeamLogoPath(
                              team.id,
                              team.logo_url,
                              team.competition_id,
                            )}
                            alt={`${team.name} logo`}
                            className="w-10 h-10 object-contain"
                            loading="lazy"
                          />
                        </div>
                        <div>
                          <h3 className="font-heading font-bold text-white uppercase tracking-wide text-sm">
                            {team.name}
                          </h3>
                          <TeamLocation
                            city={team.city ?? team.country}
                            countryCode={team.country}
                            locale={i18n.language}
                            className="mt-0.5 text-xs text-gray-300"
                            iconClassName="w-3 h-3"
                            flagClassName="text-xs leading-none"
                          />
                        </div>
                      </div>
                      {isSelected && (
                        <Star className="w-5 h-5 text-accent-400 fill-current" />
                      )}
                    </div>
                  </div>

                  <CardBody className="p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <StatItem
                        icon={<Trophy className="w-3.5 h-3.5" />}
                        label={t("teamSelect.reputation")}
                        value={
                          <Badge variant={repInfo.variant} size="sm">
                            {repInfo.label}
                          </Badge>
                        }
                      />
                      <StatItem
                        icon={<Users className="w-3.5 h-3.5" />}
                        label={t("teamSelect.squad")}
                        value={
                          <span className="font-heading font-bold text-gray-800 dark:text-gray-200">
                            {playerCount != null ? playerCount : "—"}
                          </span>
                        }
                      />
                      <StatItem
                        icon={<Landmark className="w-3.5 h-3.5" />}
                        label={t("teamSelect.finances")}
                        value={
                          <span className="font-heading font-bold text-gray-800 dark:text-gray-200">
                            {team.finance != null
                              ? formatFinance(team.finance)
                              : "—"}
                          </span>
                        }
                      />
                      <StatItem
                        icon={<Star className="w-3.5 h-3.5" />}
                        label={t("teamSelect.avgOvr")}
                        value={
                          <span
                            className={`font-heading font-bold text-lg ${
                              legacyTeams || oldTeamData
                                ? avgOvr >= 70
                                  ? "text-primary-500"
                                  : avgOvr >= 55
                                    ? "text-accent-600 dark:text-accent-400"
                                    : "text-gray-500"
                                : "text-gray-400"
                            }`}
                          >
                            {legacyTeams || oldTeamData ? avgOvr : "—"}
                          </span>
                        }
                      />
                    </div>
                  </CardBody>
                </Card>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
        {icon} {label}
      </span>
      {value}
    </div>
  );
}
