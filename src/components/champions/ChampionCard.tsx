import { memo, useState, useEffect, useRef } from "react";
import { ROLE_ICON_PATHS } from "../../lib/roleIcons";

export interface ChampionCardProps {
  id: number;
  name: string;
  championKey: string;
  roles: string[];
  imageTileUrl?: string;
  onClick: (id: number) => void;
}

/**
 * Maps DB role names to ROLE_ICON_PATHS keys (uppercase)
 */
function mapRoleToIconPath(role: string): string | undefined {
  const normalized = role.toUpperCase();
  if (normalized === "TOP") return ROLE_ICON_PATHS.TOP;
  if (normalized === "JUNGLE") return ROLE_ICON_PATHS.JUNGLE;
  if (normalized === "JUNGLER") return ROLE_ICON_PATHS.JUNGLE;
  if (normalized === "MID") return ROLE_ICON_PATHS.MID;
  if (normalized === "ADC" || normalized === "BOT") return ROLE_ICON_PATHS.ADC;
  if (normalized === "SUPPORT") return ROLE_ICON_PATHS.SUPPORT;
  return undefined;
}

/**
 * Fallback champion tile URL from Data Dragon
 */
function fallbackTileUrl(championKey: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${championKey}_0.jpg`;
}

/**
 * LazyImage component handles intersection observer for lazy loading
 */
const LazyImage = memo(function LazyImage({
  src,
  alt,
  fallbackSrc,
  className,
}: {
  src: string;
  alt: string;
  fallbackSrc: string;
  className: string;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "100px", // Start loading before element is fully visible
        threshold: 0,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleError = () => {
    setCurrentSrc(fallbackSrc);
  };

  const handleLoad = () => {
    setIsLoaded(true);
  };

  return (
    <div className="relative w-full h-full">
      {/* Skeleton placeholder - shown until image loads */}
      <div
        className={`absolute inset-0 bg-navy-700 transition-opacity duration-300 ${
          isLoaded ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      />
      <img
        ref={imgRef}
        src={isVisible ? currentSrc : undefined}
        alt={alt}
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
        className={`${className} transition-opacity duration-300 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
});

export const ChampionCard = memo(function ChampionCard({
  id,
  name,
  championKey,
  roles,
  imageTileUrl,
  onClick,
}: ChampionCardProps) {
  const displayImage = imageTileUrl || fallbackTileUrl(championKey);
  const fallback = fallbackTileUrl(championKey);

  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className="card card-body group cursor-pointer p-0 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(251,191,36,0.2)] border border-navy-500/80 hover:border-yellow-400"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-navy-800">
        <LazyImage
          src={displayImage}
          alt={championKey}
          fallbackSrc={fallback}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-300" />
      </div>
    </button>
  );
});

// Custom comparison function for React.memo - shallow comparison is sufficient
function championCardPropsAreEqual(
  prev: ChampionCardProps,
  next: ChampionCardProps
): boolean {
  return (
    prev.id === next.id &&
    prev.name === next.name &&
    prev.championKey === next.championKey &&
    prev.imageTileUrl === next.imageTileUrl &&
    prev.onClick === next.onClick &&
    prev.roles.length === next.roles.length &&
    prev.roles.every((role, index) => role === next.roles[index])
  );
}

export default memo(ChampionCard, championCardPropsAreEqual);