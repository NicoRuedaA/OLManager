import { asset } from "../asset";

export function resolveTeamLogo(teamName?: string | null, logoUrl?: string | null): string | null {
  if (logoUrl) return asset(logoUrl);
  if (!teamName) return null;
  return asset(`/teams-icons/${teamName}.webp`, "slug");
}
