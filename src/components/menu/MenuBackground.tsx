import { useEffect, useMemo, useRef, useState } from "react";
import { CHAMPION_SPLASH_LIST } from "@/assets/champion-splash-list";

const SLIDE_MS = 9000;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Full-bleed animated background for the main menu. Crossfades between champion
 * splash arts with a subtle zoom. Falls back to a single static image when the
 * user prefers reduced motion.
 */
export default function MenuBackground() {
  const slides = useMemo(() => shuffle(CHAMPION_SPLASH_LIST), []);
  const reducedMotion = useRef(prefersReducedMotion());
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion.current || slides.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, [slides.length]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-navy-950 pointer-events-none select-none">
      {slides.map((champion, i) => (
        <div
          key={champion}
          aria-hidden
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-[1600ms] ease-in-out ${
            i === index ? "opacity-100" : "opacity-0"
          } ${reducedMotion.current ? "" : "menu-bg-kenburns"}`}
          style={{
            backgroundImage: `url(/champion-splash/${champion}.webp)`,
            animationPlayState: i === index ? "running" : "paused",
          }}
        />
      ))}

      {/* Readability overlays: darken + vignette + brand tint */}
      <div className="absolute inset-0 bg-gradient-to-r from-navy-950/95 via-navy-950/70 to-navy-950/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-transparent to-navy-950/60" />
    </div>
  );
}
