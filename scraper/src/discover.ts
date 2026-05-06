/** Discover pages (players + teams) via embeddedin */
import { apiGet } from "./api";
import type { ScrapedTeam, ScrapedLeague } from "./types";

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
      einamespace: "0",
    };
    if (eicontinue) params.eicontinue = eicontinue;

    const json = await apiGet(params);
    const embeddedin: PageInfo[] = json.query?.embeddedin ?? [];

    for (const page of embeddedin) {
      if (page.title.startsWith("User:") || page.title.startsWith("Template:") || page.title.includes("/")) continue;
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

/** Discover all team pages via embeddedin=Template:Infobox Team */
export async function discoverAllTeams(): Promise<string[]> {
  console.log("\n🏢 Discovering all team pages...");
  const pages: string[] = [];
  let eicontinue: string | null = null;
  let batch = 0;

  while (true) {
    batch++;
    const params: Record<string, string> = {
      action: "query",
      list: "embeddedin",
      eititle: "Template:Infobox Team",
      eilimit: "500",
      einamespace: "0",
    };
    if (eicontinue) params.eicontinue = eicontinue;

    const json = await apiGet(params);
    const embeddedin: PageInfo[] = json.query?.embeddedin ?? [];

    for (const page of embeddedin) {
      if (page.title.startsWith("User:") || page.title.startsWith("Template:") || page.title.includes("/")) continue;
      if (page.title.endsWith("(disambiguation")) continue;
      pages.push(page.title);
    }

    process.stdout.write(`\r  Batch ${batch}: +${embeddedin.length} pages → ${pages.length} total`);

    if (!json.continue?.eicontinue) break;
    eicontinue = json.continue.eicontinue;
  }

  console.log(` ✅ (${pages.length} team pages found)`);
  return pages;
}
