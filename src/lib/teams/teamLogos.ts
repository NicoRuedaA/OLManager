import { assetUrl } from "../assetUrl";

/**
 * Resolve a team's logo path.
 *
 * Priority:
 * 1. Explicit `logoUrl` from backend (e.g. `/teams-icons/fur2025.webp`)
 * 2. Derived from `teamName`: slugify and look for `/teams-icons/{slug}.webp`.
 *
 * No hardcoded maps — works for any team. The backend is responsible for
 * providing a matching file under public/teams-icons/.
 */
export function resolveTeamLogo(teamName?: string | null, logoUrl?: string | null): string | null {
  if (logoUrl) return assetUrl(logoUrl);
  if (!teamName) return null;
  const slug = teamName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
  return slug ? assetUrl(`/teams-icons/${slug}.webp`) : null;
}
