import { invoke } from "@tauri-apps/api/core";
import type { LeagueSelectionData, GameStateData } from "@/store/gameStore";

export function formatFinance(val: number): string {
  if (val >= 1_000_000) return `€${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `€${(val / 1_000).toFixed(0)}K`;
  return `€${val}`;
}

export function getReputationLabel(rep: number): { label: string; variant: "default" | "secondary" | "destructive" } {
  if (rep >= 750) return { label: "Élite", variant: "secondary" };
  if (rep >= 600) return { label: "Fuerte", variant: "default" };
  if (rep >= 400) return { label: "Media", variant: "secondary" };
  return { label: "En desarrollo", variant: "destructive" };
}

export function getTeamLogoPath(teamId: string, logoUrl?: string | null): string {
  if (logoUrl) return logoUrl;
  const slug = teamId.replace(/^[a-z0-9]+-/i, "");
  if (slug === "shifters")
    return "https://static.lolesports.com/teams/1765897071435_600px-Shifters_allmode.png";
  return `/teams-icons/${slug}.webp`;
}

export async function loadLeagueSelectionData(): Promise<LeagueSelectionData> {
  return invoke<LeagueSelectionData>("get_league_selection_data");
}

export async function selectTeam(teamId: string, lang?: string): Promise<GameStateData> {
  return invoke<GameStateData>("select_team", { teamId, lang: lang ?? "en" });
}
