import { Bug } from "lucide-react";
import { useState, type JSX } from "react";

import ReportBugModal from "./ReportBugModal";
import { useGameStore } from "../../store/gameStore";
import { APP_VERSION } from "../../lib/appInfo";
import { getManagerTeamName } from "../dashboard/dashboardHelpers";

export default function FloatingBugButton(): JSX.Element | null {
  const gameState = useGameStore((s) => s.gameState);
  const [show, setShow] = useState(false);

  if (!gameState) return null;

  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="fixed bottom-6 right-6 z-[9999] flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-lg transition-all hover:scale-110 hover:shadow-xl active:scale-95"
        title="Reportar Bug"
      >
        <Bug className="h-5 w-5" />
      </button>

      {show && (
        <ReportBugModal
          context={{
            appVersion: APP_VERSION,
            activeTab: "",
            currentDate: gameState.clock.current_date,
            dayPhase: gameState.day_phase ?? "Unknown",
            teamName: getManagerTeamName(gameState) ?? "Unknown",
            leagueName: gameState.leagues?.[0]?.name ?? "Unknown",
            lolPatch: gameState.champion_patch?.current_patch_label ?? "Unknown",
          }}
          saveJson={JSON.stringify(gameState, null, 2)}
          onClose={() => setShow(false)}
        />
      )}
    </>
  );
}
