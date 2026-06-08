# Main Menu Animation

The main menu uses a three-layer compositing approach: a full-screen Ken Burns slideshow behind a two-column layout (nav left, contextual panel right). All animations are CSS-driven — zero JavaScript animation libraries, zero IntersectionObserver.

## Layers

```
┌──────────────────────────────────────────────┐
│  Overlays (gradient vignette + brand tint)   │
│  ┌──────────────────────────────────────────┐ │
│  │  Champion splash slideshow (crossfade)   │ │
│  │                                          │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ┌──────┐  ┌──────────────────────────────┐   │
│  │ Logo │  │  Contextual panel            │   │
│  │ Nav  │  │  (fades in on selection)     │   │
│  └──────┘  └──────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

## 1. Background: Ken Burns slideshow

**File:** `src/components/menu/MenuBackground.tsx`

| Concern | Implementation |
|---|---|
| Source images | All `.webp` files from `public/champion-splash/` (172 files at time of writing). Listed at build time by `scripts/generate-splash-manifest.ts` → `src/assets/champion-splash-list.ts`. |
| Shuffle | Fisher-Yates shuffle on mount, seeded by `Math.random()`. Different every session. |
| Timing | `setInterval` advances the active index every **9 seconds**. |
| Crossfade | All 172 `<div>` elements are always in the DOM, absolutely positioned. Active slide gets `opacity-100`, others `opacity-0`. Transition: `transition-opacity duration-[1600ms] ease-in-out`. |
| Zoom | The **active slide** gets the `menu-bg-kenburns` class: `@keyframes menu-ken-burns` scales from 1.08× → 1.18× with a subtle lateral shift over **18 seconds**. Inactive slides are paused mid-animation via `animationPlayState: "paused"`. |

### Overlays

Two gradient divs sit on top of the slides for readability:

| Overlay | CSS |
|---|---|
| Side darkening | `bg-gradient-to-r from-navy-950/95 via-navy-950/70 to-navy-950/30` |
| Top + bottom vignette | `bg-gradient-to-t from-navy-950 via-transparent to-navy-950/60` |

### Reduced motion

If `prefers-reduced-motion: reduce` is set:
- No interval starts — slide 0 renders statically.
- The `menu-bg-kenburns` class is never applied (no zoom).
- CSS media query in `App.css` also overrides any rogue animation class.

## 2. Navigation menu

**File:** `src/pages/MainMenu.tsx`

The entire left column (logo + item list) is wrapped in `<div className="animate-fade-in-up">`.

| Property | Value |
|---|---|
| Keyframe | `fade-in-up`: `opacity: 0 → 1`, `translateY(12px → 0)` |
| Duration | 300ms |
| Easing | `ease-out` |
| Trigger | Mount (runs once on page load) |
| Stagger | **None** — all items appear simultaneously as a group |

### Menu item hover

Each `<MenuItem>` uses `group` / `group-hover` with `duration-200 transition-all`:

| Element | Hover effect |
|---|---|
| Left accent bar | `h-0 → h-3/5` (rounded pill) |
| Icon | `scale(1 → 1.10)` |
| Label text | `translate-x(0 → 1)` + color brightens to white |

Active items (panel open) keep the accent bar and label shift as persistent state.

## 3. Contextual panel

Rendered conditionally on the right when `menuState !== "main"`.

```tsx
<div key={menuState} className="animate-fade-in-up">
```

| Property | Value |
|---|---|
| Key prop | **`key={menuState}`** — React unmounts/remounts on every state change, re-triggering the CSS animation each time. |
| Animation | Same `fade-in-up` as the nav: 300ms, `ease-out`. |
| Stagger | **None** — the entire panel fades in as one unit. |

## CSS keyframes

All defined in `src/App.css` (lines 409+):

| Keyframe | Purpose |
|---|---|
| `fade-in-up` | General entry animation (opacity + translateY) |
| `scale-in` | Subtle scale entry (unused in main menu, available for other components) |
| `slide-in-right` | Slide-from-right entry (unused in main menu) |
| `menu-ken-burns` | Slow zoom for active background slide |

## Files involved

| File | Role |
|---|---|
| `src/components/menu/MenuBackground.tsx` | Ken Burns slideshow logic |
| `src/pages/MainMenu.tsx` | Nav layout + panel orchestration |
| `src/App.css` | All `@keyframes` + utility classes + reduced-motion media query |
| `scripts/generate-splash-manifest.ts` | Build-time scan of `public/champion-splash/` |
| `src/assets/champion-splash-list.ts` | Generated list of available splash files |
| `public/champion-splash/*.webp` | Source images (~172 files) |
