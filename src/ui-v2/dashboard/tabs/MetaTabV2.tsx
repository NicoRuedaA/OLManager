import { useMemo, useState } from "react";
import { Search, User } from "lucide-react";

import type { GameStateData } from "@/store/gameStore";
import championsSeed from "../../../../assets/simulation/champions.json";
import {
  setPlayerChampionTrainingTarget,
  delegateChampionTraining,
} from "@/services/playerService";
import { calculateLolOvr } from "@/lib/players/lolPlayerStats";
import {
  formatStaffEffectPercent,
  getLolStaffEffectsForTeam,
} from "@/lib/teams/lolStaffEffects";
import { resolvePlayerPhoto } from "@/lib/players/playerPhotos";
import { ROLE_ICON_PATHS } from "@/lib/players/roleIcons";
import { resolvePlayerCurrentLolRole } from "@/lib/players/lolIdentity";
import { normalizeChampionKey } from "@/lib/champions/championIds";
import { resolveChampionTile } from "@/lib/champions/championImages";

import { Badge } from "@/ui-v2/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui-v2/components/ui/card";
import { cn } from "@/ui-v2/lib/utils";

interface MetaTabV2Props {
  gameState: GameStateData;
  onGameUpdate: (state: GameStateData) => void;
  onViewChampion: (championKey: string) => void;
}

type ChampionRolesMap = Record<string, string[]>;
type UiRole = "Top" | "Jungle" | "Mid" | "ADC" | "Support";

const CHAMPION_ROLES: ChampionRolesMap =
  ((championsSeed as { data?: { roles?: ChampionRolesMap } }).data?.roles ?? {}) as ChampionRolesMap;

const ROLE_ORDER: Record<UiRole, number> = { Top: 1, Jungle: 2, Mid: 3, ADC: 4, Support: 5 };

const ROLE_ICON_URLS: Record<UiRole, string> = {
  Top: ROLE_ICON_PATHS.TOP,
  Jungle: ROLE_ICON_PATHS.JUNGLE,
  Mid: ROLE_ICON_PATHS.MID,
  ADC: ROLE_ICON_PATHS.ADC,
  Support: ROLE_ICON_PATHS.SUPPORT,
};

const CHAMPIONS_BY_ROLE = Object.entries(CHAMPION_ROLES).reduce<Record<UiRole, string[]>>(
  (acc, [champion, roles]) => {
    roles.forEach((role) => {
      const mapped = role === "Bot" ? "ADC" : role;
      if (!["Top", "Jungle", "Mid", "ADC", "Support"].includes(mapped)) return;
      const key = mapped as UiRole;
      if (!acc[key]) acc[key] = [];
      acc[key].push(champion);
    });
    return acc;
  },
  { Top: [], Jungle: [], Mid: [], ADC: [], Support: [] },
);

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeRole(role: string): UiRole {
  const key = normalizeKey(role);
  if (key === "top") return "Top";
  if (key === "jungle") return "Jungle";
  if (key === "mid") return "Mid";
  if (key === "bot" || key === "adc") return "ADC";
  return "Support";
}

function toUiRole(role: ReturnType<typeof resolvePlayerCurrentLolRole>): UiRole {
  if (role === "TOP") return "Top";
  if (role === "JUNGLE") return "Jungle";
  if (role === "MID") return "Mid";
  if (role === "ADC") return "ADC";
  return "Support";
}

function championDisplayName(championId: string): string {
  if (normalizeChampionKey(championId) === "MonkeyKing") return "Wukong";
  return championId;
}

type SoloQTier = "Challenger" | "Grandmaster" | "Master";

const SOLOQ_POINTS_BASELINE = 3000;
const SOLOQ_POINTS_MIN = 3000;
const SOLOQ_POINTS_MAX = 7000;
const SOLOQ_GRANDMASTER_LP_CUTOFF = 800;
const SOLOQ_CHALLENGER_LP_CUTOFF = 1300;
const SCHEDULE_TRAINING_DAYS: Record<string, number[]> = {
  Intense: [0, 1, 2, 3, 4, 5],
  Balanced: [0, 1, 3, 4],
  Light: [1, 3],
};

function hashText(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / (24 * 60 * 60 * 1000)));
}

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function weekdayFromIso(iso: string): number {
  const date = new Date(iso);
  return (date.getUTCDay() + 6) % 7;
}

function isSoloQDay(dateIso: string, schedule: string): boolean {
  const activeDays = SCHEDULE_TRAINING_DAYS[schedule] ?? SCHEDULE_TRAINING_DAYS.Balanced;
  return activeDays.includes(weekdayFromIso(dateIso));
}

function intensityMultiplier(intensity: string): number {
  if (intensity === "High") return 1.25;
  if (intensity === "Low") return 0.75;
  return 1.0;
}

function getFocusMultiplier(focus: string | null | undefined): number {
  if (!focus) return 0.85;
  if (focus === "ChampionPoolPractice") return 1.25;
  if (focus === "IndividualCoaching") return 1.0;
  if (focus === "Scrims") return 0.85;
  if (focus === "MacroSystems") return 0.75;
  if (focus === "VODReview") return 0.7;
  return 0.85;
}

function computeSoloQ(
  player: GameStateData["players"][number],
  gameState: GameStateData,
  masterySignal: number,
  focus: string | null | undefined,
  intensity: string,
  schedule: string,
): { tier: SoloQTier; lp: number; delta: number } {
  const ovr = calculateLolOvr(player);
  const dayIndex = daysBetween(gameState.clock.start_date, gameState.clock.current_date);
  const baseline = 3520 + (ovr - 76) * 52 + ((hashText(player.id) % 121) - 60);

  let points = baseline;
  const focusMult = getFocusMultiplier(focus);
  const intensityMultVar = intensityMultiplier(intensity);
  for (let day = 1; day <= dayIndex; day += 1) {
    const currentIso = addDays(gameState.clock.start_date, day);
    if (!isSoloQDay(currentIso, schedule)) continue;
    const baseGain = 10 + ((ovr - 75) * 0.8) + (masterySignal * 0.08);
    const gain = Math.round(baseGain * intensityMultVar * focusMult);
    points += Math.max(-20, Math.min(30, gain));
    points = Math.max(SOLOQ_POINTS_MIN, Math.min(SOLOQ_POINTS_MAX, points));
  }

  const lp = Math.max(0, Math.round(points - SOLOQ_POINTS_BASELINE));

  let yesterdayDelta = 0;
  if (dayIndex > 0) {
    const yesterdayIso = addDays(gameState.clock.start_date, dayIndex);
    if (isSoloQDay(yesterdayIso, schedule)) {
      const baseGain = 10 + ((ovr - 75) * 0.8) + (masterySignal * 0.08);
      yesterdayDelta = Math.max(-20, Math.min(30, Math.round(baseGain * intensityMultVar * focusMult)));
    }
  }

  if (lp >= SOLOQ_CHALLENGER_LP_CUTOFF) return { tier: "Challenger", lp, delta: yesterdayDelta };
  if (lp >= SOLOQ_GRANDMASTER_LP_CUTOFF) return { tier: "Grandmaster", lp, delta: yesterdayDelta };
  return { tier: "Master", lp, delta: yesterdayDelta };
}

function soloQMasteryMultiplier(tier: SoloQTier): number {
  if (tier === "Challenger") return 1.2;
  if (tier === "Grandmaster") return 1.0;
  return 0.8;
}

function expectedGainBadge(slotIndex: number, focus: string | null | undefined): {
  label: string;
  baseMult: number;
} {
  const priorityWeight = [1.0, 0.65, 0.4][slotIndex] ?? 0.35;
  const focusMult = getFocusMultiplier(focus);
  const labels = ["high", "moderate", "low"];
  return { label: labels[slotIndex] ?? "low", baseMult: priorityWeight * focusMult };
}

const TIER_ORDER: Array<"S" | "A" | "B" | "C" | "D"> = ["S", "A", "B", "C", "D"];
const TIER_SORT_WEIGHT: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 };

const TIER_BADGE_CLASS: Record<string, string> = {
  S: "border-orange-500/40 bg-orange-500/10 text-orange-400",
  A: "border-red-500/40 bg-red-500/10 text-red-400",
  B: "border-violet-500/40 bg-violet-500/10 text-violet-400",
  C: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  D: "border-zinc-500/40 bg-zinc-500/10 text-zinc-400",
};

const SOLOQ_TIER_COLORS: Record<SoloQTier, string> = {
  Challenger: "text-yellow-400",
  Grandmaster: "text-red-400",
  Master: "text-fuchsia-400",
};

const SOLOQ_EMBLEM_URLS: Record<SoloQTier, string> = {
  Challenger:
    "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/challenger.png",
  Grandmaster:
    "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/grandmaster.png",
  Master:
    "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/master.png",
};

export function MetaTabV2({ gameState, onGameUpdate, onViewChampion }: MetaTabV2Props) {
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [metaRoleFilter, setMetaRoleFilter] = useState<"ALL" | UiRole>("ALL");
  const [delegating, setDelegating] = useState(false);

  const managerTeamId = gameState.manager.team_id;
  const patch = gameState.champion_patch;
  const staffEffects = getLolStaffEffectsForTeam(gameState, managerTeamId);

  const managerTeam = useMemo(
    () => gameState.teams.find((team) => team.id === managerTeamId) ?? null,
    [gameState.teams, managerTeamId],
  );

  const ownPlayers = useMemo(() => {
    if (!managerTeamId) return [];
    const roleOf = (player: GameStateData["players"][number]) =>
      toUiRole(resolvePlayerCurrentLolRole(player, managerTeam));

    return gameState.players
      .filter((player) => player.team_id === managerTeamId)
      .sort((a, b) => {
        const roleDiff = ROLE_ORDER[roleOf(a)] - ROLE_ORDER[roleOf(b)];
        if (roleDiff !== 0) return roleDiff;
        return a.match_name.localeCompare(b.match_name);
      });
  }, [gameState.players, managerTeam, managerTeamId]);

  const masteryMap = useMemo(() => {
    const map = new Map<string, number>();
    (gameState.champion_masteries ?? []).forEach((entry) => {
      map.set(`${entry.player_id}:${normalizeKey(entry.champion_id)}`, entry.mastery);
    });
    return map;
  }, [gameState.champion_masteries]);

  const masterySignalByPlayer = useMemo(() => {
    const bucket = new Map<string, number[]>();
    (gameState.champion_masteries ?? []).forEach((entry) => {
      const list = bucket.get(entry.player_id) ?? [];
      list.push(Number(entry.mastery ?? 25));
      bucket.set(entry.player_id, list);
    });

    const signal = new Map<string, number>();
    bucket.forEach((values, playerId) => {
      const top = [...values].sort((a, b) => b - a).slice(0, 3);
      const avg = top.length > 0 ? top.reduce((sum, value) => sum + value, 0) / top.length : 25;
      signal.set(playerId, Math.max(0, avg - 60));
    });
    return signal;
  }, [gameState.champion_masteries]);

  const discoveredSet = useMemo(
    () => new Set((patch?.discovered_champion_ids ?? []).map(normalizeKey)),
    [patch?.discovered_champion_ids],
  );

  const discoveredTierByChampion = useMemo(() => {
    const map = new Map<string, string>();
    (patch?.hidden_meta ?? []).forEach((entry) => {
      const championKey = normalizeKey(entry.champion_id);
      if (!discoveredSet.has(championKey)) return;
      const tier = (entry.tier || "C").toUpperCase();
      const previous = map.get(championKey);
      if (!previous) {
        map.set(championKey, tier);
        return;
      }
      const previousWeight = TIER_SORT_WEIGHT[previous] ?? 99;
      const currentWeight = TIER_SORT_WEIGHT[tier] ?? 99;
      if (currentWeight < previousWeight) map.set(championKey, tier);
    });
    return map;
  }, [patch?.hidden_meta, discoveredSet]);

  const discoveredTierByRoleChampion = useMemo(() => {
    const map = new Map<string, string>();
    (patch?.hidden_meta ?? []).forEach((entry) => {
      const championKey = normalizeKey(entry.champion_id);
      if (!discoveredSet.has(championKey)) return;
      const role = normalizeRole(entry.role);
      const tier = (entry.tier || "C").toUpperCase();
      const key = `${role}:${championKey}`;
      const previous = map.get(key);
      if (!previous) {
        map.set(key, tier);
        return;
      }
      const previousWeight = TIER_SORT_WEIGHT[previous] ?? 99;
      const currentWeight = TIER_SORT_WEIGHT[tier] ?? 99;
      if (currentWeight < previousWeight) map.set(key, tier);
    });
    return map;
  }, [patch?.hidden_meta, discoveredSet]);

  const discoveredMeta = useMemo(() => {
    const all = (patch?.hidden_meta ?? []).filter((entry) =>
      discoveredSet.has(normalizeKey(entry.champion_id)),
    );
    if (metaRoleFilter !== "ALL") {
      return all.filter((entry) => normalizeRole(entry.role) === metaRoleFilter);
    }

    const dedupBestByChampion = new Map<string, (typeof all)[number]>();
    all.forEach((entry) => {
      const key = normalizeKey(entry.champion_id);
      const previous = dedupBestByChampion.get(key);
      if (!previous) {
        dedupBestByChampion.set(key, entry);
        return;
      }
      const previousWeight = TIER_SORT_WEIGHT[(previous.tier || "C").toUpperCase()] ?? 99;
      const currentWeight = TIER_SORT_WEIGHT[(entry.tier || "C").toUpperCase()] ?? 99;
      if (currentWeight < previousWeight) dedupBestByChampion.set(key, entry);
    });

    return [...dedupBestByChampion.values()];
  }, [patch?.hidden_meta, discoveredSet, metaRoleFilter]);

  const tierRows = useMemo(() => {
    const rows: Record<string, typeof discoveredMeta> = { S: [], A: [], B: [], C: [], D: [] };
    discoveredMeta.forEach((entry) => {
      const tier = (entry.tier || "C").toUpperCase();
      if (rows[tier]) rows[tier].push(entry);
    });
    TIER_ORDER.forEach((tier) => {
      rows[tier].sort((a, b) => a.champion_id.localeCompare(b.champion_id));
    });
    return rows;
  }, [discoveredMeta]);

  const discoveredPct = useMemo(() => {
    const totalChampionKeys = new Set(
      (patch?.hidden_meta ?? []).map((entry) => normalizeKey(entry.champion_id)),
    );
    if (totalChampionKeys.size === 0) return 0;
    const discoveredCount = [...discoveredSet].filter((key) => totalChampionKeys.has(key)).length;
    return Math.round((discoveredCount / totalChampionKeys.size) * 100);
  }, [patch?.hidden_meta, discoveredSet]);

  const discoveryPerTier = useMemo(() => {
    const byTier: Record<string, { total: Set<string>; discovered: Set<string> }> = { S: { total: new Set(), discovered: new Set() }, A: { total: new Set(), discovered: new Set() }, B: { total: new Set(), discovered: new Set() }, C: { total: new Set(), discovered: new Set() }, D: { total: new Set(), discovered: new Set() } };
    (patch?.hidden_meta ?? []).forEach((entry) => {
      const tier = (entry.tier || "C").toUpperCase();
      if (!byTier[tier]) return;
      const key = normalizeKey(entry.champion_id);
      byTier[tier].total.add(key);
      if (discoveredSet.has(key)) byTier[tier].discovered.add(key);
    });
    const result: Record<string, { total: number; discovered: number }> = {};
    TIER_ORDER.forEach((t) => {
      result[t] = { total: byTier[t].total.size, discovered: byTier[t].discovered.size };
    });
    return result;
  }, [patch?.hidden_meta, discoveredSet]);

  async function handleTrainingTargetChange(playerId: string, slotIndex: number, championId: string) {
    const key = `${playerId}:${slotIndex}`;
    setSubmittingKey(key);
    try {
      const updated = await setPlayerChampionTrainingTarget(
        playerId,
        slotIndex,
        championId.length > 0 ? championId : null,
      );
      onGameUpdate(updated);
    } finally {
      setSubmittingKey(null);
    }
  }

  async function handleDelegateTraining() {
    setDelegating(true);
    try {
      const updated = await delegateChampionTraining();
      onGameUpdate(updated);
    } finally {
      setDelegating(false);
    }
  }

  return (
    <div className="grid h-full grid-cols-2 grid-rows-[minmax(0,1fr)] gap-4 p-6">
      {/* ── Left column ── */}
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto scrollbar-v2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
              Patch Meta
            </CardTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{formatStaffEffectPercent(staffEffects.metaDiscovery)} discovery</span>
              <span className="text-border">·</span>
              <span>{formatStaffEffectPercent(staffEffects.development)} mastery</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {patch?.current_patch_label || "Unknown Patch"}
                </p>
                {patch?.last_patch_date && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Updated {patch.last_patch_date}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Search className="size-3.5 text-muted-foreground" />
                <span className="font-heading text-sm tabular-nums text-primary">{discoveredPct}%</span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${discoveredPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Role filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMetaRoleFilter("ALL")}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-heading uppercase tracking-wider transition-colors",
                  metaRoleFilter === "ALL"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-muted-foreground/50",
                )}
              >
                All
              </button>
              {(Object.keys(ROLE_ORDER) as UiRole[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setMetaRoleFilter(role)}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md border transition-colors",
                    metaRoleFilter === role
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-muted-foreground/50",
                  )}
                  title={role}
                >
                  <img src={ROLE_ICON_URLS[role]} alt={role} className="size-3.5 object-contain" />
                </button>
              ))}
            </div>

            {/* Tier grid */}
            <div className="space-y-1">
              {TIER_ORDER.map((tier) => (
                <div key={tier} className="grid grid-cols-[40px_1fr] overflow-hidden rounded-lg border border-border">
                  <div
                    className={cn(
                      "flex items-center justify-center text-base font-heading font-bold",
                      TIER_BADGE_CLASS[tier]?.split(" ").pop(),
                    )}
                  >
                    {tier}
                  </div>
                  <div className="min-h-[60px] bg-muted/30 p-2">
                    {tierRows[tier].length === 0 ? (
                      <p className="text-xs italic text-muted-foreground/50">—</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {tierRows[tier].map((entry) => (
                          <button
                            type="button"
                            key={`${tier}-${entry.champion_id}-${entry.role}`}
                            onClick={() => onViewChampion(entry.champion_id)}
                            className="group relative cursor-pointer"
                          >
                            <div className="size-[52px] overflow-hidden rounded-md border border-border transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-primary">
                              <img
                                src={resolveChampionTile(entry.champion_id) ?? ""}
                                alt={championDisplayName(entry.champion_id)}
                                className="size-full object-cover"
                                loading="lazy"
                                title={`${championDisplayName(entry.champion_id)} · ${entry.role}`}
                              />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Discovery Stats ── */}
        <Card className="flex-1 min-h-0">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
              Discovery Stats
            </CardTitle>
            <span className="font-heading text-xs tabular-nums text-primary">{discoveredPct}% complete</span>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {TIER_ORDER.map((tier) => {
                const stats = discoveryPerTier[tier];
                const pct = stats.total > 0 ? Math.round((stats.discovered / stats.total) * 100) : 0;
                return (
                  <div key={tier}>
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn("inline-flex size-5 items-center justify-center rounded text-[10px] font-heading font-bold", TIER_BADGE_CLASS[tier])}>{tier}</span>
                        <span className="text-xs text-muted-foreground">
                          {stats.discovered}/{stats.total}
                        </span>
                      </div>
                      <span className="font-heading text-xs tabular-nums text-muted-foreground">{pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          pct >= 100 ? "bg-emerald-400" : pct >= 50 ? "bg-primary" : "bg-muted-foreground/40",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Right column ── */}
      <div className="flex min-h-0 flex-col gap-4">
        <Card className="flex min-h-0 flex-col">
        <CardHeader className="flex-row items-center justify-between space-y-0 shrink-0">
          <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
            Mastery Training
          </CardTitle>
          <button
            type="button"
            onClick={handleDelegateTraining}
            disabled={delegating}
            className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-heading uppercase tracking-wider text-primary transition-all hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {delegating ? "Delegating..." : "Delegate to Coach"}
          </button>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 overflow-y-auto scrollbar-v2">
          {ownPlayers.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No players on your team.</p>
          )}
          {ownPlayers.map((player) => {
            const role = toUiRole(resolvePlayerCurrentLolRole(player, managerTeam));
            const roleChampions = CHAMPIONS_BY_ROLE[role] ?? [];
            const sortedRoleChampions = [...roleChampions].sort((a, b) => {
              const aKey = normalizeKey(a);
              const bKey = normalizeKey(b);
              const aMastery = masteryMap.get(`${player.id}:${aKey}`) ?? 25;
              const bMastery = masteryMap.get(`${player.id}:${bKey}`) ?? 25;
              if (aMastery !== bMastery) return bMastery - aMastery;
              const aTier =
                discoveredTierByRoleChampion.get(`${role}:${aKey}`) ??
                discoveredTierByChampion.get(aKey) ??
                "";
              const bTier =
                discoveredTierByRoleChampion.get(`${role}:${bKey}`) ??
                discoveredTierByChampion.get(bKey) ??
                "";
              const aTierWeight = TIER_SORT_WEIGHT[aTier] ?? 99;
              const bTierWeight = TIER_SORT_WEIGHT[bTier] ?? 99;
              if (aTierWeight !== bTierWeight) return aTierWeight - bTierWeight;
              return a.localeCompare(b);
            });

            const targetsRaw = player.champion_training_targets ?? [];
            const legacy = player.champion_training_target ?? "";
            const targets = [targetsRaw[0] ?? legacy, targetsRaw[1] ?? "", targetsRaw[2] ?? ""];
            const effectiveFocus = player.training_focus ?? managerTeam?.training_focus ?? null;
            const effectiveIntensity = managerTeam?.training_intensity ?? "Medium";
            const effectiveSchedule = managerTeam?.training_schedule ?? "Balanced";
            const soloQ = computeSoloQ(
              player,
              gameState,
              masterySignalByPlayer.get(player.id) ?? 0,
              effectiveFocus,
              effectiveIntensity,
              effectiveSchedule,
            );
            const soloQMult = soloQMasteryMultiplier(soloQ.tier);

            return (
              <div
                key={player.id}
                className="rounded-xl border border-border bg-muted/20 p-3 transition-all hover:border-muted-foreground/30"
              >
                {/* Player header */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 overflow-hidden rounded-lg bg-muted">
                      {resolvePlayerPhoto(player.id, player.match_name, player.profile_image_url) ? (
                        <img
                          src={
                            resolvePlayerPhoto(player.id, player.match_name, player.profile_image_url) ?? ""
                          }
                          alt={player.match_name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center bg-muted">
                          <User className="size-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{player.match_name}</p>
                      <div className="mt-0.5 flex size-5 items-center justify-center rounded border border-border bg-muted/70">
                        <img src={ROLE_ICON_URLS[role]} alt={role} className="size-3 object-contain" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className={cn("text-xs font-heading tabular-nums", SOLOQ_TIER_COLORS[soloQ.tier])}>
                        {soloQ.tier}
                      </p>
                      <p className="text-xs tabular-nums text-foreground">
                        {soloQ.lp} LP
                        <span
                          className={cn(
                            "ml-1",
                            soloQ.delta >= 0 ? "text-emerald-400" : "text-red-400",
                          )}
                        >
                          {soloQ.delta >= 0 ? `+${soloQ.delta}` : soloQ.delta}
                        </span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">x{soloQMult.toFixed(1)}</p>
                    </div>
                    <img
                      src={SOLOQ_EMBLEM_URLS[soloQ.tier]}
                      alt={soloQ.tier}
                      className="size-12 object-contain drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]"
                    />
                  </div>
                </div>

                {/* Training slots */}
                <div className="grid gap-2 md:grid-cols-3">
                  {targets.map((target, slotIndex) => {
                    const masteryValue = target
                      ? masteryMap.get(`${player.id}:${normalizeKey(target)}`) ?? 25
                      : 25;
                    const gainHint = expectedGainBadge(slotIndex, effectiveFocus);
                    const slotLabels = ["High Priority", "Medium Priority", "Low Priority"];
                    const slotDescs = [
                      "Maximum gain",
                      "Moderate gain",
                      "Minimal gain",
                    ];

                    return (
                      <div
                        key={`${player.id}-slot-${slotIndex}`}
                        className="rounded-lg border border-border bg-muted/30 p-2.5 transition-all hover:border-muted-foreground/30"
                      >
                        <div className="mb-1.5 flex items-start justify-between gap-1">
                          <div>
                            <span className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">
                              P{slotIndex + 1}
                            </span>
                            <p className="text-xs font-heading uppercase tracking-wider text-foreground">
                              {slotLabels[slotIndex]}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            x{gainHint.baseMult.toFixed(2)}
                          </Badge>
                        </div>
                        <p className="mb-2 text-[10px] text-muted-foreground">{slotDescs[slotIndex]}</p>

                        <select
                          value={target}
                          disabled={submittingKey === `${player.id}:${slotIndex}`}
                          onChange={(e) => {
                            void handleTrainingTargetChange(player.id, slotIndex, e.target.value);
                          }}
                          className="w-full rounded-md border border-border bg-muted px-2 py-1 text-xs text-foreground"
                        >
                          <option value="">No target</option>
                          {sortedRoleChampions.map((champion) => {
                            const championKey = normalizeKey(champion);
                            const mastery = masteryMap.get(`${player.id}:${championKey}`) ?? 25;
                            const discoveredTier =
                              discoveredTierByRoleChampion.get(`${role}:${championKey}`) ??
                              discoveredTierByChampion.get(championKey) ??
                              "?";
                            return (
                              <option key={`${player.id}-${slotIndex}-${champion}`} value={champion}>
                                {championDisplayName(champion)} · M{mastery} · T{discoveredTier}
                              </option>
                            );
                          })}
                        </select>

                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${Math.min(100, masteryValue)}%` }}
                          />
                        </div>

                        <div className="mt-1 flex gap-2 text-[10px] text-muted-foreground">
                          <span className="tabular-nums">M{masteryValue}</span>
                          <span className="tabular-nums">SoloQ x{soloQMult.toFixed(1)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
