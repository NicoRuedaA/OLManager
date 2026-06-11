/* ═══════════════════════════════════════════════════════════════
   Theme definitions — ready for future implementation.
   Theme switching requires either:
   A) Replace Tailwind utility classes with CSS var() references
   B) Full CSS swap (separate Tailwind build per theme)
   C) Wait for Tailwind v5 runtime theming support
   ═══════════════════════════════════════════════════════════════ */

export type ThemeId = "default" | "navy";

export interface ThemeDef {
  id: ThemeId;
  label: string;
}

export const THEMES: ThemeDef[] = [
  { id: "default", label: "Orange" },
  { id: "navy", label: "Classic Navy" },
];
