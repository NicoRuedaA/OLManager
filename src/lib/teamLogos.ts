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

// Slugs that have a local file under /teams-icons/<slug>.webp.
// Includes both full-name keys and short-name keys so any spelling matches.
const LOCAL_TEAMS_ICONS: Record<string, string> = {
  // Fnatic
  fnatic: "fnatic",
  fnc: "fnatic",
  // G2
  g2: "g2-esports",
  g2esports: "g2-esports",
  // GIANTX
  giantx: "giantx-lec",
  gx: "giantx-lec",
  // Karmine Corp
  karminecorp: "karmine-corp",
  kc: "karmine-corp",
  // Movistar Koi
  movistarkoi: "movistar-koi",
  mkoi: "movistar-koi",
  koi: "movistar-koi",
  // Natus Vincere
  natusvincere: "natus-vincere",
  navi: "natus-vincere",
  // Shifters
  shifters: "shifters",
  shft: "shifters",
  // SK Gaming
  skgaming: "sk-gaming",
  sk: "sk-gaming",
  // Team Heretics
  teamheretics: "team-heretics-lec",
  heretics: "team-heretics-lec",
  th: "team-heretics-lec",
  // Team Vitality
  teamvitality: "team-vitality",
  vitality: "team-vitality",
  vit: "team-vitality",
};

export function resolveTeamLogo(teamName?: string | null, logoUrl?: string | null): string | null {
  if (logoUrl) return logoUrl;
  const key = normalizeKey(teamName ?? "");
  if (!key) return null;
  const local = LOCAL_TEAMS_ICONS[key];
  if (local) return `/teams-icons/${local}.webp`;
  return EXAMPLE_TEAM_LOGO_MAP.get(key) ?? null;
}
