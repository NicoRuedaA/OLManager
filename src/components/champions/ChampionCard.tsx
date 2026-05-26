import { memo, useState, useEffect, useRef } from "react";
import { resolveChampionTile } from "../../lib/championImages";

export interface ChampionCardProps {
  id: number;
  name: string;
  championKey: string;
  roles: string[];
  imageTileUrl?: string;
  onClick: (id: number) => void;
}

/**
 * LazyImage component handles intersection observer for lazy loading
 */
const LazyImage = memo(function LazyImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
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
        src={isVisible ? src : undefined}
        alt={alt}
        loading="lazy"
        onLoad={handleLoad}
        className={`${className} transition-opacity duration-300 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
});

export const ChampionCard = memo(function ChampionCard({
  id,
  championKey,
  imageTileUrl,
  onClick,
}: ChampionCardProps) {
  const displayImage = imageTileUrl || resolveChampionTile(championKey) || "";

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
