#!/usr/bin/env tsx
/** OLManager Leaguepedia Scraper — Main orchestrator */

import fs from "fs";
import path from "path";
import { apiGet, clearCache } from "./api";
import { discoverAllPlayers } from "./discover";
import { parseInfobox, infoboxToPlayer } from "./parse";
import { findPlayerImage, resolveImageUrl, convertToWebp } from "./images";
import { OUTPUT_DIR, PHOTOS_DIR } from "./config";
import type { WorldOutput, ScrapedPlayer, ScrapedLeague } from "./types";

const BATCH_SIZE = 50;
const MAX_PLAYERS = 0; // 0 = unlimited

async function main() {
  console.log("=".repeat(60));
  console.log("🎮 OLManager Leaguepedia Scraper");
  console.log("=".repeat(60));

  // Ensure output dirs exist
  for (const dir of [OUTPUT_DIR, PHOTOS_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  const args = process.argv.slice(2);
  const skipImages = args.includes("--skip-images");
  const limit = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "0") || MAX_PLAYERS;

  if (args.includes("--clear-cache")) {
    clearCache();
    console.log("🗑️  Cache cleared");
    return;
  }

  const startTime = Date.now();

  // ─── Step 1: Discover all player pages ──────────────────────
  console.log("\n📋 Step 1: Player discovery");
  let playerPages = await discoverAllPlayers(limit > 0 ? limit : 0);

  // ─── Step 2: Extract player data ─────────────────────────────
  console.log("\n📊 Step 2: Player data extraction");
  const players: ScrapedPlayer[] = [];
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < playerPages.length; i += BATCH_SIZE) {
    const batch = playerPages.slice(i, i + BATCH_SIZE);

    for (const pageTitle of batch) {
      processed++;

      try {
        const json = await apiGet({
          action: "parse",
          page: pageTitle,
          prop: "wikitext|images",
        });

        const wt = json.parse?.wikitext?.["*"] ?? "";
        const images: string[] = json.parse?.images ?? [];

        if (!wt) {
          skipped++;
          continue;
        }

        const ib = parseInfobox(wt);
        if (!ib || !ib.id) {
          skipped++;
          continue;
        }

        const player = infoboxToPlayer(ib, pageTitle);
        if (!player) {
          skipped++;
          continue;
        }

        // Resolve image
        if (!skipImages && player.photoId) {
          const img = findPlayerImage(images);
          if (img) {
            const url = await resolveImageUrl(img);
            if (url) {
              player.photoUrl = url;

              // Download and convert
              try {
                const res = await fetch(url, {
                  headers: { "User-Agent": "OLManager-Scraper/0.1" },
                  signal: AbortSignal.timeout(10000),
                });
                if (res.ok) {
                  const buffer = Buffer.from(await res.arrayBuffer());
                  const photoPath = path.join(PHOTOS_DIR, `${player.photoId}.webp`);
                  await convertToWebp(buffer, photoPath, 256, 80);
                }
              } catch {
                // Image download failed — continue without photo
              }
            }
          }
        }

        players.push(player);
      } catch (err: any) {
        errors++;
        if (errors <= 5) {
          console.warn(`  ⚠️  Error on "${pageTitle}": ${err.message}`);
        }
      }

      // Progress indicator
      if (processed % 10 === 0) {
        const pct = ((processed / playerPages.length) * 100).toFixed(1);
        process.stdout.write(`\r  Progress: ${processed}/${playerPages.length} (${pct}%) — ${players.length} players, ${errors} errors`);
      }
    }
  }

  console.log(`\n  ✅ Done: ${players.length} players extracted (${skipped} skipped, ${errors} errors)`);

  // ─── Step 3: Deduplicate ─────────────────────────────────────
  console.log("\n🔍 Step 3: Deduplication");
  const seen = new Set<string>();
  const deduped: ScrapedPlayer[] = [];

  for (const player of players) {
    const key = `${player.ign.toLowerCase()}-${player.dateOfBirth ?? "unknown"}`;
    if (seen.has(key)) {
      // Merge champion pools
      const existing = deduped.find(p =>
        `${p.ign.toLowerCase()}-${p.dateOfBirth ?? "unknown"}` === key
      );
      if (existing) {
        existing.championPool = [...new Set([...existing.championPool, ...player.championPool])].slice(0, 5);
      }
      continue;
    }
    seen.add(key);
    deduped.push(player);
  }

  console.log(`  Removed ${players.length - deduped.length} duplicates → ${deduped.length} unique players`);

  // ─── Step 4: Build league stats ──────────────────────────────
  console.log("\n📈 Step 4: League statistics");
  const leagues: Record<string, ScrapedLeague> = {};
  for (const player of deduped) {
    const lid = player.leagueId ?? "unknown";
    if (!leagues[lid]) {
      leagues[lid] = {
        id: lid,
        name: player.leagueName ?? lid.toUpperCase(),
        shortName: lid.toUpperCase().slice(0, 4),
        region: player.region ?? "Unknown",
        tier: "primary",
        teams: [],
        playerCount: 0,
      };
    }
    leagues[lid].playerCount++;
    if (player.teamName && !leagues[lid].teams.includes(player.teamName)) {
      leagues[lid].teams.push(player.teamName);
    }
  }

  // ─── Step 5: Write output ────────────────────────────────────
  console.log("\n💾 Step 5: Writing output");

  const output: WorldOutput = {
    meta: {
      version: "1.0.0",
      scrapedAt: new Date().toISOString(),
      source: "Leaguepedia (lol.fandom.com)",
      totalPlayers: deduped.length,
      totalTeams: Object.values(leagues).reduce((sum, l) => sum + l.teams.length, 0),
      leaguesScraped: Object.keys(leagues),
      imageBasePath: "/player-photos/",
    },
    leagues: Object.values(leagues),
    teams: [],
    players: deduped,
  };

  const playersPath = path.join(OUTPUT_DIR, "players.json");
  fs.writeFileSync(playersPath, JSON.stringify(output, null, 2));
  console.log(`  ✅ ${playersPath} (${(fs.statSync(playersPath).size / 1024 / 1024).toFixed(1)} MB)`);

  // Summary stats
  const activePlayers = deduped.filter(p => p.status === "Active").length;
  const withPhotos = deduped.filter(p => p.photoId).length;
  const roles = deduped.reduce((acc, p) => {
    if (p.role) acc[p.role] = (acc[p.role] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log("\n📊 Summary:");
  console.log(`  Total players:    ${deduped.length}`);
  console.log(`  Active:           ${activePlayers}`);
  console.log(`  Retired/Inactive: ${deduped.length - activePlayers}`);
  console.log(`  With photos:      ${withPhotos} (${((withPhotos / deduped.length) * 100).toFixed(0)}%)`);
  console.log(`  Roles:            ${Object.entries(roles).map(([r, c]) => `${r}: ${c}`).join(", ")}`);
  console.log(`  Leagues:          ${Object.keys(leagues).length}`);
  console.log(`  Images:           ${fs.readdirSync(PHOTOS_DIR).filter(f => f.endsWith(".webp")).length} webp files`);

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n🏁 Scrape complete in ${elapsed} min`);
}

main().catch(console.error);
