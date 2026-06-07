import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import {
  AlertTriangle,
  ChevronRight,
  Repeat,
  ShoppingCart,
  User,
} from "lucide-react";

import type { GameStateData, PlayerData, PlayerSelectionOptions } from "@/store/gameStore";
import {
  buildActiveLineupIds,
  buildActiveLineupSlots,
  isPlayerOutOfPosition,
  LOL_ACTIVE_ROLES,
  LOL_ROLE_LABELS,
} from "@/components/squad/SquadTab.helpers";
import { calculateLolOvr } from "@/lib/players/lolPlayerStats";
import { resolvePlayerPhoto } from "@/lib/players/playerPhotos";
import { resolvePlayerLolRole } from "@/lib/players/lolIdentity";
import ContextMenu from "@/components/ContextMenu";
import { calcAge, formatVal } from "@/lib/common/helpers";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui-v2/components/ui/card";

import { cn } from "@/ui-v2/lib/utils";

// ─── Types ──────────────────────────────────────────────────────

type LolRole = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";
type SortKey = "pos" | "ovr" | "condition" | "fitness" | "morale" | "age";

const LOL_ROLE_ORDER: Record<LolRole, number> = {
  TOP: 1,
  JUNGLE: 2,
  MID: 3,
  ADC: 4,
  SUPPORT: 5,
};

const ROLE_ICON_URLS: Record<LolRole, string> = {
  TOP: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-top.png",
  JUNGLE:
    "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-jungle.png",
  MID: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-middle.png",
  ADC: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom.png",
  SUPPORT:
    "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-utility.png",
};

function resolveRole(player: PlayerData): LolRole {
  return resolvePlayerLolRole(player);
}

function clampBar(value: number): number {
  return Math.max(0, Math.min(100, value));
}

// ─── Props ──────────────────────────────────────────────────────

interface SquadTabV2Props {
  gameState: GameStateData;
  onGameUpdate: (g: GameStateData) => void;
  onSelectPlayer: (id: string, options?: PlayerSelectionOptions) => void;
}

// ─── Component ──────────────────────────────────────────────────

export function SquadTabV2({
  gameState,
  onGameUpdate,
  onSelectPlayer,
}: SquadTabV2Props) {
  const { t } = useTranslation();
  const myTeam = gameState.teams.find((tm) => tm.id === gameState.manager.team_id);
  const [sortKey, setSortKey] = useState<SortKey>("pos");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ─── Derived data ────────────────────────────────────────────────
  if (!myTeam) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">
              {t("common.unemployed", { defaultValue: "Sin equipo" })}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roster = gameState.players.filter(
    (player) => player.team_id === myTeam.id,
  );
  const activeLineupIds = buildActiveLineupIds(
    roster,
    myTeam.active_lineup_ids ?? myTeam.starting_xi_ids ?? [],
  );
  const activeIds = new Set(activeLineupIds);
  const playersById = useMemo(
    () => new Map(roster.map((player) => [player.id, player])),
    [roster],
  );
  const activeLineupSlots = useMemo(
    () => buildActiveLineupSlots(LOL_ACTIVE_ROLES, activeLineupIds, playersById),
    [activeLineupIds, playersById],
  );

  const sortedRoster = useMemo(() => {
    const sorted = [...roster].sort((a, b) => {
      switch (sortKey) {
        case "pos":
          return (
            LOL_ROLE_ORDER[resolveRole(a)] - LOL_ROLE_ORDER[resolveRole(b)] ||
            calculateLolOvr(b) - calculateLolOvr(a)
          );
        case "ovr":
          return calculateLolOvr(a) - calculateLolOvr(b);
        case "condition":
          return a.condition - b.condition;
        case "fitness":
          return (a.fitness ?? 75) - (b.fitness ?? 75);
        case "morale":
          return a.morale - b.morale;
        case "age":
          return (
            calcAge(a.date_of_birth, gameState.clock.current_date) -
            calcAge(b.date_of_birth, gameState.clock.current_date)
          );
        default:
          return 0;
      }
    });
    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [gameState.clock.current_date, roster, sortDir, sortKey]);

  const toggleSort = (nextKey: SortKey): void => {
    if (sortKey === nextKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDir(nextKey === "ovr" ? "desc" : "asc");
  };

  const benchPlayers = sortedRoster.filter((p) => !activeIds.has(p.id));
  const hasRoster = roster.length > 0;

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* ── Active Lineup ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
              {t("squad.activeLineup", { defaultValue: "Alineación titular" })}
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              {t("squad.activeLineupHint", {
                defaultValue: "Cinco jugadores titulares para League of Legends.",
              })}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {!hasRoster ? (
            <div className="py-8 text-center font-heading text-sm uppercase tracking-wider text-muted-foreground">
              {t("squad.noPlayers", { defaultValue: "Sin jugadores" })}
            </div>
          ) : (
            <div
              className="grid grid-cols-1 gap-3 md:grid-cols-5"
              data-testid="active-lineup"
            >
              {activeLineupSlots.map((slot) => {
                const player = slot.player;
                const roleLabel = LOL_ROLE_LABELS[slot.role];
                const ovr = player ? calculateLolOvr(player) : null;
                const photo = player
                  ? resolvePlayerPhoto(
                      player.id,
                      player.match_name,
                      player.profile_image_url,
                    )
                  : null;
                const outOfPosition = player
                  ? isPlayerOutOfPosition(player, slot.role)
                  : false;

                return (
                  <button
                    key={slot.role}
                    type="button"
                    disabled={!player}
                    onClick={() => {
                      if (player) onSelectPlayer(player.id);
                    }}
                    className={cn(
                      "flex flex-col rounded-lg border bg-card p-3 text-left transition-colors",
                      player
                        ? "cursor-pointer border-border hover:bg-muted/50"
                        : "cursor-default border-border/60 opacity-70",
                    )}
                    data-testid={`active-lineup-role-${slot.role}`}
                  >
                    {/* Role header */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-heading text-xs font-bold uppercase tracking-widest text-primary">
                        {roleLabel}
                      </span>
                      <img
                        src={ROLE_ICON_URLS[slot.role]}
                        alt={roleLabel}
                        className="size-5 object-contain opacity-70"
                      />
                    </div>

                    {player ? (
                      <div className="mt-3 flex items-center gap-3">
                        <PlayerAvatar
                          src={photo}
                          alt={player.match_name}
                          className="size-10"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate font-heading text-base font-bold leading-none text-foreground">
                              {player.match_name}
                            </p>
                            {outOfPosition && (
                              <span
                                className="shrink-0 text-amber-400"
                                title={t("squad.outOfPositionTooltip", {
                                  defaultValue: "Fuera de rol",
                                })}
                              >
                                <AlertTriangle className="size-4" />
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("common.ovr", { defaultValue: "OVR" })}{" "}
                            <span className="font-heading font-bold text-foreground tabular-nums">
                              {ovr}
                            </span>
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                        <p className="font-heading text-xs font-bold uppercase tracking-wide text-amber-400">
                          {t("squad.missingRoleCoverage", {
                            defaultValue: "Sin jugador disponible",
                          })}
                        </p>
                        <p className="mt-0.5 text-xs text-amber-300/80">
                          {t("squad.noRoleAvailable", {
                            defaultValue: `No hay ${roleLabel.toLowerCase()} disponible`,
                          })}
                        </p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Bench / Substitutes ─────────────────────────────────── */}
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
            {t("squad.benchSubstitutes", {
              defaultValue: "Suplentes / Banca",
            })}
          </CardTitle>
          {/* Sort toggles */}
          {hasRoster && (
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["pos", t("squad.pos", { defaultValue: "Posición" })],
                  ["ovr", t("common.ovr", { defaultValue: "OVR" })],
                  [
                    "condition",
                    t("common.condition", { defaultValue: "Energía" }),
                  ],
                  [
                    "fitness",
                    t("common.fitness", { defaultValue: "Fitness" }),
                  ],
                  ["morale", t("common.morale", { defaultValue: "Moral" })],
                  ["age", t("common.age", { defaultValue: "Edad" })],
                ] as Array<[SortKey, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleSort(key)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 font-heading text-xs font-bold uppercase tracking-wide transition-colors",
                    sortKey === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  )}
                >
                  {label}
                  {sortKey === key && (
                    <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {benchPlayers.length === 0 && hasRoster ? (
            <div className="p-8 text-center font-heading text-sm uppercase tracking-wider text-muted-foreground">
              {t("squad.allStarting", {
                defaultValue: "Todos los jugadores en la alineación titular",
              })}
            </div>
          ) : !hasRoster ? (
            <div className="p-8 text-center font-heading text-sm uppercase tracking-wider text-muted-foreground">
              {t("squad.noPlayers", { defaultValue: "Sin jugadores" })}
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {benchPlayers.map((player) => {
                const role = resolveRole(player);
                const ovr = calculateLolOvr(player);
                const photo = resolvePlayerPhoto(
                  player.id,
                  player.match_name,
                  player.profile_image_url,
                );
                const age = calcAge(
                  player.date_of_birth,
                  gameState.clock.current_date,
                );
                const annualWage = player.wage;
                const condition = player.condition;
                const fitness = player.fitness ?? 75;
                const morale = player.morale;

                const contextItems = [
                  {
                    label: t("squad.viewProfile", {
                      defaultValue: "Ver perfil",
                    }),
                    icon: <User className="size-4" />,
                    onClick: () => onSelectPlayer(player.id),
                  },
                  {
                    label: "",
                    icon: undefined,
                    onClick: () => {},
                    divider: true,
                  },
                  {
                    label: player.transfer_listed
                      ? t("squad.removeFromTransferList", {
                          defaultValue: "Quitar de transferibles",
                        })
                      : t("squad.addToTransferList", {
                          defaultValue: "Añadir a transferibles",
                        }),
                    icon: <ShoppingCart className="size-4" />,
                    onClick: async () => {
                      try {
                        const updated = await invoke<GameStateData>(
                          "toggle_transfer_list",
                          { playerId: player.id },
                        );
                        onGameUpdate(updated);
                      } catch {
                        /* silent */
                      }
                    },
                  },
                  {
                    label: player.loan_listed
                      ? t("squad.removeFromLoanList", {
                          defaultValue: "Quitar de cesión",
                        })
                      : t("squad.addToLoanList", {
                          defaultValue: "Añadir a cesión",
                        }),
                    icon: <Repeat className="size-4" />,
                    onClick: async () => {
                      try {
                        const updated = await invoke<GameStateData>(
                          "toggle_loan_list",
                          { playerId: player.id },
                        );
                        onGameUpdate(updated);
                      } catch {
                        /* silent */
                      }
                    },
                  },
                ];

                return (
                  <ContextMenu items={contextItems} key={player.id}>
                    <button
                      type="button"
                      onClick={() => onSelectPlayer(player.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                    >
                      {/* Role icon */}
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50">
                        <img
                          src={ROLE_ICON_URLS[role]}
                          alt={role}
                          className="size-4 object-contain opacity-80"
                        />
                      </div>

                      {/* Photo */}
                      <PlayerAvatar
                        src={photo}
                        alt={player.match_name}
                        className="size-10"
                      />

                      {/* Name + full_name */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-heading text-base font-bold text-foreground">
                          {player.match_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {player.full_name}
                        </p>
                      </div>

                      {/* OVR — visible md+ */}
                      <div className="hidden w-12 shrink-0 text-center md:block">
                        <p className="font-heading text-xl font-black text-primary tabular-nums">
                          {ovr}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          OVR
                        </p>
                      </div>

                      {/* Role badge — visible md+ */}
                      <div className="hidden w-14 shrink-0 text-center md:block">
                        <span className="font-heading text-sm font-bold text-muted-foreground">
                          {role}
                        </span>
                      </div>

                      {/* Condition bar — visible lg+ */}
                      <div className="hidden w-28 shrink-0 lg:block">
                        <div className="mb-0.5 flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t("common.condition", { defaultValue: "Energía" })}
                          </span>
                          <span className="font-heading text-[11px] font-bold text-amber-400 tabular-nums">
                            {condition}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              condition <= 0
                                ? "bg-amber-400/30"
                                : "bg-amber-400",
                            )}
                            style={{
                              width: `${clampBar(condition)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Morale bar — visible lg+ */}
                      <div className="hidden w-28 shrink-0 lg:block">
                        <div className="mb-0.5 flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t("common.morale", { defaultValue: "Moral" })}
                          </span>
                          <span className="font-heading text-[11px] font-bold text-emerald-400 tabular-nums">
                            {morale}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              morale <= 0
                                ? "bg-emerald-400/30"
                                : "bg-emerald-400",
                            )}
                            style={{
                              width: `${clampBar(morale)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Fitness bar — visible lg+ */}
                      <div className="hidden w-28 shrink-0 lg:block">
                        <div className="mb-0.5 flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t("common.fitness", { defaultValue: "Fitness" })}
                          </span>
                          <span className="font-heading text-[11px] font-bold text-green-400 tabular-nums">
                            {fitness}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              fitness <= 0
                                ? "bg-green-400/30"
                                : "bg-green-400",
                            )}
                            style={{
                              width: `${clampBar(fitness)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Age — visible lg+ */}
                      <div className="hidden w-12 shrink-0 text-center lg:block">
                        <p className="font-heading text-sm font-bold text-foreground tabular-nums">
                          {age}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {t("common.age", { defaultValue: "Edad" })}
                        </p>
                      </div>

                      {/* Wage — visible lg+ */}
                      <div className="hidden w-20 shrink-0 text-right lg:block">
                        <p className="font-heading text-sm font-bold text-foreground tabular-nums">
                          {formatVal(annualWage)}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {t("common.per_year_with_slash", {
                            defaultValue: "/año",
                          })}
                        </p>
                      </div>

                      {/* Chevron */}
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
                    </button>
                  </ContextMenu>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
