#!/usr/bin/env node

/**
 * download-champion-assets.mjs
 *
 * Fetches all champion tiles + splash art from Riot Data Dragon CDN,
 * converts them to WebP via sharp, and writes them to public/champion-tiles/
 * and public/champion-splash/.
 *
 * Usage: node scripts/download-champion-assets.mjs
 *
 * Concurrency: batch size of 10 to avoid CDN throttling.
 *
 * Plan-only task — run manually when ready.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import sharp from "sharp";

const ROOT = resolve(process.cwd());
const DDragonCDN = "https://ddragon.leagueoflegends.com";
const TileEndpoint = "/cdn/img/champion/tiles";
const SplashEndpoint = "/cdn/img/champion/splash";
const TILE_DIR = resolve(ROOT, "public/champion-tiles");
const SPLASH_DIR = resolve(ROOT, "public/champion-splash");
const DATA_DIR = resolve(ROOT, "data/draft");
const CONCURRENCY = 10;

/**
 * Custom champion entries not in DDragon.
 * Maps a normalized lookup key to champion data.
 */
const CUSTOM_CHAMPIONS = {
  yunara: {
    id: "Yunara",
    key: "804",
    name: "Yunara",
    tags: ["Mage", "Assassin"],
    image: { full: "Yunara.png" },
  },
};

/**
 * Fetch champion list from DDragon champion.json.
 * Returns both keys array and full champion data object.
 */
async function fetchChampionData() {
  const versionResp = await fetch(`${DDragonCDN}/api/versions.json`);
  const versions = await versionResp.json();
  const latest = versions[0];

  const champResp = await fetch(
    `${DDragonCDN}/cdn/${latest}/data/en_US/champion.json`,
  );
  const champData = await champResp.json();

  // Merge custom champions into the data (override if already exists)
  for (const [lookup, custom] of Object.entries(CUSTOM_CHAMPIONS)) {
    champData.data[custom.id] = custom;
  }

  return {
    keys: Object.keys(champData.data),
    data: champData.data,
    version: latest,
  };
}

/**
 * Download a single image from a URL, convert to WebP, and save to disk.
 * Returns the destination path on success, or null on failure.
 */
async function downloadAndConvert(url, destPath) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`[SKIP] ${url} → HTTP ${resp.status}`);
      return null;
    }

    const buffer = Buffer.from(await resp.arrayBuffer());
    const webpBuffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();

    await mkdir(dirname(destPath), { recursive: true });
    await writeFile(destPath, webpBuffer);
    return destPath;
  } catch (err) {
    console.warn(`[FAIL] ${url} → ${err.message}`);
    return null;
  }
}

/**
 * Process an array of items with a concurrency limit.
 * Each item is a { url, dest } object.
 */
async function batchDownload(items) {
  const results = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((item) => downloadAndConvert(item.url, item.dest)),
    );
    results.push(...batchResults);
    // Brief pause between batches to be nice to CDN
    if (i + CONCURRENCY < items.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return results;
}

async function main() {
  console.log("Fetching champion list from DDragon…");
  const { keys, data, version } = await fetchChampionData();
  console.log(`Found ${keys.length} champions (including custom)`);

  // Build tile items
  const tileItems = keys.map((key) => ({
    url: `${DDragonCDN}${TileEndpoint}/${key}_0.jpg`,
    dest: resolve(TILE_DIR, `${key}.webp`),
  }));

  // Build splash items
  const splashItems = keys.map((key) => ({
    url: `${DDragonCDN}${SplashEndpoint}/${key}_0.jpg`,
    dest: resolve(SPLASH_DIR, `${key}.webp`),
  }));

  console.log(`Downloading ${tileItems.length} tiles…`);
  const savedTiles = await batchDownload(tileItems);
  const tileOk = savedTiles.filter(Boolean).length;
  console.log(`Tiles: ${tileOk}/${tileItems.length} saved`);

  console.log(`Downloading ${splashItems.length} splashes…`);
  const savedSplashes = await batchDownload(splashItems);
  const splashOk = savedSplashes.filter(Boolean).length;
  console.log(`Splashes: ${splashOk}/${splashItems.length} saved`);

  // Export champion list JSON
  const championList = Object.entries(data).map(([id, champ]) => ({
    id,
    key: Number(champ.key),
    name: champ.name,
    tags: champ.tags ?? [],
    image: champ.image?.full ?? `${id}.png`,
  }));

  await mkdir(DATA_DIR, { recursive: true });
  const championListPath = resolve(DATA_DIR, "champion-list.json");
  await writeFile(
    championListPath,
    JSON.stringify({ version, champions: championList }, null, 2),
  );
  console.log(`Champion list saved to ${championListPath}`);

  console.log("Done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
