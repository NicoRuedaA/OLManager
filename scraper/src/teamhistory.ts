#!/usr/bin/env tsx
/** Assign teamIds by scanning all cached team page wikitexts for roster entries */
import fs from "fs";
import path from "path";

const OUTPUT = "output";
const CACHE_DIR = ".cache";

async function main() {
  console.log("📥 Loading world.json...");
  const world = JSON.parse(fs.readFileSync(path.join(OUTPUT, "world.json"), "utf-8"));
  const teams = [...(world.teams ?? [])];

  // Build IGN lookup
  const ignToPlayer = new Map<string, any>();
  for (const p of world.players) {
    ignToPlayer.set(p.ign.toLowerCase(), p);
    if (p.fullName) ignToPlayer.set(p.fullName.toLowerCase(), p);
  }

  console.log(`🔍 Scanning ${fs.readdirSync(CACHE_DIR).length} cache files for rosters...`);

  let assigned = 0;
  let processed = 0;

  for (const f of fs.readdirSync(CACHE_DIR)) {
    if (!f.endsWith(".json")) continue;
    const filePath = path.join(CACHE_DIR, f);
    let data: any;
    try { data = JSON.parse(fs.readFileSync(filePath, "utf-8")); }
    catch { continue; }

    const wikitext = data.parse?.wikitext?.["*"];
    if (!wikitext || typeof wikitext !== "string") continue;
    if (!wikitext.includes("listplayer")) continue; // skip if no roster
    processed++;

    // Extract team name from Infobox Team
    const teamNameMatch = wikitext.match(/\{\{Infobox Team[^}]*\|name\s*=\s*([^|\n}]+)/);
    if (!teamNameMatch) continue;
    const teamName = teamNameMatch[1].trim();
    const team = teams.find((t: any) => t.name.toLowerCase() === teamName.toLowerCase());
    if (!team) continue;

    // Parse roster entries
    const rosterMatches = wikitext.match(/\{\{listplayers?p?\|([^|}]+)/g) ?? [];
    for (const m of rosterMatches) {
      const parts = m.split("|");
      if (parts.length < 2) continue;
      const ign = parts[1].trim();
      if (!ign || ign === "Start" || ign === "End" || ign.includes("staff")) continue;

      // Clean name
      const cleanName = ign.replace(/_/g, " ").replace(/\([^)]*\)/g, "").trim();
      const player = ignToPlayer.get(cleanName.toLowerCase());
      if (player && !player.teamId) {
        player.teamId = team.id;
        player.teamName = team.name;
        player.leagueId = team.leagueId;
        player.region = team.region;
        assigned++;
      }
    }

    if (processed % 200 === 0) process.stdout.write(`\r  ${processed} team pages → ${assigned} players assigned`);
  }

  console.log(`\n  ✅ ${assigned}/${world.players.length} players assigned to teams (${processed} team pages scanned)`);
  fs.writeFileSync(path.join(OUTPUT, "world.json"), JSON.stringify(world, null, 2));
  console.log("  ✅ output/world.json updated");
}

main().catch(console.error);
