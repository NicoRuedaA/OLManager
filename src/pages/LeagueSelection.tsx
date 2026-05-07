import { useState, useMemo, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGameStore } from "../store/gameStore";
import { Card, CardBody, ThemeToggle } from "../components/ui";
import {
  ArrowLeft,
  Search,
  Trophy,
  Globe,
  Loader2,
  ChevronRight,
  Check,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeagueOption {
  id: string;
  name: string;
  flag: string;
  region: string;
  tier: string;
  teamsCount: number;
  description: string;
}

interface LocationState {
  nickname?: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  nationality?: string;
}

// ---------------------------------------------------------------------------
// Available leagues
// ---------------------------------------------------------------------------

const AVAILABLE_LEAGUES: LeagueOption[] = [
  {
    id: "lec",
    name: "LEC",
    flag: "🇪🇺",
    region: "EMEA",
    tier: "Regional",
    teamsCount: 10,
    description: "Europe, Middle East & Africa — La liga europea de élite",
  },
  {
    id: "cblol",
    name: "CBLOL",
    flag: "🇧🇷",
    region: "BRAZIL",
    tier: "Regional",
    teamsCount: 10,
    description: "Campeonato Brasileño de League of Legends",
  },
];

const REGIONS = Array.from(new Set(AVAILABLE_LEAGUES.map((l) => l.region))).sort();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normaliseSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function canUseTauriInvoke(): boolean {
  if (import.meta.env.MODE === "test") return true;
  if (typeof window === "undefined") return false;
  const internals = (window as unknown as { __TAURI_INTERNALS__?: { invoke?: unknown } })
    .__TAURI_INTERNALS__;
  return typeof internals?.invoke === "function";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LeagueSelection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const setGameActive = useGameStore((state) => state.setGameActive);

  // Read form data from location state (forward nav) or sessionStorage (back nav recovery)
  const formData = useMemo<LocationState>(() => {
    const fromState = (location.state as LocationState) ?? {};
    if (fromState.firstName && fromState.lastName && fromState.dob && fromState.nationality) {
      return fromState;
    }
    // Fallback: recover from sessionStorage (survives back/forward navigation)
    try {
      const stored = sessionStorage.getItem("league-selection-form");
      if (stored) {
        const parsed = JSON.parse(stored) as LocationState;
        if (parsed.firstName && parsed.lastName && parsed.dob && parsed.nationality) {
          return parsed;
        }
      }
    } catch {
      // ignore parse errors
    }
    return {};
  }, [location.state]);

  // Redirect back to main menu if accessed directly without form data
  const hasFormData = !!(formData.firstName && formData.lastName && formData.dob && formData.nationality);
  useEffect(() => {
    if (!hasFormData) {
      navigate("/", { replace: true });
    }
  }, [hasFormData, navigate]);

  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Don't render while redirecting
  if (!hasFormData) return null;

  const selectedLeague = AVAILABLE_LEAGUES.find((l) => l.id === selectedId);

  const filtered = useMemo(() => {
    const q = normaliseSearchText(search);
    return AVAILABLE_LEAGUES.filter((league) => {
      if (q && !normaliseSearchText(league.name).includes(q) && !normaliseSearchText(league.region).includes(q)) {
        return false;
      }
      if (regionFilter !== "ALL" && league.region !== regionFilter) {
        return false;
      }
      return true;
    });
  }, [search, regionFilter]);

  const handleContinue = async () => {
    if (!selectedId || isStarting) return;
    setIsStarting(true);

    try {
      if (!canUseTauriInvoke()) {
        throw new Error(
          "Backend Tauri no disponible. Cierra cualquier `npm run tauri dev` suelto y ejecutá `npm run tauri dev`.",
        );
      }

      const worldSource = "lec-default";

      await invoke<string>("start_new_game", {
        nickname: formData.nickname ?? "",
        firstName: formData.firstName ?? "",
        lastName: formData.lastName ?? "",
        dob: formData.dob ?? "",
        nationality: formData.nationality ?? "",
        competitionId: selectedId,
        worldSource,
        avatarPath: null,
      });

      const displayName =
        formData.nickname?.trim() || `${formData.firstName ?? ""} ${formData.lastName ?? ""}`.trim();
      setGameActive(true, displayName);
      console.debug(
        "[LeagueSelection] start_new_game completed, navigating to /select-team",
      );
      navigate("/select-team");
    } catch (error) {
      console.error("Failed to start game:", error);
      alert(t("menu.failedStartGame", { error: String(error) }));
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-navy-900 transition-colors duration-300">
      {/* Header */}
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
              {t("leagueSelect.title", "Seleccionar Liga")}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t("leagueSelect.subtitle", "Elegí tu competición para empezar")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {selectedLeague && (
            <button
              onClick={handleContinue}
              disabled={isStarting}
              className={`bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white px-6 py-2.5 rounded-lg font-heading font-bold uppercase tracking-wider text-sm shadow-md hover:shadow-lg hover:shadow-primary-500/20 transition-all flex items-center gap-2 ${isStarting ? "opacity-70 cursor-wait" : ""}`}
            >
              <span>
                {isStarting
                  ? t("worldSelect.creatingWorld", "Iniciando...")
                  : `${selectedLeague.flag} ${t("leagueSelect.continue", "Continuar")}`}
              </span>
              {isStarting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="max-w-5xl mx-auto p-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex items-center gap-1">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-500 text-white text-xs font-bold">
              ✓
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-heading uppercase tracking-wide">
              {t("createManager.title", "Head Coach")}
            </span>
          </div>
          <div className="w-8 h-px bg-gray-300 dark:bg-navy-600" />
          <div className="flex items-center gap-1">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-500 text-white text-xs font-bold">
              2
            </div>
            <span className="text-xs text-primary-400 font-heading uppercase tracking-wide">
              {t("leagueSelect.title", "Liga")}
            </span>
          </div>
          <div className="w-8 h-px bg-gray-300 dark:bg-navy-600" />
          <div className="flex items-center gap-1">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-300 dark:bg-navy-600 text-white text-xs font-bold">
              3
            </div>
            <span className="text-xs text-gray-400 font-heading uppercase tracking-wide">
              {t("teamSelect.title", "Equipo")}
            </span>
          </div>
        </div>

        {/* Search + Filter bar — como ChampionsGrid */}
        <div className="flex flex-wrap gap-3 items-center mb-6">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("leagueSelect.searchPlaceholder", "Buscar liga...")}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-600 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            />
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setRegionFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold uppercase tracking-wider transition-all ${
                regionFilter === "ALL"
                  ? "bg-primary-500 text-white shadow-sm"
                  : "bg-white dark:bg-navy-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-navy-600 hover:bg-gray-50 dark:hover:bg-navy-700"
              }`}
            >
              <Globe className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              {t("leagueSelect.all", "Todas")}
            </button>
            {REGIONS.map((region) => (
              <button
                key={region}
                onClick={() => setRegionFilter(regionFilter === region ? "ALL" : region)}
                className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold uppercase tracking-wider transition-all ${
                  regionFilter === region
                    ? "bg-primary-500 text-white shadow-sm"
                    : "bg-white dark:bg-navy-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-navy-600 hover:bg-gray-50 dark:hover:bg-navy-700"
                }`}
              >
                {region}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <p className="text-xs text-gray-400 dark:text-gray-500 font-heading uppercase tracking-wider mb-4">
          <Trophy className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
          {filtered.length}{" "}
          {filtered.length === 1
            ? t("leagueSelect.league", "liga")
            : t("leagueSelect.leagues", "ligas")}{" "}
          {t("leagueSelect.found", "disponible(s)")}
        </p>

        {/* League grid */}
        {filtered.length === 0 && (
          <Card>
            <CardBody>
              <p className="text-center text-gray-400 dark:text-gray-500 py-8">
                {t("leagueSelect.noResults", "No se encontraron ligas")}
              </p>
            </CardBody>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((league) => {
            const isSelected = selectedId === league.id;

            return (
              <button
                key={league.id}
                type="button"
                onClick={() => !isStarting && setSelectedId(league.id)}
                disabled={isStarting}
                className={`text-left transition-all duration-200 rounded-xl ${
                  isSelected
                    ? "ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-navy-900 scale-[1.02]"
                    : "hover:scale-[1.01]"
                } ${isStarting && !isSelected ? "opacity-50 pointer-events-none" : ""}`}
              >
                <Card
                  accent={isSelected ? "primary" : "none"}
                  className="h-full"
                >
                  <CardBody className="p-5">
                    <div className="flex items-start gap-4">
                      {/* League flag — large */}
                      <div
                        className={`w-16 h-16 rounded-xl flex items-center justify-center text-3xl shrink-0 ${
                          isSelected
                            ? "bg-primary-50 dark:bg-primary-500/10 ring-2 ring-primary-500"
                            : "bg-gray-50 dark:bg-navy-800 border border-gray-200 dark:border-navy-600"
                        }`}
                      >
                        {league.flag}
                      </div>

                      {/* League info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-heading font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide">
                            {league.name}
                          </h3>
                          {isSelected && (
                            <Check className="w-4 h-4 text-primary-500 shrink-0" />
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-navy-700 px-2 py-0.5 text-[11px] font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                            <Globe className="w-3 h-3" />
                            {league.region}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-navy-700 px-2 py-0.5 text-[11px] font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                            <Trophy className="w-3 h-3" />
                            {league.tier}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-navy-700 px-2 py-0.5 text-[11px] font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                            {league.teamsCount} equipos
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          {league.description}
                        </p>
                      </div>

                      {/* Action indicator */}
                      <div className="shrink-0 self-center">
                        {isSelected ? (
                          <Check className="w-5 h-5 text-primary-500" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                        )}
                      </div>
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
