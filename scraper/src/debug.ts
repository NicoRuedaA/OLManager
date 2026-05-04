/**
 * Quick debug: check raw API response structure
 */

const API_URL = "https://lol.fandom.com/api.php";

async function debug() {
  // Test 1: Basic cargoquery
  const url = new URL(API_URL);
  url.searchParams.set("action", "cargoquery");
  url.searchParams.set("format", "json");
  url.searchParams.set("tables", "Players");
  url.searchParams.set("fields", "Name, Role, Team, League");
  url.searchParams.set("where", 'League = "LEC"');
  url.searchParams.set("limit", "2");

  console.log("Request URL:", url.toString());
  console.log();

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "OLManager-Scraper/0.1 (research)" },
  });

  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Content-Type:", res.headers.get("content-type"));
  console.log("Response length:", text.length);
  console.log();

  try {
    const json = JSON.parse(text);
    console.log("Top-level keys:", Object.keys(json));
    console.log();

    if (json.cargoquery) {
      console.log("cargoquery is array:", Array.isArray(json.cargoquery));
      console.log("cargoquery length:", json.cargoquery.length);
      if (json.cargoquery.length > 0) {
        console.log("First item keys:", Object.keys(json.cargoquery[0]));
        console.log("First item:", JSON.stringify(json.cargoquery[0], null, 2));
      }
    } else if (json.error) {
      console.log("Error:", JSON.stringify(json.error, null, 2));
    } else {
      console.log("Full response (first 2000 chars):");
      console.log(JSON.stringify(json, null, 2).slice(0, 2000));
    }
  } catch (e) {
    console.log("Failed to parse JSON. Raw response (first 1000 chars):");
    console.log(text.slice(0, 1000));
  }

  // Test 2: Try without where clause
  console.log("\n" + "=".repeat(60));
  console.log("Test 2: No WHERE clause");
  console.log("=".repeat(60));

  const url2 = new URL(API_URL);
  url2.searchParams.set("action", "cargoquery");
  url2.searchParams.set("format", "json");
  url2.searchParams.set("tables", "Players");
  url2.searchParams.set("fields", "Name, Role");
  url2.searchParams.set("limit", "2");

  const res2 = await fetch(url2.toString(), {
    headers: { "User-Agent": "OLManager-Scraper/0.1 (research)" },
  });

  const json2 = JSON.parse(await res2.text());
  console.log("Status:", res2.status);
  console.log("cargoquery exists:", !!json2.cargoquery);
  if (json2.cargoquery && json2.cargoquery.length > 0) {
    console.log("Found", json2.cargoquery.length, "results");
    console.log("Sample:", JSON.stringify(json2.cargoquery[0], null, 2));
  } else if (json2.error) {
    console.log("Error:", JSON.stringify(json2.error, null, 2));
  }

  // Test 3: Try different table naming
  console.log("\n" + "=".repeat(60));
  console.log("Test 3: Try 'Player' (singular)");
  console.log("=".repeat(60));

  for (const table of ["Players", "Player", "Teams", "Team", "Tournaments_Players"]) {
    const u = new URL(API_URL);
    u.searchParams.set("action", "cargoquery");
    u.searchParams.set("format", "json");
    u.searchParams.set("tables", table);
    u.searchParams.set("fields", "Name");
    u.searchParams.set("limit", "1");

    const r = await fetch(u.toString(), {
      headers: { "User-Agent": "OLManager-Scraper/0.1 (research)" },
    });
    const j = JSON.parse(await r.text());
    if (j.error) {
      console.log(`${table}: ERROR — ${JSON.stringify(j.error).slice(0, 150)}`);
    } else if (j.cargoquery) {
      console.log(`${table}: OK — ${j.cargoquery.length} results`);
    } else {
      console.log(`${table}: UNKNOWN — keys:`, Object.keys(j));
    }
  }
}

debug().catch(console.error);
