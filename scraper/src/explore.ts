/**
 * Phase 0: Explore Leaguepedia CargoTables API
 *
 * This script queries the MediaWiki Cargo API to understand:
 * 1. What tables exist and what fields they have
 * 2. What data is available for LEC players/teams
 * 3. Image URL structure
 * 4. Data quality and normalization needs
 */

const API_URL = "https://lol.fandom.com/api.php";

interface CargoQueryParams {
  tables: string;
  fields: string;
  where?: string;
  limit?: number;
  offset?: number;
}

interface CargoResult {
  cargoquery: Array<{ title: Record<string, string> }>;
}

async function cargoQuery(params: CargoQueryParams): Promise<Record<string, string>[]> {
  const url = new URL(API_URL);
  url.searchParams.set("action", "cargoquery");
  url.searchParams.set("format", "json");
  url.searchParams.set("tables", params.tables);
  url.searchParams.set("fields", params.fields);
  if (params.where) url.searchParams.set("where", params.where);
  url.searchParams.set("limit", String(params.limit ?? 50));
  if (params.offset) url.searchParams.set("offset", String(params.offset));

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": "OLManager-Scraper/0.1 (research; contact@olmanager.dev)" },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as CargoResult;
  return data.cargoquery.map((row) => row.title);
}

// ─── Table Discovery ────────────────────────────────────────────

async function discoverTables() {
  console.log("=".repeat(60));
  console.log("TABLE DISCOVERY — What tables are available?");
  console.log("=".repeat(60));
  console.log();

  // These are suspected table names. Let's test each.
  const candidates = ["Players", "Teams", "Leagues", "Tournaments", "MatchSchedule", "TournamentRosters", "PlayerImages"];

  for (const table of candidates) {
    try {
      const rows = await cargoQuery({ tables: table, fields: "_pageName", limit: 1 });
      console.log(`✅ ${table}: OK (sample page: ${rows[0]?._pageName ?? "N/A"})`);
    } catch (err: any) {
      console.log(`❌ ${table}: ${err.message}`);
    }
  }
  console.log();
}

// ─── Players — LEC ──────────────────────────────────────────────

async function explorePlayers(table: string) {
  console.log("=".repeat(60));
  console.log(`PLAYERS — ${table.toUpperCase()} table fields`);
  console.log("=".repeat(60));
  console.log();

  // Query with ALL fields we're interested in
  const fields = [
    "ID",
    "Name",
    "NameFull",
    "Birthdate",
    "Country",
    "Role",
    "Team",
    "Image",
    "IsRetired",
    "Residency",
    "ContractEnd",
    "Earnings",
    "League",
    "Region",
    "_pageName",
  ].join(", ");

  try {
    const where = 'League = "LEC"';
    const rows = await cargoQuery({ tables: table, fields, where, limit: 5 });

    if (rows.length === 0) {
      console.log("No results for LEC. Trying without league filter...");
      const allRows = await cargoQuery({ tables: table, fields, limit: 3 });
      if (allRows.length > 0) {
        console.log("Sample rows (any league):");
        console.log(JSON.stringify(allRows[0], null, 2));
      }
      return;
    }

    console.log(`Found ${rows.length} sample players in LEC:`);
    for (const row of rows) {
      console.log(`\n  🎮 ${row.Name} (${row.NameFull || "?"})`);
      console.log(`     Role: ${row.Role || "?"} | Team: ${row.Team || "?"} | Country: ${row.Country || "?"}`);
      console.log(`     Born: ${row.Birthdate || "?"} | Status: ${row.IsRetired === "1" ? "Retired" : "Active"}`);
      console.log(`     Residency: ${row.Residency || "?"} | Contract: ${row.ContractEnd || "?"}`);
      console.log(`     Image: ${row.Image || "NONE"}`);
      console.log(`     Page:  ${row._pageName || "?"}`);
    }

    // Check field coverage (how many have non-null values)
    const allRows = await cargoQuery({ tables: table, fields, where, limit: 50 });
    console.log(`\n  Field coverage (${allRows.length} players):`);
    const coverage: Record<string, number> = {};
    for (const row of allRows) {
      for (const key of Object.keys(row)) {
        if (key.startsWith("_")) continue;
        if (row[key] && row[key] !== "null" && row[key] !== "") {
          coverage[key] = (coverage[key] ?? 0) + 1;
        }
      }
    }
    const total = allRows.length;
    for (const [field, count] of Object.entries(coverage).sort((a, b) => b[1] - a[1])) {
      const pct = ((count / total) * 100).toFixed(0);
      const bar = "█".repeat(Math.round(count / total * 20));
      console.log(`    ${field.padEnd(15)} ${String(count).padStart(3)}/${total} ${pct.padStart(3)}% ${bar}`);
    }
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }
  console.log();
}

// ─── Teams — LEC ────────────────────────────────────────────────

async function exploreTeams(table: string) {
  console.log("=".repeat(60));
  console.log(`TEAMS — ${table.toUpperCase()} table fields`);
  console.log("=".repeat(60));
  console.log();

  const fields = [
    "Name",
    "Short",
    "Region",
    "League",
    "Image",
    "Logo",
    "Location",
    "IsDisbanded",
    "IsActive",
    "_pageName",
  ].join(", ");

  try {
    const where = 'League = "LEC"';
    const rows = await cargoQuery({ tables: table, fields, where, limit: 10 });

    if (rows.length === 0) {
      console.log(`No LEC teams in ${table} table.`);
      return;
    }

    console.log(`Found ${rows.length} teams in LEC:`);
    for (const row of rows) {
      const logo = row.Image || row.Logo || "NONE";
      console.log(`  🏢 ${row.Name.padEnd(25)} ${(row.Short || "?").padEnd(5)} | ${row.Region || "?"} | Logo: ${logo ? "✅" : "❌"}`);
    }
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }
  console.log();
}

// ─── Role distribution across all data ──────────────────────────

async function exploreRoles(table: string) {
  console.log("=".repeat(60));
  console.log("ROLE DISTRIBUTION — What role values exist?");
  console.log("=".repeat(60));
  console.log();

  try {
    const rows = await cargoQuery({
      tables: table,
      fields: "Role",
      limit: 500,
    });

    const roleCounts: Record<string, number> = {};
    for (const row of rows) {
      const role = (row.Role ?? "NULL").trim();
      roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    }

    const sorted = Object.entries(roleCounts).sort((a, b) => b[1] - a[1]);
    for (const [role, count] of sorted) {
      console.log(`  ${role.padEnd(25)} ${count}`);
    }
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }
  console.log();
}

// ─── Country values ─────────────────────────────────────────────

async function exploreCountries(table: string) {
  console.log("=".repeat(60));
  console.log("COUNTRY VALUES — ISO codes or full names?");
  console.log("=".repeat(60));
  console.log();

  try {
    const rows = await cargoQuery({
      tables: table,
      fields: "Country",
      limit: 500,
      where: 'Country IS NOT NULL AND Country != ""',
    });

    const countrySet = new Set<string>();
    for (const row of rows) {
      const country = (row.Country ?? "").trim();
      if (country) countrySet.add(country);
    }

    const countries = [...countrySet].sort();
    for (const country of countries) {
      const isIso2 = /^[A-Z]{2}$/.test(country);
      const marker = isIso2 ? "✅ ISO" : "⚠️  Name";
      console.log(`  ${marker}  ${country}`);
    }
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }
  console.log();
}

// ─── Image URL structure ────────────────────────────────────────

async function exploreImages(table: string) {
  console.log("=".repeat(60));
  console.log("IMAGE URLS — Structure and patterns");
  console.log("=".repeat(60));
  console.log();

  try {
    const rows = await cargoQuery({
      tables: "Players",
      fields: "Image, Name",
      limit: 20,
      where: '(League = "LEC" OR League = "LCK") AND Image IS NOT NULL AND Image != ""',
    });

    const urls = new Set<string>();
    for (const row of rows) {
      const img = (row.Image ?? "").trim();
      if (img) urls.add(img);
    }

    console.log(`Sample image URLs (${urls.size} unique):`);
    for (const url of [...urls].slice(0, 10)) {
      // Extract pattern info
      const isStatic = url.includes("static.lol.fandom.com");
      const isWiki = url.includes("lol.fandom.com/wiki/");
      const ext = url.split(".").pop()?.split("?")[0] ?? "?";
      console.log(`  [${ext.padEnd(4)}] [${isStatic ? "static" : "other"} ] ${url.slice(0, 120)}`);
    }
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }
  console.log();
}

// ─── Test image download + WebP conversion ──────────────────────

async function testImagePipeline() {
  console.log("=".repeat(60));
  console.log("IMAGE PIPELINE TEST — Download + WebP conversion");
  console.log("=".repeat(60));
  console.log();

  try {
    // Get a few player images
    const rows = await cargoQuery({
      tables: "Players",
      fields: "Image, Name",
      where: 'League = "LEC" AND Image IS NOT NULL AND Image != ""',
      limit: 3,
    });

    for (const row of rows) {
      const imgUrl = (row.Image ?? "").trim();
      if (!imgUrl) continue;

      console.log(`\n  Testing: ${row.Name} → ${imgUrl.slice(0, 100)}`);

      try {
        const res = await fetch(imgUrl, {
          headers: { "User-Agent": "OLManager-Scraper/0.1 (research)" },
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          console.log(`    ❌ HTTP ${res.status}`);
          continue;
        }

        const contentType = res.headers.get("content-type");
        const contentLength = res.headers.get("content-length");
        const buffer = Buffer.from(await res.arrayBuffer());

        console.log(`    ✅ Downloaded: ${(buffer.length / 1024).toFixed(1)} KB | type: ${contentType}`);

        // Try WebP conversion with sharp
        try {
          const sharp = (await import("sharp")).default;
          const webp = await sharp(buffer)
            .resize(256, 256, { fit: "cover", position: "center" })
            .webp({ quality: 80 })
            .toBuffer();

          const savings = ((1 - webp.length / buffer.length) * 100).toFixed(0);
          console.log(`    ✅ WebP 256px: ${(webp.length / 1024).toFixed(1)} KB (${savings}% smaller)`);

          // Save sample
          const fs = await import("fs/promises");
          const safeName = (row.Name ?? "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
          await fs.writeFile(`test-output/${safeName}.webp`, webp);
          console.log(`    💾 Saved: test-output/${safeName}.webp`);
        } catch (sharpErr: any) {
          console.log(`    ⚠️  sharp failed: ${sharpErr.message}`);
        }
      } catch (err: any) {
        console.log(`    ❌ ${err.message}`);
      }
    }
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }
  console.log();
}

// ─── Total player counts per league ─────────────────────────────

async function leagueStats(table: string) {
  console.log("=".repeat(60));
  console.log("LEAGUE STATS — Player counts per league");
  console.log("=".repeat(60));
  console.log();

  const leagues = ["LEC", "LCK", "LPL", "LCS", "PCS", "VCS", "LLA", "CBLOL", "LJL", "LCO"];

  for (const league of leagues) {
    try {
      const rows = await cargoQuery({
        tables: table,
        fields: "Name",
        where: `League = "${league}"`,
        limit: 200,
      });
      console.log(`  ${league.padEnd(8)} ${String(rows.length).padStart(4)} players`);
    } catch {
      console.log(`  ${league.padEnd(8)} ERROR`);
    }
  }
  console.log();
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log("🔬 OLManager Leaguepedia Scraper — Phase 0 Research");
  console.log(`   API: ${API_URL}`);
  console.log();

  const start = Date.now();

  await discoverTables();
  await explorePlayers("Players");
  await exploreTeams("Teams");
  await exploreRoles("Players");
  await exploreCountries("Players");
  await exploreImages("Players");
  await leagueStats("Players");
  await testImagePipeline();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n🏁 Phase 0 research complete in ${elapsed}s`);
}

main().catch(console.error);
