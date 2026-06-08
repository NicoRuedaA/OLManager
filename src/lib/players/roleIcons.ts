/**
 * Role icons mapping for League of Legends roles.
 * Icons are stored in public/role-icons/
 */

export type LolRole = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";

/**
 * Maps each role to its icon path (relative to public/)
 */
export const ROLE_ICON_PATHS: Record<LolRole, string> = {
  TOP: "/role-icons/top.webp",
  JUNGLE: "/role-icons/jungler.webp",
  MID: "/role-icons/mid.webp",
  ADC: "/role-icons/adc.webp",
  SUPPORT: "/role-icons/support.webp",
};

/**
 * Returns the icon path for a given role.
 * @param role - The role name (case-insensitive)
 * @returns The icon path or undefined if role is not recognized
 */
export function getRoleIconPath(role: string): string | undefined {
  const normalized = role.toUpperCase() as LolRole;
  return ROLE_ICON_PATHS[normalized];
}

/**
 * Badge color variants for each role.
 * Centralized to avoid duplication across components.
 */
export const roleBadgeVariant: Record<LolRole, "danger" | "success" | "accent" | "primary" | "neutral"> = {
  TOP: "danger",
  JUNGLE: "success",
  MID: "accent",
  ADC: "primary",
  SUPPORT: "neutral",
};

/**
 * Returns the badge variant for a given role.
 * @param role - The role name (case-insensitive)
 * @returns The badge variant or "neutral" as fallback
 */
export function getRoleBadgeVariant(role: string): "danger" | "success" | "accent" | "primary" | "neutral" {
  const normalized = role.toUpperCase() as LolRole;
  return roleBadgeVariant[normalized] ?? "neutral";
}

/**
 * Display abbreviations for roles (useful for compact UI)
 */
export const ROLE_ABBREVIATIONS: Record<LolRole, string> = {
  TOP: "TOP",
  JUNGLE: "JG",
  MID: "MID",
  ADC: "ADC",
  SUPPORT: "SUP",
};

/**
 * Returns the abbreviation for a role.
 * @param role - The role name
 * @returns The abbreviated form (e.g., "JUNGLE" -> "JG")
 */
export function getRoleAbbreviation(role: string): string {
  const normalized = role.toUpperCase() as LolRole;
  return ROLE_ABBREVIATIONS[normalized] ?? role;
}
