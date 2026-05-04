/**
 * Phase 0: Single-shot research — one request at a time with delays.
 */
const API_URL = "https://lol.fandom.com/api.php";
const DELAY = 2000; // 2s between requests

async function apiRequest(params: Record<string, string>) {
  const url = new URL(API_URL);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "OLManager-Scraper/0.1 (research; contact via GitHub)" },
  });
  const json = JSON.parse(await res.text());

  if (json.error) {
    console.log(`  ⚠️  API error: ${json.error.code} — ${json.error.info}`);
    return null;
  }

  return json;
}

async function main() {
  console.log("🔬 OLManager Leaguepedia Scraper — Phase 0 Research");
  console.log(`   API: ${API_URL}`);
  console.log();

  // ─── Step 1: Check if Players table exists ──────────────────────
  console.log("1. Does 'Players' table exist?");
  let result = await apiRequest({
    action: "cargoquery",
    format: "json",
    tables: "Players",
    fields: "Name",
    limit: "1",
  });

  if (result?.cargoquery) {
    const row = result.cargoquery[0]?.title;
    console.log(`   ✅ YES. Sample: Name = "${row?.Name ?? "?"}"`);
    console.log(`   Row structure:`, JSON.stringify(result.cargoquery[0], null, 2));
  } else {
    console.log("   ❌ NO or rate limited.");
  }
  console.log();

  // ─── Step 2: Check other table names ────────────────────────────
  await sleep(DELAY);
  console.log("2. Table discovery");
  const tables = ["Players", "Teams", "Tournaments", "Leagues", "MatchSchedule", "TournamentRosters"];

  for (const table of tables) {
    await sleep(DELAY);
    result = await apiRequest({
      action: "cargoquery",
      format: "json",
      tables: table,
      fields: "Name" + (table === "Leagues" ? ",League" : ""),
      limit: "1",
    });

    if (result?.cargoquery) {
      const row = result.cargoquery[0]?.title ?? {};
      const sampleValue = Object.values(row)[0] ?? "?";
      console.log(`   ✅ ${table.padEnd(22)} — ${String(sampleValue).slice(0, 40)}`);
    } else {
      console.log(`   ❌ ${table}`);
    }
  }
  console.log();

  // ─── Step 3: LEC player sample ──────────────────────────────────
  await sleep(DELAY);
  console.log("3. LEC players — sample with all fields");
  result = await apiRequest({
    action: "cargoquery",
    format: "json",
    tables: "Players",
    fields: "Name,NameFull,Birthdate,Country,Role,Team,Image,IsRetired,Residency,ContractEnd,League,Region,_pageName",
    where: 'League = "LEC"',
    limit: "3",
  });

  if (result?.cargoquery) {
    for (const item of result.cargoquery) {
      const p = item.title;
      console.log(`\n   🎮 ${p.Name || "?"} (${p.NameFull || "?"})`);
      console.log(`      Role: ${p.Role || "?"}  | Team: ${p.Team || "?"}`);
      console.log(`      Country: ${p.Country || "?"}  | Born: ${p.Birthdate || "?"}`);
      console.log(`      League: ${p.League || "?"}  | Region: ${p.Region || "?"}`);
      console.log(`      Retired: ${p.IsRetired || "?"}  | Residency: ${p.Residency || "?"}`);
      console.log(`      Contract: ${p.ContractEnd || "?"}`);
      console.log(`      Image: ${p.Image?.slice(0, 100) || "NONE"}`);
    }
  }
  console.log();

  // ─── Step 4: Role values ────────────────────────────────────────
  await sleep(DELAY);
  console.log("4. Role distribution (500 players)");
  result = await apiRequest({
    action: "cargoquery",
    format: "json",
    tables: "Players",
    fields: "Role",
    limit: "500",
  });

  if (result?.cargoquery) {
    const roles: Record<string, number> = {};
    for (const item of result.cargoquery) {
      const role = (item.title?.Role ?? "NULL").trim();
      roles[role] = (roles[role] ?? 0) + 1;
    }
    for (const [role, count] of Object.entries(roles).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${role.padEnd(20)} ${count}`);
    }
  }
  console.log();

  // ─── Step 5: Country values ─────────────────────────────────────
  await sleep(DELAY);
  console.log("5. Country values (300 players)");
  result = await apiRequest({
    action: "cargoquery",
    format: "json",
    tables: "Players",
    fields: "Country",
    limit: "300",
  });

  if (result?.cargoquery) {
    const countries = new Set<string>();
    for (const item of result.cargoquery) {
      const c = (item.title?.Country ?? "").trim();
      if (c) countries.add(c);
    }
    for (const c of [...countries].sort()) {
      const isIso = /^[A-Z]{2}$/.test(c);
      console.log(`   ${isIso ? "ISO" : "NAM"}  ${c}`);
    }
  }
  console.log();

  // ─── Step 6: Image URL patterns ─────────────────────────────────
  await sleep(DELAY);
  console.log("6. Image URLs (20 LEC/LCK players with images)");
  result = await apiRequest({
    action: "cargoquery",
    format: "json",
    tables: "Players",
    fields: "Image, Name",
    where: '(League = "LEC" OR League = "LCK") AND Image IS NOT NULL AND Image != ""',
    limit: "20",
  });

  if (result?.cargoquery) {
    const urls = [...new Set(result.cargoquery.map((i) => i.title?.Image ?? "").filter(Boolean))];
    console.log(`   ${urls.length} unique URLs:`);
    for (const url of urls.slice(0, 8)) {
      const ext = url.split(".").pop()?.split(/[?#]/)[0] ?? "?";
      console.log(`   [.${ext}] ${url.slice(0, 100)}`);
    }
  }
  console.log();

  // ─── Step 7: Image download test ────────────────────────────────
  await sleep(DELAY);
  console.log("7. Image download + WebP conversion test");
  result = await apiRequest({
    action: "cargoquery",
    format: "json",
    tables: "Players",
    fields: "Image, Name",
    where: 'League = "LEC" AND Image IS NOT NULL AND Image != ""',
    limit: "3",
  });

  if (result?.cargoquery) {
    for (const item of result.cargoquery) {
      const imgUrl = item.title?.Image?.trim();
      const name = item.title?.Name ?? "unknown";
      if (!imgUrl) continue;

      await sleep(500);
      console.log(`\n   ${name} → ${imgUrl.slice(0, 90)}`);

      try {
        const imgRes = await fetch(imgUrl, {
          headers: { "User-Agent": "OLManager-Scraper/0.1 (research)" },
          signal: AbortSignal.timeout(10000),
        });

        if (!imgRes.ok) {
          console.log(`   ❌ HTTP ${imgRes.status}`);
          continue;
        }

        const buffer = Buffer.from(await imgRes.arrayBuffer());
        const contentType = imgRes.headers.get("content-type");
        console.log(`   ✅ ${(buffer.length / 1024).toFixed(1)} KB | ${contentType}`);

        // WebP conversion
        try {
          const sharp = (await import("sharp")).default;
          const webp = await sharp(buffer)
            .resize(256, 256, { fit: "cover", position: "center" })
            .webp({ quality: 80 })
            .toBuffer();

          const savings = ((1 - webp.length / buffer.length) * 100).toFixed(0);
          console.log(`   ✅ WebP 256px: ${(webp.length / 1024).toFixed(1)} KB (${savings}% smaller)`);
        } catch (e: any) {
          console.log(`   ⚠️  sharp: ${e.message}`);
        }
      } catch (e: any) {
        console.log(`   ❌ ${e.message}`);
      }
    }
  }

  console.log();
  console.log("🏁 Phase 0 research complete!");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(console.error);
