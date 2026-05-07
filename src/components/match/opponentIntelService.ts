import type { GameStateData } from "../../store/gameStore";
import { rankBanCandidates } from "./draftIntelHelpers";

export interface OpponentIntelChampion {
  championId: string;
  championName: string;
  mastery: number;
  metaScore: number;
  threatScore: number;
}

export interface OpponentIntelPlayerPool {
  playerName: string;
  role: string;
  champions: OpponentIntelChampion[];
}

export interface OpponentIntelSnapshot {
  playerPools: OpponentIntelPlayerPool[];
  masteryHighlights: OpponentIntelChampion[];
  suggestedBans: OpponentIntelChampion[];
  metaThreats: OpponentIntelChampion[];
  confidence: {
    mappedPlayers: number;
    totalPlayers: number;
    poolCoveragePct: number;
    qualityLabel: "low" | "medium" | "high";
  };
}

interface PlayerSeed {
  ign: string;
  teamId: string;
  role: string;
  champions: Array<Array<string | number>>;
}

interface TeamSeed {
  id: string;
  name: string;
}

interface ChampionSeed {
  id: string;
  name: string;
  roleHints?: string[];
}

interface IntelQualityProfile {
  revealRatio: number;
  masteryNoise: number;
  metaNoise: number;
  qualityLabel: "low" | "medium" | "high";
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tierToMetaScore(tier: string): number {
  switch (tier) {
    case "S": return 20;
    case "A": return 15;
    case "B": return 10;
    case "C": return 6;
    case "D": return 3;
    default: return 8;
  }
}

function hash01(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function computeIntelQuality(gameState: GameStateData): IntelQualityProfile {
  const userTeamId = gameState.manager.team_id;
  if (!userTeamId) {
    return { revealRatio: 0.45, masteryNoise: 16, metaNoise: 6, qualityLabel: "low" };
  }

  const teamStaff = (gameState.staff ?? []).filter((member) => member.team_id === userTeamId);
  const analystPool = teamStaff.filter((member) => member.role === "Scout" || member.role === "AssistantManager");
  if (analystPool.length === 0) {
    return { revealRatio: 0.45, masteryNoise: 16, metaNoise: 6, qualityLabel: "low" };
  }

  const score = analystPool.reduce((acc, member) => {
    const analysis = member.attributes.judging_ability;
    const potential = member.attributes.judging_potential;
    const coaching = member.attributes.coaching;
    const weight = member.role === "AssistantManager" ? 0.6 : 1.0;
    return acc + ((analysis * 0.5) + (potential * 0.3) + (coaching * 0.2)) * weight;
  }, 0) / analystPool.reduce((acc, member) => acc + (member.role === "AssistantManager" ? 0.6 : 1.0), 0);

  if (score >= 78) {
    return { revealRatio: 0.95, masteryNoise: 4, metaNoise: 1, qualityLabel: "high" };
  }
  if (score >= 58) {
    return { revealRatio: 0.75, masteryNoise: 9, metaNoise: 3, qualityLabel: "medium" };
  }
  return { revealRatio: 0.5, masteryNoise: 14, metaNoise: 5, qualityLabel: "low" };
}

export function buildOpponentIntel(params: {
  gameState: GameStateData;
  opponentTeamName: string;
  opponentPlayers: ReadonlyArray<{ id: string; name: string }>;
  teamSeeds: ReadonlyArray<TeamSeed>;
  playerSeeds: ReadonlyArray<PlayerSeed>;
  championSeeds: ReadonlyArray<ChampionSeed>;
  enemyMasteryWeight?: number;
  metaWeight?: number;
}): OpponentIntelSnapshot {
  const {
    gameState,
    opponentTeamName,
    opponentPlayers,
    teamSeeds,
    playerSeeds,
    championSeeds,
    enemyMasteryWeight = 1.15,
    metaWeight = 0.9,
  } = params;

  const quality = computeIntelQuality(gameState);

  const teamSeed = teamSeeds.find((team) => normalizeKey(team.name) === normalizeKey(opponentTeamName));
  const playerSeedByIgn = new Map<string, PlayerSeed>();
  playerSeeds
    .filter((seed) => !teamSeed || seed.teamId === teamSeed.id)
    .forEach((seed) => playerSeedByIgn.set(normalizeKey(seed.ign), seed));

  const championByName = new Map<string, ChampionSeed>();
  const championById = new Map<string, ChampionSeed>();
  championSeeds.forEach((champion) => {
    championByName.set(normalizeKey(champion.name), champion);
    championById.set(normalizeKey(champion.id), champion);
  });

  const metaByChampion = new Map<string, number>();
  (gameState.champion_patch?.hidden_meta ?? []).forEach((entry) => {
    metaByChampion.set(normalizeKey(entry.champion_id), tierToMetaScore(String(entry.tier ?? "B")));
  });

  const runtimeMasteryByPlayerId = new Map<string, Map<string, number>>();
  (gameState.champion_masteries ?? []).forEach((entry) => {
    const key = entry.player_id;
    const current = runtimeMasteryByPlayerId.get(key) ?? new Map<string, number>();
    current.set(normalizeKey(entry.champion_id), Number(entry.mastery ?? 25));
    runtimeMasteryByPlayerId.set(key, current);
  });

  const playerPools: OpponentIntelPlayerPool[] = opponentPlayers.map((player) => {
    const seed = playerSeedByIgn.get(normalizeKey(player.name));
    const role = seed?.role ?? "Unknown";

    const fromSeed = (seed?.champions ?? []).map((entry) => {
      const championName = String(entry[0] ?? "");
      const mastery = Number(entry[1] ?? 0);
      const champion = championByName.get(normalizeKey(championName));
      if (!champion) return null;
      const baseMeta = metaByChampion.get(normalizeKey(champion.id)) ?? 8;
      const metaNoiseRoll = hash01(`${player.id}|${champion.id}|meta`) - 0.5;
      const revealRoll = hash01(`${player.id}|${champion.id}|reveal`);
      if (revealRoll > quality.revealRatio) return null;
      const meta = Math.max(1, Math.round(baseMeta + metaNoiseRoll * quality.metaNoise));
      const masteryNoiseRoll = hash01(`${player.id}|${champion.id}|mastery`) - 0.5;
      const noisyMastery = Math.min(100, Math.max(1, Math.round(mastery + masteryNoiseRoll * quality.masteryNoise)));
      return {
        championId: champion.id,
        championName: champion.name,
        mastery: noisyMastery,
        metaScore: meta,
        threatScore: noisyMastery * enemyMasteryWeight + meta * metaWeight,
      };
    }).filter((entry): entry is OpponentIntelChampion => Boolean(entry));

    const runtime = runtimeMasteryByPlayerId.get(player.id);
    if (!runtime || runtime.size === 0) {
      return {
        playerName: player.name,
        role,
        champions: fromSeed.sort((a, b) => b.mastery - a.mastery).slice(0, 3),
      };
    }

    const runtimeChampions = [...runtime.entries()]
      .map(([championIdKey, mastery]) => {
        const champion = championById.get(championIdKey);
        if (!champion) return null;
        const revealRoll = hash01(`${player.id}|${champion.id}|reveal`);
        if (revealRoll > quality.revealRatio) return null;
        const baseMeta = metaByChampion.get(championIdKey) ?? 8;
        const metaNoiseRoll = hash01(`${player.id}|${champion.id}|meta`) - 0.5;
        const meta = Math.max(1, Math.round(baseMeta + metaNoiseRoll * quality.metaNoise));
        const masteryNoiseRoll = hash01(`${player.id}|${champion.id}|mastery`) - 0.5;
        const noisyMastery = Math.min(100, Math.max(1, Math.round(mastery + masteryNoiseRoll * quality.masteryNoise)));
        return {
          championId: champion.id,
          championName: champion.name,
          mastery: noisyMastery,
          metaScore: meta,
          threatScore: noisyMastery * enemyMasteryWeight + meta * metaWeight,
        };
      })
      .filter((entry): entry is OpponentIntelChampion => Boolean(entry))
      .sort((a, b) => b.mastery - a.mastery)
      .slice(0, 3);

    return {
      playerName: player.name,
      role,
      champions: runtimeChampions.length > 0 ? runtimeChampions : fromSeed.sort((a, b) => b.mastery - a.mastery).slice(0, 3),
    };
  });

  const allChampions = playerPools.flatMap((pool) => pool.champions);
  const uniqueById = new Map<string, OpponentIntelChampion>();
  allChampions.forEach((champion) => {
    const existing = uniqueById.get(champion.championId);
    if (!existing || champion.threatScore > existing.threatScore) {
      uniqueById.set(champion.championId, champion);
    }
  });
  const uniqueChampions = [...uniqueById.values()];

  const enemyCoveredRoles = new Set<string>(
    playerPools
      .filter((pool) => pool.role !== "Unknown")
      .map((pool) => pool.role.toUpperCase()),
  );
  const availableForBans = uniqueChampions.map((champion) => ({
    championId: champion.championId,
    roleHints: championById.get(normalizeKey(champion.championId))?.roleHints ?? [],
  }));
  const championByIntelId = new Map(uniqueChampions.map((champion) => [champion.championId, champion]));

  const suggestedBans = rankBanCandidates({
    available: availableForBans,
    enemyCoveredRoles,
    resolveEnemyMastery: (championId) => championByIntelId.get(championId)?.mastery ?? 25,
    resolveMetaScore: (championId) => championByIntelId.get(championId)?.metaScore ?? 8,
    resolveScoringContext: (candidate) => {
      const intelRow = championByIntelId.get(candidate.championId);
      const mastery = intelRow?.mastery ?? 25;
      return {
        roleAlreadyCovered: candidate.roleHints.length > 0
          && candidate.roleHints.every((role) => enemyCoveredRoles.has(role.toUpperCase())),
        enemyJungleLocked: enemyCoveredRoles.has("JUNGLE"),
        isFlexThreat: candidate.roleHints.length >= 2,
        isSpecialThreat: mastery >= 97,
        draftHashSeed: `${opponentTeamName}:${quality.qualityLabel}:${candidate.championId}`,
      };
    },
  })
    .slice(0, 5)
    .map((row) => championByIntelId.get(row.championId))
    .filter((entry): entry is OpponentIntelChampion => Boolean(entry));

  const mappedPlayers = playerPools.filter((pool) => pool.champions.length > 0).length;
  const coveragePct = opponentPlayers.length === 0 ? 0 : Math.round((mappedPlayers / opponentPlayers.length) * 100);

  return {
    playerPools,
    masteryHighlights: uniqueChampions.slice().sort((a, b) => b.mastery - a.mastery).slice(0, 5),
    suggestedBans,
    metaThreats: uniqueChampions.slice().sort((a, b) => b.metaScore - a.metaScore).slice(0, 5),
    confidence: {
      mappedPlayers,
      totalPlayers: opponentPlayers.length,
      poolCoveragePct: coveragePct,
      qualityLabel:
        coveragePct >= 80
          ? quality.qualityLabel === "low" ? "medium" : "high"
          : coveragePct >= 50
            ? quality.qualityLabel
            : "low",
    },
  };
}
