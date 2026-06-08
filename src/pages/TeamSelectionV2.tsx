import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Loader2, Trophy } from "lucide-react";

import type { LeagueSelectionData, GameStateData } from "@/store/gameStore";
import { useGameStore } from "@/store/gameStore";
import { LeaguePickerV2 } from "@/components/teamSelection/LeaguePickerV2";
import { TeamGridV2 } from "@/components/teamSelection/TeamGridV2";
import { loadLeagueSelectionData, selectTeam } from "@/components/teamSelection/teamSelection.helpers";

type Screen = "loading" | "error" | "league" | "teams";

export default function TeamSelectionV2() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setGameState, setGameActive } = useGameStore();

  const [screen, setScreen] = useState<Screen>("loading");
  const [error, setError] = useState<string | null>(null);
  const [leagueData, setLeagueData] = useState<LeagueSelectionData | null>(null);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    loadLeagueSelectionData()
      .then((data) => {
        setLeagueData(data);
        setScreen(data.competitions.length > 0 ? "league" : "error");
      })
      .catch((err) => {
        console.error("Failed to load league data:", err);
        setError(String(err));
        setScreen("error");
      });
  }, []);

  const handleLeagueSelect = (id: string) => {
    setSelectedCompetitionId(id);
    setSelectedTeamId(null);
    setScreen("teams");
  };

  const handleBackToLeagues = () => {
    setSelectedCompetitionId(null);
    setSelectedTeamId(null);
    setScreen("league");
  };

  const handleBackToMenu = () => navigate("/");

  const handleConfirm = async () => {
    if (!selectedTeamId || isConfirming) return;
    setIsConfirming(true);
    try {
      const updatedGame = await selectTeam(selectedTeamId, i18n.language);
      setGameState(updatedGame);
      const mgr = updatedGame.manager;
      const displayName = mgr.nickname?.trim() || `${mgr.first_name} ${mgr.last_name}`;
      setGameActive(true, displayName);
      navigate("/dashboard");
    } catch (err) {
      console.error("Failed to select team:", err);
      alert("Failed to select team: " + String(err));
    } finally {
      setIsConfirming(false);
    }
  };

  // Loading
  if (screen === "loading") {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t("worldSelect.creatingWorld")}</p>
        </div>
      </div>
    );
  }

  // Error
  if (screen === "error") {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="mx-auto max-w-md p-8 text-center">
          <p className="mb-4 text-sm text-red-400">{error || t("teamSelect.noLeaguesDesc")}</p>
          <button
            type="button"
            onClick={handleBackToMenu}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {t("common.backToMenu", "Back to menu")}
          </button>
        </div>
      </div>
    );
  }

  const selectedCompetition = leagueData?.competitions.find((c) => c.id === selectedCompetitionId);
  const isLeagueScreen = screen === "league" && leagueData;

  // League picker / Team grid — persistent header + swap content
  return (
    <div className="flex h-full flex-col bg-background">
      {/* Persistent header */}
      <header className="relative flex h-14 shrink-0 items-center border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-6">
        <button
          type="button"
          onClick={isLeagueScreen ? handleBackToMenu : handleBackToLeagues}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="ml-3 flex flex-1 items-center justify-between">
          <div>
            <h1 className="font-heading text-lg font-black uppercase tracking-widest text-foreground">
              {isLeagueScreen
                ? t("teamSelect.selectLeague", "Select League")
                : selectedCompetition?.name ?? ""}
            </h1>
            <p className="text-xs text-muted-foreground/70">
              {isLeagueScreen
                ? t("teamSelect.selectLeagueSubtitle", "Choose a competition")
                : t("teamSelect.selectTeam", "Elige un equipo")}
            </p>
          </div>
          {!isLeagueScreen && selectedTeamId && (
            <button
              type="button"
              disabled={isConfirming}
              onClick={handleConfirm}
              className="flex h-8 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 disabled:pointer-events-none disabled:opacity-50"
            >
              {isConfirming ? <Loader2 className="size-4 animate-spin" /> : <Trophy className="size-4" />}
              {t("teamSelect.confirm", "Confirmar")}
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      {isLeagueScreen ? (
        <LeaguePickerV2
          competitions={leagueData.competitions}
          onSelect={handleLeagueSelect}
        />
      ) : (
        <TeamGridV2
          teams={selectedCompetition?.teams ?? []}
          onSelectTeam={setSelectedTeamId}
          selectedTeamId={selectedTeamId}
        />
      )}
    </div>
  );
}
