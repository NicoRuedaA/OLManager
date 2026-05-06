/** Debug: check why team logos aren't found in cache */
import crypto from "crypto";
import fs from "fs";

const world = JSON.parse(fs.readFileSync("output/world.json", "utf-8"));

// Find first team without logo
let checked = 0, found = 0, notFound = 0;
for (const t of world.teams) {
  const safe = t.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (fs.existsSync(`output/team-logos/${safe}.webp`)) { found++; continue; }
  
  // Try to find cache
  const params = { action: "parse", page: t.name, prop: "wikitext" };
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&");
  const key = crypto.createHash("md5").update(sorted).digest("hex").slice(0, 12);
  const fp = `.cache/${key}.json`;
  
  if (!fs.existsSync(fp)) {
    notFound++;
    if (notFound <= 3) console.log(`SIN CACHE: "${t.name}" (short: ${t.shortName}) — key=${key}`);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(fp, "utf-8"));
  const wt = data.parse?.wikitext?.["*"] ?? "";
  const hasLogo = /\b(logo|_std\.png|_square\.png)/i.test(wt);
  if (notFound <= 3 && !hasLogo) console.log(`CACHE OK pero sin logo: "${t.name}" — wt length ${wt.length}`);
}

console.log(`\nCon logo: ${found}, sin cache: ${notFound}, resto: ${world.teams.length - found - notFound}`);
