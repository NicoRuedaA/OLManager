#!/usr/bin/env tsx
/** OLManager Leaguepedia Scraper — Full pipeline */

import fs from "fs";
import path from "path";
import { apiGet, clearCache } from "./api";
import { discoverAllPlayers, discoverAllTeams } from "./discover";
import { parseInfobox, classifyInfobox, infoboxToPlayer, parseTeamInfobox, infoboxToTeam, parseTeamHistory, mapTeamHistoryToCareer } from "./parse";
import { infoboxToStaff } from "./parse";
import { findPlayerImage, resolveImageUrl, convertToWebp } from "./images";
import { generateLolStats, statsToAttributes, estimateMarketValue, estimatePotential, estimateWage, calculateOvr } from "./stats";
import type { ScrapedPlayer, ScrapedStaff, ScrapedTeam, ScraperOutput } from "./types";

const OUTPUT = "output";
const PLAYER_PHOTOS = "output/player-photos";
const STAFF_PHOTOS = "output/staff-photos";

async function main() {
  const args = process.argv.slice(2);
  const skipImages = args.includes("--skip-images");
  const limit = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "0") || 0;
  const teamLimit = parseInt(args.find(a => a.startsWith("--team-limit="))?.split("=")[1] ?? "0") || limit;

  if (args.includes("--clear-cache")) { clearCache(); console.log("🗑️  Cache cleared"); return; }

  for (const d of [OUTPUT, PLAYER_PHOTOS, STAFF_PHOTOS]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }

  console.log("=".repeat(60));
  console.log("🎮 OLManager Leaguepedia Scraper");
  console.log("=".repeat(60));

  const start = Date.now();

  // ─── Step 1: Discover ──────────────────────────────────────
  console.log("\n📋 Step 1: Page discovery");
  const teamPages = await discoverAllTeams();
  const playerPages = await discoverAllPlayers(limit > 0 ? limit : 0);
  console.log();

  // ─── Step 2: Extract teams ─────────────────────────────────
  console.log("🏢 Step 2: Team extraction");
  const allTeams: ScrapedTeam[] = [];
  let tErr = 0;

  const knownRegions = new Set(["EMEA", "Europe", "Korea", "China", "NA", "North America",
    "APAC", "Southeast Asia", "Vietnam", "VN", "Brazil", "LATAM", "Japan", "OCE", "Oceania", "Turkey", "TR",
    "CIS", "Middle East", "MENA"]);

  for (let i = 0; i < teamPages.length && (teamLimit === 0 || i < teamLimit); i++) {
    try {
      const json = await apiGet({ action: "parse", page: teamPages[i], prop: "wikitext" });
      const ib = parseTeamInfobox(json.parse?.wikitext?.["*"] ?? "");
      if (ib) {
        const team = infoboxToTeam(ib, teamPages[i]);
        if (team) { team.sourcePage = teamPages[i]; allTeams.push(team); }
      }
    } catch { tErr++; }
    if ((i + 1) % 10 === 0) process.stdout.write(`\r  Teams: ${i + 1}/${teamPages.length} (${allTeams.length} extracted)`);
  }

  const activeTeams = allTeams.filter(t => !t.isDisbanded);
  const historicalTeams = allTeams.filter(t => t.isDisbanded);
  console.log(`\n  ✅ ${activeTeams.length} active + ${historicalTeams.length} historical (${tErr} errors)`);

  // Build team name → teamId map
  const teamNameToId = new Map<string, string>();
  for (const t of [...activeTeams, ...historicalTeams]) {
    const key = t.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    teamNameToId.set(key, t.id);
    // Also map by short name
    teamNameToId.set(t.shortName.toLowerCase(), t.id);
  }

  // ─── Step 3: Extract active players ────────────────────────
  console.log("\n🎮 Step 3: Player extraction + stats generation");

  const players: ScrapedPlayer[] = [];
  const staff: ScrapedStaff[] = [];
  let pErr = 0, pSkipped = 0;

  for (let i = 0; i < playerPages.length && (limit === 0 || i < limit); i++) {
    try {
      const json = await apiGet({ action: "parse", page: playerPages[i], prop: "wikitext|images" });
      const wt = json.parse?.wikitext?.["*"] ?? "";
      const images: string[] = json.parse?.images ?? [];
      if (!wt) { pSkipped++; continue; }

      const ib = parseInfobox(wt);
      if (!ib || !ib.id) { pSkipped++; continue; }

      const kind = classifyInfobox(ib);
      if (kind === "skip") { pSkipped++; continue; }

      if (kind === "staff") {
        const s = infoboxToStaff(ib, playerPages[i]);
        if (s) {
          if (!skipImages && s.photoId) {
            const img = findPlayerImage(images);
            if (img) {
              const url = await resolveImageUrl(img);
              if (url) {
                s.photoUrl = url;
                try {
                  const res = await fetch(url, { headers: { "User-Agent": "OLManager-Scraper/0.1" }, signal: AbortSignal.timeout(10000) });
                  if (res.ok) await convertToWebp(Buffer.from(await res.arrayBuffer()), path.join(STAFF_PHOTOS, `${s.photoId}.webp`), 256, 80);
                } catch {}
              }
            }
          }
          staff.push(s);
        }
        continue;
      }

      const player = infoboxToPlayer(ib, playerPages[i]);
      if (!player || player.status !== "Active") { pSkipped++; continue; }

      // Parse TeamHistory → career + teamId
      const history = parseTeamHistory(wt);
      if (history.length > 0) {
        const { career, currentTeamId } = mapTeamHistoryToCareer(history, teamNameToId);
        player.career = career;
        if (currentTeamId) {
          player.teamId = currentTeamId;
          const team = [...activeTeams, ...historicalTeams].find(t => t.id === currentTeamId);
          if (team) { player.teamName = team.name; player.leagueId = team.leagueId; player.region = team.region; }
        }
      }

      // Generate stats
      if (player.role) {
        const lolStats = generateLolStats(player.ign, player.role);
        player.attributes = statsToAttributes(lolStats, player.role);
        const ovr = calculateOvr(player.attributes);
        player.ovr = ovr;
        player.potentialBase = estimatePotential(ovr, player.dateOfBirth ? calcAge(player.dateOfBirth) : null);
        player.marketValue = estimateMarketValue(ovr, player.potentialBase);
        player.wage = player.region ? estimateWage(ovr, player.region) : estimateWage(ovr, "EMEA");
      }

      // Resolve image
      if (!skipImages && player.photoId) {
        const img = findPlayerImage(images);
        if (img) {
          const url = await resolveImageUrl(img);
          if (url) {
            player.photoUrl = url;
            try {
              const res = await fetch(url, { headers: { "User-Agent": "OLManager-Scraper/0.1" }, signal: AbortSignal.timeout(10000) });
              if (res.ok) await convertToWebp(Buffer.from(await res.arrayBuffer()), path.join(PLAYER_PHOTOS, `${player.photoId}.webp`), 256, 80);
            } catch {}
          }
        }
      }

      players.push(player);
    } catch { pErr++; }
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\r  ${i + 1}/${playerPages.length} — ${players.length}P + ${staff.length}S (${pSkipped} skipped)`);
    }
  }

  console.log(`\n  ✅ ${players.length} active players + ${staff.length} staff (${pSkipped} skipped, ${pErr} errors)`);

  // ─── Step 4: Dedup ─────────────────────────────────────────
  console.log("\n🔍 Deduplication");
  const dedupPlayers = dedupList(players, p => `${p.ign.toLowerCase()}-${p.dateOfBirth ?? "unknown"}`);
  const dedupStaff = dedupList(staff, s => `${s.ign.toLowerCase()}-${s.dateOfBirth ?? "unknown"}`);
  console.log(`  Players: ${players.length} → ${dedupPlayers.length}`);
  console.log(`  Staff:   ${staff.length} → ${dedupStaff.length}`);

  // ─── Step 5: Output ─────────────────────────────────────────
  console.log("\n💾 Output");

  const output: ScraperOutput = {
    meta: {
      version: "1.0.0",
      scrapedAt: new Date().toISOString(),
      source: "Leaguepedia (lol.fandom.com)",
      totalPlayers: dedupPlayers.length,
      totalStaff: dedupStaff.length,
      totalTeams: activeTeams.length,
      totalHistoricalTeams: historicalTeams.length,
      leaguesScraped: [""],
      playerPhotosPath: "/player-photos/",
      staffPhotosPath: "/staff-photos/",
    },
    leagues: [],
    teams: activeTeams,
    historicalTeams,
    players: dedupPlayers,
    staff: dedupStaff,
  };

  fs.writeFileSync(path.join(OUTPUT, "world.json"), JSON.stringify(output, null, 2));
  fs.writeFileSync(path.join(OUTPUT, "staff.json"), JSON.stringify({ meta: output.meta, staff: dedupStaff }, null, 2));

  console.log(`  ✅ output/world.json  (${dedupPlayers.length}P + ${activeTeams.length}T)`);
  console.log(`  ✅ output/staff.json  (${dedupStaff.length}S)`);

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
  console.log(`\n🏁 Done in ${elapsed} min`);
}

function dedupList<T>(list: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return list.filter(item => {
    const k = keyFn(item);
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

function calcAge(dob: string): number | null {
  try {
    const birth = new Date(dob);
    return Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  } catch { return null; }
}

main().catch(console.error);
