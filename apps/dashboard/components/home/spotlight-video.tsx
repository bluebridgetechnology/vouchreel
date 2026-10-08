"use client";

import { useEffect, useState } from "react";

/**
 * The spotlight's moving picture: an uploaded video loops muted, like the widget's preview loop.
 * YouTube and Vimeo videos (and visitors who ask for reduced motion) get the still poster instead.
 */
export function SpotlightVideo({ videoUrl, thumbnailUrl, platform, name }: { videoUrl: string | null; thumbnailUrl: string | null; platform: string; name: string }) {
  const [still, setStill] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setStill(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const canLoop = platform === "mp4" && Boolean(videoUrl) && !still;

  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-card bg-surface-inverse sm:aspect-[3/4]">
      {canLoop ? (
        <video
          src={videoUrl!}
          poster={thumbnailUrl ?? undefined}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={`Video testimonial from ${name}`}
        />
      ) : thumbnailUrl ? (
        <img src={thumbnailUrl} alt={`Video testimonial from ${name}`} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-6xl font-medium text-text-inverse/60" aria-hidden>
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-scrim/50 to-transparent" />
    </div>
  );
}
