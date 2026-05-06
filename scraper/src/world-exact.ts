#!/usr/bin/env tsx
/** Tanda 4: Convert scraper output → exact WorldData format matching Rust structs */
import fs from "fs";
import path from "path";

const OUTPUT = "output";

interface PlayerOut {
  id: string;
  match_name: string;
  full_name: string;
  date_of_birth: string;
  nationality: string;
  birth_country: string | null;
  profile_image_url: string | null;
  position: string;
  natural_position: string;
  alternate_positions: string[];
  footedness: string;
  weak_foot: number;
  attributes: Record<string, number>;
  condition: number;
  morale: number;
  fitness: number;
  injury: null;
  team_id: string | null;
  traits: string[];
  contract_end: string | null;
  wage: number;
  market_value: number;
  stats: Record<string, number>;
  career: Array<{ season: number; team_id: string; team_name: string; appearances: number; goals: number; assists: number }>;
  training_focus: null;
  transfer_listed: boolean;
  loan_listed: boolean;
  transfer_offers: [];
  morale_core: Record<string, any>;
  potential_base: number;
  potential_revealed: null;
  potential_research_started_on: null;
  potential_research_eta_days: null;
  champion_training_target: null;
  champion_training_targets: string[];
}

interface TeamOut {
  id: string; name: string; short_name: string; country: string; city: string;
  arena_name: string; arena_capacity: number; finance: number; manager_id: null;
  reputation: number; team_kind: string; parent_team_id: null; academy_team_id: null;
  academy: null; wage_budget: number; transfer_budget: number;
  season_income: number; season_expenses: number; financial_ledger: [];
  sponsorship: null; facilities: Record<string, any>; formation: string;
  play_style: string; lol_tactics: Record<string, any>;
  training_focus: string; training_intensity: string; training_schedule: string;
  colors: { primary: string; secondary: string };
  form: []; history: []; academy_lifecycle: null; training_groups: [];
  scrim_results: [];
}

interface StaffOut {
  id: string; first_name: string; last_name: string; date_of_birth: string;
  nationality: string; birth_country: string | null; profile_image_url: string | null;
  role: string; attributes: Record<string, number>; team_id: string | null;
  specialization: null; wage: number; contract_end: string | null;
}

const ROLE_MAP: Record<string, string> = {
  Top: "Top", Jungle: "Jungle", Mid: "Mid", Adc: "Adc", Support: "Support",
};

const STAFF_ROLE_MAP: Record<string, string> = {
  Coach: "Coach", "Head Coach": "Coach", "Assistant Coach": "Coach",
  Manager: "AssistantManager", "General Manager": "AssistantManager", "Team Manager": "AssistantManager",
  Analyst: "Scout", "Head Analyst": "Scout",
};

function mapPlayer(p: any): PlayerOut {
  const pos = ROLE_MAP[p.role] ?? "Mid";
  const ovr = p.ovr ?? 70;
  return {
    id: p.id, match_name: p.ign, full_name: p.fullName,
    date_of_birth: p.dateOfBirth ?? "2000-01-01",
    nationality: p.nationality, birth_country: null,
    profile_image_url: p.photoUrl ?? (p.photoId ? `/player-photos/${p.photoId}.webp` : null),
    position: pos, natural_position: pos, alternate_positions: [],
    footedness: "Right", weak_foot: 2,
    attributes: p.attributes ?? {
      pace: ovr, stamina: ovr, strength: ovr, agility: ovr,
      passing: ovr, shooting: ovr, tackling: ovr, dribbling: ovr,
      defending: ovr, positioning: ovr, vision: ovr, decisions: ovr,
      composure: ovr, aggression: ovr, teamwork: ovr, leadership: ovr,
      handling: 20, reflexes: 22, aerial: 52,
    },
    condition: 100, morale: 80, fitness: 75, injury: null,
    team_id: p.teamId ?? null,
    traits: [], contract_end: "2025-12-20",
    wage: p.wage ?? 40000, market_value: p.marketValue ?? 50000,
    stats: { appearances: 0, goals: 0, assists: 0, clean_sheets: 0, avg_rating: 0, minutes_played: 0 },
    career: (p.career ?? []).map((c: any) => ({
      season: parseInt(c.season) || 2025,
      team_id: c.teamId, team_name: c.teamName, appearances: 0, goals: 0, assists: 0,
    })),
    training_focus: null, transfer_listed: false, loan_listed: false,
    transfer_offers: [], morale_core: {
      manager_trust: 50, unresolved_issue: null, recent_treatment: null,
      pending_promise: null, talk_cooldown_until: null, renewal_state: null,
    },
    potential_base: p.potentialBase ?? Math.min(ovr + 5, 99),
    potential_revealed: null, potential_research_started_on: null,
    potential_research_eta_days: null,
    champion_training_target: null, champion_training_targets: [],
  };
}

function mapTeam(t: any): TeamOut {
  return {
    id: t.id, name: t.name, short_name: t.shortName,
    country: t.country, city: t.city,
    arena_name: t.arenaName ?? `${t.shortName} Arena`,
    arena_capacity: t.arenaCapacity ?? 2500,
    finance: 1_000_000, manager_id: null, reputation: 500,
    team_kind: "Main", parent_team_id: null, academy_team_id: null,
    academy: null, wage_budget: 500_000, transfer_budget: 200_000,
    season_income: 0, season_expenses: 0, financial_ledger: [],
    sponsorship: null,
    facilities: { main_hub_level: 1, training: 1, medical: 1, scouting: 1 },
    formation: "4-2-3-1", play_style: "Balanced",
    lol_tactics: { draft_priority: "Balanced", jungle_style: "Enabler", jungle_pathing: "TopToBot", fight_plan: "FrontToBack", support_roaming: "Lane" },
    training_focus: "Scrims", training_intensity: "Medium", training_schedule: "Balanced",
    colors: { primary: "#0a1433", secondary: "#22d3ee" },
    form: [], history: [], academy_lifecycle: null,
    training_groups: [], scrim_results: [],
  };
}

function mapStaff(s: any): StaffOut {
  const role = s.staffRole ? (STAFF_ROLE_MAP[s.staffRole] ?? "Coach") : "Coach";
  const nameParts = s.fullName.split(" ");
  return {
    id: s.id,
    first_name: nameParts[0] ?? s.ign,
    last_name: nameParts.slice(1).join(" ") ?? "",
    date_of_birth: s.dateOfBirth ?? "2000-01-01",
    nationality: s.nationality, birth_country: null,
    profile_image_url: null,
    role, team_id: null,
    attributes: { coaching: 50, judging_ability: 50, judging_potential: 50, physiotherapy: 20 },
    specialization: null, wage: 30000, contract_end: null,
  };
}

async function main() {
  console.log("📥 Loading scraper output...");
  const src = JSON.parse(fs.readFileSync(path.join(OUTPUT, "world.json"), "utf-8"));

  console.log("🔄 Converting players...");
  const players = src.players.map(mapPlayer);
  console.log(`   ${players.length} players converted`);

  console.log("🔄 Converting teams...");
  const teams = src.teams.map(mapTeam);
  console.log(`   ${teams.length} teams converted`);

  console.log("🔄 Converting staff...");
  const staff = JSON.parse(fs.readFileSync(path.join(OUTPUT, "staff.json"), "utf-8")).staff ?? [];
  const staffOut = staff.map(mapStaff);
  console.log(`   ${staffOut.length} staff converted`);

  const world = {
    name: "Leaguepedia World",
    description: `Auto-generated from Leaguepedia on ${new Date().toISOString().slice(0, 10)}`,
    teams,
    players,
    staff: staffOut,
  };

  const outPath = path.join(OUTPUT, "world-exact.json");
  fs.writeFileSync(outPath, JSON.stringify(world, null, 2));
  const mb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
  console.log(`\n✅ output/world-exact.json (${mb} MB)`);
  console.log("   → Formato exacto de WorldData, listo para game.rs");
}

main().catch(console.error);
