import lesTeamsData from "../../data/erls/teams/les_teams.json";
import lflTeamsData from "../../data/erls/teams/lfl_teams.json";
import primeLeagueTeamsData from "../../data/erls/teams/prm_teams.json";

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function buildLogoMapFromJson(data: { teams: { name: string; logo_url?: string | null }[] }): Map<string, string> {
  const map = new Map<string, string>();
  for (const team of data.teams) {
    const key = normalizeKey(team.name);
    if (!key) continue;
    if (!team.logo_url) continue;
    map.set(key, team.logo_url);
  }
  return map;
}

const EXAMPLE_TEAM_LOGO_MAP = new Map<string, string>([
  ...buildLogoMapFromJson(lesTeamsData).entries(),
  ...buildLogoMapFromJson(lflTeamsData).entries(),
  ...buildLogoMapFromJson(primeLeagueTeamsData).entries(),
]);

const MAIN_TEAM_LOGOS: Record<string, string> = {
  [normalizeKey("G2 Esports")]: "/teams-icons/g2-esports.webp",
  [normalizeKey("Movistar KOI")]: "/teams-icons/movistar-koi.webp",
  [normalizeKey("MAD Lions KOI")]: "/teams-icons/movistar-koi.webp",
  [normalizeKey("Fnatic")]: "/teams-icons/fnatic.webp",
  [normalizeKey("GIANTX")]: "/teams-icons/giantx-lec.webp",
  [normalizeKey("Karmine Corp")]: "/teams-icons/karmine-corp.webp",
  [normalizeKey("Natus Vincere")]: "/teams-icons/natus-vincere.webp",
  [normalizeKey("SK Gaming")]: "/teams-icons/sk-gaming.webp",
  [normalizeKey("Team Heretics")]: "/teams-icons/team-heretics-lec.webp",
  [normalizeKey("Team Vitality")]: "/teams-icons/team-vitality.webp",
  [normalizeKey("Shifters")]: "/teams-icons/shifters.webp",
};

export function resolveTeamLogo(teamName?: string | null, logoUrl?: string | null): string | null {
  if (logoUrl) return logoUrl;
  const key = normalizeKey(teamName ?? "");
  if (!key) return null;
  return EXAMPLE_TEAM_LOGO_MAP.get(key) ?? MAIN_TEAM_LOGOS[key] ?? null;
}
