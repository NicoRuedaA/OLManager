import lesExampleRaw from "../../data/erls/les.txt?raw";
import lflExampleRaw from "../../data/erls/lfl.txt?raw";
import primeLeagueExampleRaw from "../../data/erls/Prime League.txt?raw";

const FALLBACK_TEAM_LOGOS: Record<string, string> = {
  falkeesports:
    "https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/b/b0/Falke_Esportslogo_square.png/revision/latest/scale-to-width-down/220?cb=20250917172449",
  barcelonaesports:
    "https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/6/68/Bar%C3%A7a_eSportslogo_square.png/revision/latest/scale-to-width-down/220?cb=20221118223547",
  g2esports: "/team-logos/g2-esports.png",
  fnatic: "/team-logos/fnatic.png",
  giantx: "/team-logos/giantx-lec.png",
  karminecorp: "/team-logos/karmine-corp.png",
  movistarkoi: "/team-logos/mad-lions.png",
  koi: "/team-logos/mad-lions.png",
  madlionskoi: "/team-logos/mad-lions.png",
  natusvincere: "/team-logos/natus-vincere.png",
  skgaming: "/team-logos/sk-gaming.png",
  teamheretics: "/team-logos/team-heretics-lec.png",
  teamvitality: "/team-logos/team-vitality.png",
  teambds: "/team-logos/team-bds.png",
};

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
  ...Object.entries(FALLBACK_TEAM_LOGOS),
]);

export function resolveExampleTeamLogo(teamName?: string | null): string | null {
  const key = normalizeKey(teamName ?? "");
  if (!key) return null;
  return EXAMPLE_TEAM_LOGO_MAP.get(key) ?? null;
}
