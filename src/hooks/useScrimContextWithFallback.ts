import { useEffect, useState } from "react";

import type { GameStateData } from "../store/gameStore";
import { normalizeBackendScrimContext, type ScrimContextResponse } from "../lib/scrims/scrimContext";
import { getScrimContext } from "../services/trainingService";

export function useScrimContextWithFallback(gameState: GameStateData): ScrimContextResponse | null {
  const [remoteScrimContext, setRemoteScrimContext] = useState<ScrimContextResponse | null>(null);

  useEffect(() => {
    let active = true;
    void getScrimContext()
      .then((payload) => {
        if (!active) return;
        setRemoteScrimContext(normalizeBackendScrimContext(payload));
      })
      .catch(() => {
        if (!active) return;
        setRemoteScrimContext(null);
      });
    return () => {
      active = false;
    };
  }, [gameState.clock.current_date, gameState.day_phase, gameState.teams]);

  return remoteScrimContext;
}

