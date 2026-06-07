import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, AlertTriangle, TrendingUp, Swords, Crown, BarChart3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ROLE_ICON_PATHS } from "@/lib/players/roleIcons";
import { resolveChampionTile, resolveChampionSplash } from "@/lib/champions/championImages";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui-v2/components/ui/card";
import { Badge } from "@/ui-v2/components/ui/badge";
import { cn } from "@/ui-v2/lib/utils";

interface ChampionPageV2Props {
  championKey: string;
  onClose: () => void;
}

function mapRoleToIconPath(role: string): string | undefined {
  const n = role.toUpperCase();
  if (n === "TOP") return ROLE_ICON_PATHS.TOP;
  if (n === "JUNGLE" || n === "JUNGLER") return ROLE_ICON_PATHS.JUNGLE;
  if (n === "MID") return ROLE_ICON_PATHS.MID;
  if (n === "ADC" || n === "BOT") return ROLE_ICON_PATHS.ADC;
  if (n === "SUPPORT") return ROLE_ICON_PATHS.SUPPORT;
  return undefined;
}

interface ChampionStatsSummary {
  champion_key: string;
  champion_name: string;
  total_games: number;
  total_wins: number;
  win_rate: number;
  pick_rate: number;
  ban_rate: number;
  avg_kills: number;
  avg_deaths: number;
  avg_assists: number;
  avg_kda: number;
  avg_gold: number;
  avg_damage: number;
  avg_cs: number;
  avg_vision: number;
  role_distribution: { role: string; games: number; percentage: number }[];
  best_against: { vs_champion_key: string; vs_champion_name: string; games: number; wins: number; win_rate: number }[];
  worst_against: { vs_champion_key: string; vs_champion_name: string; games: number; wins: number; win_rate: number }[];
  top_players: { player_id: string; player_name: string; team_name: string; games: number; win_rate: number; avg_kda: number }[];
  most_played_players: { player_id: string; player_name: string; team_name: string; games: number; win_rate: number; avg_kda: number }[];
  weekly_history: { week_label: string; games: number; win_rate: number; avg_kda: number }[];
}

export default function ChampionPageV2({ championKey, onClose }: ChampionPageV2Props) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<ChampionStatsSummary | null>(null);
  const splash = resolveChampionSplash(championKey);
  const tile = resolveChampionTile(championKey);

  useEffect(() => {
    invoke<ChampionStatsSummary>("get_champion_stats", { championKey })
      .then(setStats)
      .catch((err) => console.error("[ChampionPage] fetch error:", err));
  }, [championKey]);

  const s = stats;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background scrollbar-v2">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex items-center gap-2.5">
          {tile && <img src={tile} alt={championKey} className="size-7 rounded object-cover" />}
          <h1 className="font-heading text-base font-bold uppercase tracking-widest text-foreground">
            {s?.champion_name ?? championKey}
          </h1>
          {s && (
            <Badge variant="secondary" className="text-[10px]">
              {s.total_games} {t("champions.games", "partidas")}
            </Badge>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-4 p-6">
        {/* Hero: Splash + core stats */}
        <Card className="relative overflow-hidden border-0">
          {splash && (
            <img src={splash} alt={championKey} className="absolute inset-0 size-full object-cover opacity-40" />
          )}
          <div className="relative z-10">
            <CardContent className="grid grid-cols-2 gap-4 p-6 md:grid-cols-4">
              {[
                { label: t("champions.winRate", "Win Rate"), value: s ? `${s.win_rate}%` : "—", color: s && s.win_rate >= 50 ? "text-emerald-400" : "text-red-400" },
                { label: t("champions.pickRate", "Pick Rate"), value: s ? `${s.pick_rate}%` : "—", color: "text-primary" },
                { label: t("champions.banRate", "Ban Rate"), value: s ? `${s.ban_rate}%` : "—", color: "text-amber-400" },
                { label: t("champions.kda", "KDA"), value: s ? s.avg_kda.toFixed(1) : "—", color: s ? "text-foreground" : "text-muted-foreground/50" },
              ].map((st) => (
                <div key={st.label} className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-center backdrop-blur-sm">
                  <p className="mb-0.5 font-heading text-[10px] uppercase tracking-widest text-muted-foreground">{st.label}</p>
                  <p className={cn("font-heading text-2xl font-bold tabular-nums", st.color)}>{st.value}</p>
                </div>
              ))}
            </CardContent>
          </div>
        </Card>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: t("champions.avgKills", "Kills"), value: s ? s.avg_kills.toFixed(1) : "—", icon: Swords },
            { label: t("champions.avgDeaths", "Deaths"), value: s ? s.avg_deaths.toFixed(1) : "—", icon: AlertTriangle },
            { label: t("champions.avgAssists", "Assists"), value: s ? s.avg_assists.toFixed(1) : "—", icon: TrendingUp },
            { label: t("champions.avgGold", "Gold"), value: s ? s.avg_gold.toLocaleString() : "—", icon: Crown },
            { label: t("champions.avgDamage", "Damage"), value: s ? s.avg_damage.toLocaleString() : "—", icon: Swords },
            { label: t("champions.avgCs", "CS"), value: s ? s.avg_cs.toFixed(0) : "—", icon: TrendingUp },
            { label: t("champions.avgVision", "Vision"), value: s ? s.avg_vision.toFixed(0) : "—", icon: TrendingUp },
          ].map((st) => (
            <Card key={st.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <st.icon className="size-5 shrink-0 text-muted-foreground/50" />
                <div className="min-w-0">
                  <p className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">{st.label}</p>
                  <p className={cn("font-heading text-lg font-bold tabular-nums", s ? "text-foreground" : "text-muted-foreground/40")}>{st.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Role distribution */}
        <Card>
          <CardHeader className="space-y-0">
            <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
              {t("champions.roleDistribution", "Distribución por rol")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {s?.role_distribution && s.role_distribution.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {s.role_distribution.map((r) => {
                  const iconPath = mapRoleToIconPath(r.role);
                  return (
                    <div key={r.role} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                      {iconPath && <img src={iconPath} alt={r.role} className="size-5 object-contain" />}
                      <span className="font-heading text-xs font-bold uppercase tracking-wider text-foreground">{r.role}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{r.games}g</span>
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${r.percentage}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">{r.percentage}%</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <BarChart3 className="size-4" />
                {t("champions.noStats", "No hay datos de distribución disponibles")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Best / Worst matchups */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <MatchupCard
            title={t("champions.bestAgainst", "Mejor contra")}
            items={s?.best_against}
            type="best"
          />
          <MatchupCard
            title={t("champions.worstAgainst", "Peor contra")}
            items={s?.worst_against}
            type="worst"
          />
        </div>

        {/* Top players */}
        <Card>
          <CardHeader className="space-y-0">
            <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
              {t("champions.topPlayers", "Mejores jugadores")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {s?.top_players && s.top_players.length > 0 ? (
              <PlayerTable players={s.top_players.slice(0, 10)} />
            ) : (
              <p className="flex items-center gap-2 px-6 py-4 text-sm text-muted-foreground">
                <BarChart3 className="size-4" />
                {t("champions.noStats", "No hay datos de jugadores disponibles")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Weekly history */}
        <Card>
          <CardHeader className="space-y-0">
            <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
              {t("champions.weeklyHistory", "Historial semanal")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {s?.weekly_history && s.weekly_history.length > 0 ? (
              <WeeklyTable history={s.weekly_history.slice(0, 10)} />
            ) : (
              <p className="flex items-center gap-2 px-6 py-4 text-sm text-muted-foreground">
                <BarChart3 className="size-4" />
                {t("champions.noStats", "No hay historial semanal disponible")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MatchupCard({
  title,
  items,
  type,
}: {
  title: string;
  items?: { vs_champion_key: string; vs_champion_name: string; games: number; wins: number; win_rate: number }[];
  type: "best" | "worst";
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader className="space-y-0">
        <CardTitle className={cn("font-heading text-sm uppercase tracking-widest", type === "best" ? "text-emerald-400" : "text-red-400")}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items && items.length > 0 ? (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3 font-heading font-bold">{t("champions.champion", "Campeón")}</th>
                <th className="px-4 py-3 text-right font-heading font-bold">{t("champions.games", "G")}</th>
                <th className="px-4 py-3 text-right font-heading font-bold">{t("champions.wins", "W")}</th>
                <th className="px-4 py-3 text-right font-heading font-bold">WR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {items.slice(0, 8).map((item) => {
                const t = resolveChampionTile(item.vs_champion_key);
                return (
                  <tr key={item.vs_champion_key} className="transition-colors hover:bg-muted/30">
                    <td className="flex items-center gap-2.5 px-4 py-2.5">
                      {t && <img src={t} alt={item.vs_champion_name} className="size-7 rounded object-cover" />}
                      <span className="text-sm font-medium text-foreground">{item.vs_champion_name}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-muted-foreground">{item.games}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-foreground">{item.wins}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums font-medium" style={{ color: item.win_rate >= 50 ? "#34d399" : "#f87171" }}>{item.win_rate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="flex items-center gap-2 px-6 py-4 text-sm text-muted-foreground">
            <BarChart3 className="size-4" />
            {t("champions.noMatchupData", type === "best" ? "Sin datos de enfrentamientos favorables" : "Sin datos de enfrentamientos desfavorables")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PlayerTable({ players }: { players: { player_name: string; team_name: string; games: number; win_rate: number; avg_kda: number }[] }) {
  const { t } = useTranslation();
  return (
    <table className="w-full text-left">
      <thead>
        <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-widest text-muted-foreground">
          <th className="px-4 py-3 font-heading font-bold">{t("common.player", "Jugador")}</th>
          <th className="px-4 py-3 font-heading font-bold">{t("common.team", "Equipo")}</th>
          <th className="px-4 py-3 text-right font-heading font-bold">{t("champions.games", "Partidas")}</th>
          <th className="px-4 py-3 text-right font-heading font-bold">WR</th>
          <th className="px-4 py-3 text-right font-heading font-bold">KDA</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/40">
        {players.map((p) => (
          <tr key={p.player_name} className="transition-colors hover:bg-muted/30">
            <td className="px-4 py-2.5 text-sm font-medium text-foreground">{p.player_name}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{p.team_name}</td>
            <td className="px-4 py-2.5 text-right text-sm tabular-nums text-muted-foreground">{p.games}</td>
            <td className="px-4 py-2.5 text-right text-sm tabular-nums font-medium" style={{ color: p.win_rate >= 50 ? "#34d399" : "#f87171" }}>{p.win_rate}%</td>
            <td className="px-4 py-2.5 text-right text-sm tabular-nums text-foreground">{p.avg_kda.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function WeeklyTable({ history }: { history: { week_label: string; games: number; win_rate: number; avg_kda: number }[] }) {
  const { t } = useTranslation();
  return (
    <table className="w-full text-left">
      <thead>
        <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-widest text-muted-foreground">
          <th className="px-4 py-3 font-heading font-bold">{t("champions.week", "Semana")}</th>
          <th className="px-4 py-3 text-right font-heading font-bold">{t("champions.games", "Partidas")}</th>
          <th className="px-4 py-3 text-right font-heading font-bold">WR</th>
          <th className="px-4 py-3 text-right font-heading font-bold">KDA</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/40">
        {history.map((w) => (
          <tr key={w.week_label} className="transition-colors hover:bg-muted/30">
            <td className="px-4 py-2.5 font-heading text-sm font-bold text-foreground">{w.week_label}</td>
            <td className="px-4 py-2.5 text-right text-sm tabular-nums text-muted-foreground">{w.games}</td>
            <td className="px-4 py-2.5 text-right text-sm tabular-nums font-medium" style={{ color: w.win_rate >= 50 ? "#34d399" : "#f87171" }}>{w.win_rate}%</td>
            <td className="px-4 py-2.5 text-right text-sm tabular-nums text-foreground">{w.avg_kda.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
