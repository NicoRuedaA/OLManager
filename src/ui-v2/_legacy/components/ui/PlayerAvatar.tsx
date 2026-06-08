import { useEffect, useState } from "react";

interface PlayerAvatarProps {
  src: string | null;
  alt: string;
  className?: string;
}

/**
 * Player photo with graceful fallback. If the photo is missing or fails to
 * load (404 — common when the data references images that weren't exported),
 * it renders a neutral placeholder instead of a broken, perpetually-retrying
 * <img>.
 */
export function PlayerAvatar({ src, alt, className = "" }: PlayerAvatarProps) {
  const [failed, setFailed] = useState(false);

  // Reset the failed flag if the source changes (e.g. row re-used in a list).
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div
        className={`rounded-full bg-[#0f213f] border border-white/10 shrink-0 ${className}`}
        aria-label={alt}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className={`object-cover rounded-full shrink-0 ${className}`}
      loading="lazy"
    />
  );
}
