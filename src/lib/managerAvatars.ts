export const MANAGER_ICON_PATHS = Array.from({ length: 29 }, (_, i) => {
  // icons 0-28, skip 2 (doesn't exist)
  if (i === 2) return null;
  return `/manager-icons/${i}.webp`;
}).filter(Boolean) as string[];

export const DEFAULT_MANAGER_ICON_PATH =
  MANAGER_ICON_PATHS[0] ?? "/manager-icons/0.webp";
