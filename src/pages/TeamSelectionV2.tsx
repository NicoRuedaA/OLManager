import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

import type { LeagueSelectionData, GameStateData } from "@/store/gameStore";
import { useGameStore } from "@/store/gameStore";
import { LeaguePickerV2 } from "@/components/teamSelection/LeaguePickerV2";
import { TeamGridV2 } from "@/components/teamSelection/TeamGridV2";
import { loadLeagueSelectionData, selectTeam } from "@/components/teamSelection/teamSelection.helpers";

type Screen = "loading" | "error" | "league" | "teams";

export default function TeamSelectionV2() {
  const { t } = useTranslation();
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
      const updatedGame = await selectTeam(selectedTeamId);
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

  // League picker
  if (screen === "league" && leagueData) {
    return (
      <LeaguePickerV2
        competitions={leagueData.competitions}
        onSelect={handleLeagueSelect}
        onBack={handleBackToMenu}
      />
    );
  }

  // Team grid
  const selectedCompetition = leagueData?.competitions.find((c) => c.id === selectedCompetitionId);
  return (
    <TeamGridV2
      leagueName={selectedCompetition?.name ?? ""}
      teams={selectedCompetition?.teams ?? []}
      onSelectTeam={setSelectedTeamId}
      onBack={handleBackToLeagues}
      selectedTeamId={selectedTeamId}
      onConfirm={handleConfirm}
      isConfirming={isConfirming}
    />
  );
}
