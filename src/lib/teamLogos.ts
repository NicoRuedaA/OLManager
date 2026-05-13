import lesExampleRaw from "../../data/erls/les.txt?raw";
import lflExampleRaw from "../../data/erls/lfl.txt?raw";
import primeLeagueExampleRaw from "../../data/erls/Prime League.txt?raw";

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function parseExampleTeamLogoMap(content: string): Map<string, string> {
  const map = new Map<string, string>();
  let currentTeam = "";

  content.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    if (line.startsWith("Team:")) {
      currentTeam = line.slice("Team:".length).trim();
      return;
    }

    if (line.startsWith("Team Logo:")) {
      const rawUrl = line.slice("Team Logo:".length).trim();
      if (!currentTeam) return;
      if (!rawUrl || rawUrl.includes("??") || !rawUrl.startsWith("http")) return;
      map.set(normalizeKey(currentTeam), rawUrl);
    }
  });

  return map;
}

const EXAMPLE_TEAM_LOGO_MAP = new Map<string, string>([
  ...parseExampleTeamLogoMap(lesExampleRaw).entries(),
  ...parseExampleTeamLogoMap(lflExampleRaw).entries(),
  ...parseExampleTeamLogoMap(primeLeagueExampleRaw).entries(),
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
