/** Deterministic player stats generation — mirrors build_lol_stats_from_seed() in Rust */

import type { LolRole } from "./types";

/** Role bias for the 9 LoL stats [mechanics, laning, teamfighting, macro_play, consistency, shotcalling, champion_pool, discipline, mental_resilience] */
const ROLE_BIAS: Record<string, [number, number, number, number, number, number, number, number, number]> = {
  Top:     [1, 0, 1, 0, 1, 1, 0, 1, 2],
  Jungle:  [0, 0, 1, 2, 1, 2, 1, 1, 1],
  Mid:     [2, 2, 0, 1, 0, 1, 1, 0, 0],
  Adc:     [2, 2, 1, 0, 0, 0, 1, 0, 1],
  Support: [0, 0, 1, 2, 1, 2, 0, 1, 1],
};

/** Generate 9 LoL stats from ign+role — same algo as build_lol_stats_from_seed() */
export function generateLolStats(ign: string, role: LolRole): [number, number, number, number, number, number, number, number, number] {
  const target = 70; // base rating
  const bias = ROLE_BIAS[role] ?? [0, 0, 0, 0, 0, 0, 0, 0, 0];

  // Deterministic jitter from IGN hash (same as Rust: seed.chars().fold(0, |acc, ch| acc.wrapping_add(ch as i16)))
  const hash = [...ign].reduce((acc, ch) => (acc + ch.charCodeAt(0)) & 0xFFFF, 0);

  let values = bias.map((b, i) => {
    const jitter = ((hash + (i * 7)) % 5) - 2;
    return target + b + jitter;
  });

  // Normalize average to target (same as Rust loop)
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  let delta = target - avg;
  let cursor = 0;
  while (delta !== 0) {
    const dir = delta > 0 ? 1 : -1;
    const candidate = values[cursor] + dir;
    if (candidate >= 25 && candidate <= 99) {
      values[cursor] = candidate;
      delta -= dir;
    }
    cursor = (cursor + 1) % 9;
  }

  return values as [number, number, number, number, number, number, number, number, number];
}

/** Map 9 LoL stats + role → 16 legacy PlayerAttributes */
export function statsToAttributes(
  lolStats: [number, number, number, number, number, number, number, number, number],
  role: LolRole,
): Record<string, number> {
  const [mechanics, laning, teamfighting, macro_play, consistency, shotcalling, champion_pool, discipline, mental_resilience] = lolStats;

  const roleKey = role.toLowerCase();
  let extraDef = 0;
  if (roleKey === "top" || roleKey === "support") extraDef = 4;

  const defending = clamp(((teamfighting + discipline) / 2) + extraDef);

  return {
    pace: clamp((mechanics + laning) / 2),
    stamina: mental_resilience,
    strength: clamp((teamfighting + discipline) / 2),
    agility: champion_pool,
    passing: clamp((macro_play + shotcalling) / 2),
    shooting: laning,
    tackling: clamp((discipline + teamfighting) / 2),
    dribbling: mechanics,
    defending,
    positioning: clamp((macro_play + consistency) / 2),
    vision: macro_play,
    decisions: consistency,
    composure: discipline,
    aggression: clamp(((teamfighting + mental_resilience) / 2) - 4),
    teamwork: teamfighting,
    leadership: shotcalling,
    handling: 20,
    reflexes: 22,
    aerial: roleKey === "top" ? 68 : roleKey === "support" ? 64 : 52,
  };
}

function clamp(v: number): number {
  return Math.max(25, Math.min(99, Math.round(v)));
}

/** Estimate market value from OVR + potential */
export function estimateMarketValue(ovr: number, potential: number): number {
  const skillGap = Math.max(0, ovr - 60);
  const potentialGap = Math.max(0, potential - ovr);
  const skillValue = 50_000 + skillGap * skillGap * 300;
  const potentialValue = potentialGap * 6_000;
  const raw = skillValue + potentialValue;
  // Round to nearest 5K
  return Math.round(raw / 5000) * 5000;
}

/** Calculate OVR from attributes (unweighted average of all) */
export function calculateOvr(attrs: Record<string, number>): number {
  const vals = Object.values(attrs);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/** Estimate potential based on age */
export function estimatePotential(ovr: number, age: number | null): number {
  if (age === null) return Math.min(ovr + 5, 99);
  if (age <= 19) return Math.min(ovr + 12, 99);
  if (age <= 21) return Math.min(ovr + 8, 99);
  if (age <= 23) return Math.min(ovr + 5, 99);
  if (age <= 25) return Math.min(ovr + 3, 99);
  if (age <= 27) return Math.min(ovr + 1, 99);
  return ovr; // peaked
}

/** Estimate weekly wage from OVR and region */
export function estimateWage(ovr: number, region: string): number {
  const base = ovr * 500;
  const multipliers: Record<string, number> = {
    Korea: 1.5, China: 1.8, NA: 1.3,
    EMEA: 1.2, Brazil: 0.8, LATAM: 0.6,
    APAC: 0.7, VN: 0.5, Japan: 0.7, OCE: 0.6,
  };
  const mult = multipliers[region] ?? 0.6;
  return Math.round(base * mult / 1000) * 1000;
}
