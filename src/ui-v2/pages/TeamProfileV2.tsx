import type { GameStateData } from "@/store/gameStore";
import TeamProfile from "@/ui-v2/_legacy/components/teamProfile/TeamProfile";

interface TeamProfileV2Props {
  gameState: GameStateData;
  teamId: string;
  onClose: () => void;
  onSelectPlayer?: (id: string) => void;
}

export default function TeamProfileV2({
  gameState,
  teamId,
  onClose,
  onSelectPlayer,
}: TeamProfileV2Props) {
  const team = gameState.teams.find((t) => t.id === teamId);
  if (!team) return null;

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-v2">
      <TeamProfile
        team={team}
        gameState={gameState}
        isOwnTeam={team.id === gameState.manager.team_id}
        onClose={onClose}
        onSelectPlayer={onSelectPlayer}
      />
    </div>
  );
}
