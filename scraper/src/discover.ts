/** Player discovery via embeddedin=Template:Infobox Player */
import { apiGet } from "./api";
import { LEAGUES } from "./config";
import type { ScrapedTeam } from "./types";

interface PageInfo {
  title: string;
  pageid: number;
}

/** Discover all player pages across Leaguepedia */
export async function discoverAllPlayers(maxResults = 0): Promise<string[]> {
  console.log("\n🔍 Discovering all player pages...");
  const pages: string[] = [];
  let eicontinue: string | null = null;
  let batch = 0;

  while (true) {
    batch++;
    const params: Record<string, string> = {
      action: "query",
      list: "embeddedin",
      eititle: "Template:Infobox Player",
      eilimit: "500",
      einamespace: "0", // Main namespace only (no User:, Template:, etc)
    };
    if (eicontinue) params.eicontinue = eicontinue;

    const json = await apiGet(params);
    const embeddedin: PageInfo[] = json.query?.embeddedin ?? [];

    for (const page of embeddedin) {
      // Skip non-player pages
      if (page.title.startsWith("User:") || page.title.startsWith("Template:") || page.title.includes("/")) {
        continue;
      }
      pages.push(page.title);
      if (maxResults > 0 && pages.length >= maxResults) break;
    }

    process.stdout.write(`\r  Batch ${batch}: +${embeddedin.length} pages → ${pages.length} total`);

    if (!json.continue?.eicontinue) break;
    if (maxResults > 0 && pages.length >= maxResults) break;
    eicontinue = json.continue.eicontinue;
  }

  console.log(` ✅ (${pages.length} player pages found)`);
  return pages;
}

/** Discover LEC team pages for team data extraction */
export async function discoverTeams(): Promise<ScrapedTeam[]> {
  console.log("\n🏢 Discovering teams...");
  const teams: ScrapedTeam[] = [];
  const seen = new Set<string>();

  for (const [leagueName, leagueMeta] of Object.entries(LEAGUES)) {
    try {
      const json = await apiGet({
        action: "parse",
        page: `${leagueName}`,
        prop: "wikitext",
      });

      const wt = json.parse?.wikitext?.["*"] ?? "";
      if (!wt) continue;

      // Team names in wiki text usually appear as [[Team Name]]
      const teamMatches = wt.match(/\[\[([A-Z][a-zA-Z0-9 ._&]+)\]\]/g) ?? [];

      for (const match of teamMatches) {
        const name = match.replace(/^\[\[|\]\]$/g, "").trim();
        if (seen.has(name)) continue;
        // Skip obvious non-team entries
        if (/^(LEC|LCK|LPL|Season|Split|Week|Day|Match|Game|Round|Playoff|Final)/i.test(name)) continue;
        if (name.length < 3 || name.length > 40) continue;

        seen.add(name);
        teams.push({
          id: `team-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
          name,
          shortName: name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 4),
          leagueId: leagueMeta.id,
          leagueName,
          region: leagueMeta.region,
          logoUrl: null,
        });
      }
    } catch {
      // League page might not have parseable wikitext
    }
  }

  console.log(`  Found ${teams.length} potential teams`);
  return teams;
}
