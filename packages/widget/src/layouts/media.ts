import type { LayoutContext } from "../layout-api";
import type { TestimonialItem } from "../matcher";

/**
 * Muted preview loops for the video-first layouts. A loop downloads video on the customer's page, so it only
 * plays when the owner allows previews, the visitor has not asked for reduced motion or reduced data, and the
 * video is a file we can play (YouTube and Vimeo show their poster instead).
 */
export function canLoop(ctx: LayoutContext, item: TestimonialItem | undefined): boolean {
  if (!item || ctx.autoplay === false || item.platform !== "mp4" || !item.videoUrl) return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData !== true;
}

/** The picture for an item: a muted loop when allowed, else its poster, else its initial. */
export function mediaFor(ctx: LayoutContext, item: TestimonialItem, className: string): HTMLElement {
  if (canLoop(ctx, item)) {
    const video = document.createElement("video");
    video.className = className;
    video.src = item.videoUrl;
    if (item.thumbnailUrl) video.poster = item.thumbnailUrl;
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.setAttribute("aria-hidden", "true");
    return video;
  }
  if (item.thumbnailUrl) {
    const img = document.createElement("img");
    img.className = className;
    img.src = item.thumbnailUrl;
    img.alt = "";
    return img;
  }
  const initial = document.createElement("span");
  initial.className = `${className} vr-media-initial`;
  initial.textContent = (item.customerName || "V").charAt(0).toUpperCase();
  return initial;
}
