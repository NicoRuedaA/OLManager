#!/usr/bin/env tsx
/** Split world-exact.json into separated files by league and type */
import fs from "fs";
import path from "path";

const SRC = "../src-tauri/databases/world-exact.json";
const OUT = "../src-tauri/databases";

interface Team {
  id: string;
  name: string;
  country?: string;
  [key: string]: unknown;
}

interface Player {
  id: string;
  match_name: string;
  team_id: string | null;
  [key: string]: unknown;
}

interface Staff {
  id: string;
  first_name: string;
  team_id: string | null;
  [key: string]: unknown;
}

interface WorldData {
  name: string;
  description: string;
  teams: Team[];
  players: Player[];
  staff: Staff[];
}

function fixTeam(t: Team): Team {
  if (!("founded_year" in t)) (t as Record<string, unknown>).founded_year = 2000;
  return t;
}

const COUNTRY_LEAGUE: Record<string, string> = {
  GB: "lec", DE: "lec", FR: "lec", ES: "lec", IT: "lec",
  PT: "lec", NL: "lec", BE: "lec", SE: "lec", DK: "lec",
  NO: "lec", FI: "lec", PL: "lec", CZ: "lec", AT: "lec",
  CH: "lec", GR: "lec", TR: "lec", UA: "lec", RU: "lec",
  EE: "lec", LV: "lec", LT: "lec", SK: "lec", SI: "lec",
  HR: "lec", HU: "lec", RO: "lec", BG: "lec", RS: "lec",
  IE: "lec", IS: "lec", LU: "lec", MT: "lec", CY: "lec",
  IL: "lec",
  KR: "lck",
  CN: "lpl", TW: "lpl", HK: "lpl", MO: "lpl",
  US: "lcs", CA: "lcs",
  BR: "cblol",
  MX: "lla", AR: "lla", CL: "lla", PE: "lla", CO: "lla",
  CR: "lla", VE: "lla",
  JP: "ljl",
  AU: "lco", NZ: "lco",
  VN: "vcs",
  MY: "pcs", SG: "pcs", PH: "pcs", TH: "pcs", ID: "pcs",
};

function detectLeague(t: Team): string {
  return COUNTRY_LEAGUE[t.country?.toUpperCase() ?? ""] ?? "other";
}

function cleanDir(dir: string) {
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".json")) fs.unlinkSync(path.join(dir, f));
    }
  }
}

function main() {
  const raw = JSON.parse(fs.readFileSync(path.resolve(SRC), "utf-8")) as WorldData;

  // Clean output dirs
  cleanDir(path.resolve(OUT, "teams"));
  cleanDir(path.resolve(OUT, "players"));
  cleanDir(path.resolve(OUT, "staffs"));

  const { teams, players, staff } = raw;

  // Count players/staff per team
  const playerCount = new Map<string, number>();
  for (const p of players) {
    if (p.team_id) playerCount.set(p.team_id, (playerCount.get(p.team_id) || 0) + 1);
  }

  // Deduplicate teams by ID
  const seenIds = new Set<string>();
  const dedupTeams = (items: Team[]): Team[] =>
    items.filter(t => {
      if (seenIds.has(t.id)) {
        console.warn(`  ⚠️  Duplicate team ID: ${t.id} (${t.name}) — skipping`);
        return false;
      }
      seenIds.add(t.id);
      return true;
    });

  const activeTeams = dedupTeams(teams.filter(t => (playerCount.get(t.id) || 0) > 0)).map(fixTeam);
  const disbandedTeams = dedupTeams(teams.filter(t => (playerCount.get(t.id) || 0) === 0)).map(fixTeam);

  const teamPlayers = new Map<string, Player[]>();
  for (const p of players) {
    if (p.team_id) {
      if (!teamPlayers.has(p.team_id)) teamPlayers.set(p.team_id, []);
      teamPlayers.get(p.team_id)!.push(p);
    }
  }

  const teamStaff = new Map<string, Staff[]>();
  for (const s of staff) {
    if (s.team_id) {
      if (!teamStaff.has(s.team_id)) teamStaff.set(s.team_id, []);
      teamStaff.get(s.team_id)!.push(s);
    }
  }

  // Group by league
  const byLeague: Record<string, { active: Team[]; disbanded: Team[]; players: Player[]; staff: Staff[] }> = {};

  for (const t of activeTeams) {
    const league = detectLeague(t);
    if (!byLeague[league]) byLeague[league] = { active: [], disbanded: [], players: [], staff: [] };
    byLeague[league].active.push(t);
    const pl = teamPlayers.get(t.id) || [];
    byLeague[league].players.push(...pl);
    const st = teamStaff.get(t.id) || [];
    byLeague[league].staff.push(...st);
  }

  for (const t of disbandedTeams) {
    const league = detectLeague(t);
    if (!byLeague[league]) byLeague[league] = { active: [], disbanded: [], players: [], staff: [] };
    byLeague[league].disbanded.push(t);
  }

  const baseDir = path.resolve(OUT);

  for (const [league, groups] of Object.entries(byLeague)) {
    // Teams
    const teamDir = path.join(baseDir, "teams");
    fs.mkdirSync(teamDir, { recursive: true });
    if (groups.active.length > 0) {
      fs.writeFileSync(
        path.join(teamDir, `${league}_teams.json`),
        JSON.stringify({ name: `${league.toUpperCase()} Teams`, description: ``, teams: groups.active }, null, 2)
      );
      console.log(`✅ teams/${league}_teams.json (${groups.active.length} teams)`);
    }
    if (groups.disbanded.length > 0) {
      fs.writeFileSync(
        path.join(teamDir, `${league}_teams_disbanded.json`),
        JSON.stringify({ name: `${league.toUpperCase()} (Disbanded)`, description: ``, teams: groups.disbanded }, null, 2)
      );
      console.log(`✅ teams/${league}_teams_disbanded.json (${groups.disbanded.length} teams)`);
    }

    // Players
    const playerDir = path.join(baseDir, "players");
    fs.mkdirSync(playerDir, { recursive: true });
    if (groups.players.length > 0) {
      fs.writeFileSync(
        path.join(playerDir, `${league}_players.json`),
        JSON.stringify({ name: `${league.toUpperCase()} Players`, description: ``, players: groups.players }, null, 2)
      );
      console.log(`✅ players/${league}_players.json (${groups.players.length} players)`);
    }

    // Staff
    const staffDir = path.join(baseDir, "staffs");
    fs.mkdirSync(staffDir, { recursive: true });
    if (groups.staff.length > 0) {
      fs.writeFileSync(
        path.join(staffDir, `${league}_staffs.json`),
        JSON.stringify({ name: `${league.toUpperCase()} Staff`, description: ``, staff: groups.staff }, null, 2)
      );
      console.log(`✅ staffs/${league}_staffs.json (${groups.staff.length} staff)`);
    }
  }

  // Free agents
  const freePlayers = players.filter(p => p.team_id === null);
  if (freePlayers.length > 0) {
    const playerDir = path.join(baseDir, "players");
    fs.writeFileSync(
      path.join(playerDir, "free_agents.json"),
      JSON.stringify({ name: "Free Agents", description: ``, players: freePlayers }, null, 2)
    );
    console.log(`✅ players/free_agents.json (${freePlayers.length} players)`);
  }
  const freeStaff = staff.filter(s => s.team_id === null);
  if (freeStaff.length > 0) {
    const staffDir = path.join(baseDir, "staffs");
    fs.writeFileSync(
      path.join(staffDir, "free_agents.json"),
      JSON.stringify({ name: "Free Agents", description: ``, staff: freeStaff }, null, 2)
    );
    console.log(`✅ staffs/free_agents.json (${freeStaff.length} staff)`);
  }

  console.log(`\nDone: ${teams.length}T/${players.length}P/${staff.length}S`);
}

main();
