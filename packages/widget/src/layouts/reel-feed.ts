import { defineLayout, type LayoutContext } from "../layout-api";
import type { TestimonialItem } from "../matcher";
import css from "./reel-feed.css";

const SWIPE_PX = 50;
const MAX_TILES = 12;

function textEl(tag: string, className: string, text: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

/** A tile's picture: its poster, else the video's first frame (metadata only), else the initial. */
function tilePicture(item: TestimonialItem): HTMLElement {
  if (item.thumbnailUrl) {
    const img = document.createElement("img");
    img.className = "vr-feed-pic";
    img.src = item.thumbnailUrl;
    img.alt = "";
    return img;
  }
  if (item.platform === "mp4" && item.videoUrl) {
    const frame = document.createElement("video");
    frame.className = "vr-feed-pic";
    frame.src = `${item.videoUrl}#t=0.5`;
    frame.preload = "metadata";
    frame.muted = true;
    frame.setAttribute("aria-hidden", "true");
    return frame;
  }
  return textEl("span", "vr-feed-pic vr-feed-initial", (item.customerName || "V").charAt(0).toUpperCase());
}

/**
 * Reel feed: a row of tall tiles. Uploaded videos open in a full-screen vertical player (swipe up or down,
 * arrow keys, or the buttons; it moves on by itself when a video ends). YouTube and Vimeo videos and reviews
 * open in the widget's usual pop-up, since only the core can play them. Tiles show a picture, not a playing
 * video, so a page of tiles downloads no video until one is opened.
 */
defineLayout("reel-feed", {
  css,
  inline: true,
  render(ctx: LayoutContext) {
    const row = document.createElement("div");
    row.className = "vr-feed";
    const track = document.createElement("div");
    track.className = "vr-feed-track";

    /** Indexes of the testimonials the full-screen player can show. */
    const playable = ctx.testimonials.slice(0, MAX_TILES).map((t, i) => (t.platform === "mp4" && t.videoUrl ? i : -1)).filter((i) => i >= 0);

    ctx.testimonials.slice(0, MAX_TILES).forEach((item, i) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "vr-feed-tile";
      tile.setAttribute("aria-label", `Play video testimonial${item.customerName ? ` from ${item.customerName}` : ""}`);
      tile.appendChild(tilePicture(item));
      const badge = document.createElement("span");
      badge.className = "vr-play-badge";
      badge.setAttribute("aria-hidden", "true");
      badge.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
      tile.appendChild(badge);
      const caption = document.createElement("span");
      caption.className = "vr-feed-caption";
      caption.appendChild(textEl("span", "vr-feed-name", item.customerName || ""));
      tile.appendChild(caption);
      tile.addEventListener("click", () => {
        ctx.track("click", item.id);
        if (playable.includes(i)) openPlayer(ctx, playable, i, tile);
        else ctx.openVideo(i);
      });
      track.appendChild(tile);
    });

    ctx.reviews.slice(0, Math.max(0, MAX_TILES - ctx.testimonials.length)).forEach((review) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "vr-feed-tile vr-feed-review";
      tile.setAttribute("aria-label", `View review from ${review.authorName}`);
      tile.appendChild(textEl("span", "vr-stars", "★".repeat(Math.max(0, Math.min(5, review.rating)))));
      tile.appendChild(textEl("span", "vr-feed-quote", review.text ? `"${review.text}"` : ""));
      tile.appendChild(textEl("span", "vr-feed-name", review.authorName));
      tile.addEventListener("click", () => ctx.openReview(review));
      track.appendChild(tile);
    });

    row.appendChild(track);
    ctx.root.appendChild(row);
  },
});

/** The full-screen vertical player, inside the widget's shadow root. */
function openPlayer(ctx: LayoutContext, playable: number[], startIndex: number, opener: HTMLElement): void {
  let at = playable.indexOf(startIndex);
  const overlay = document.createElement("div");
  overlay.className = "vr-feed-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Video testimonials");

  const stage = document.createElement("div");
  stage.className = "vr-feed-stage";
  const info = document.createElement("div");
  info.className = "vr-feed-info";
  const live = document.createElement("div");
  live.className = "vr-sr-only";
  live.setAttribute("aria-live", "polite");

  const button = (className: string, label: string, glyph: string, onClick: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `vr-feed-btn ${className}`;
    b.setAttribute("aria-label", label);
    b.textContent = glyph;
    b.addEventListener("click", onClick);
    return b;
  };

  const draw = () => {
    const item = ctx.testimonials[playable[at]];
    stage.textContent = "";
    info.textContent = "";
    const video = document.createElement("video");
    video.className = "vr-feed-video";
    video.src = item.videoUrl;
    if (item.thumbnailUrl) video.poster = item.thumbnailUrl;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("aria-label", `Video testimonial${item.customerName ? ` from ${item.customerName}` : ""}`);
    video.addEventListener("play", () => ctx.track("play", item.id));
    video.addEventListener("ended", () => playable.length > 1 && go(1));
    stage.appendChild(video);
    if (item.customerName) info.appendChild(textEl("div", "vr-feed-name", item.customerName));
    const quote = ctx.quote(item).text;
    if (quote) info.appendChild(textEl("div", "vr-feed-quote", `"${quote}"`));
    live.textContent = `${item.customerName || "Testimonial"}, ${at + 1} of ${playable.length}`;
  };

  const go = (dir: number) => {
    at = (at + dir + playable.length) % playable.length;
    draw();
  };

  const close = () => {
    document.removeEventListener("keydown", onKey, true);
    document.documentElement.style.overflow = prevOverflow;
    overlay.remove();
    opener.focus();
  };
  const closeBtn = button("vr-feed-close", "Close player", "×", close);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") go(-1);
    else if (e.key === "Tab") {
      // Keep focus inside the player
      const items = Array.from(overlay.querySelectorAll<HTMLElement>("button, video"));
      const active = (overlay.getRootNode() as ShadowRoot).activeElement;
      const i = items.indexOf(active as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === items.length - 1 ? 0 : i + 1;
      e.preventDefault();
      items[next].focus();
    }
  };

  // Swipe up or down, like a reel; a mostly sideways drag is left alone
  let startY: number | null = null;
  let startX = 0;
  stage.addEventListener("pointerdown", (e) => {
    startY = (e as PointerEvent).clientY;
    startX = (e as PointerEvent).clientX;
  });
  stage.addEventListener("pointerup", (e) => {
    if (startY === null) return;
    const dy = (e as PointerEvent).clientY - startY;
    const dx = (e as PointerEvent).clientX - startX;
    startY = null;
    if (playable.length > 1 && Math.abs(dy) >= SWIPE_PX && Math.abs(dy) > Math.abs(dx)) go(dy < 0 ? 1 : -1);
  });

  overlay.appendChild(stage);
  overlay.appendChild(info);
  overlay.appendChild(closeBtn);
  if (playable.length > 1) {
    overlay.appendChild(button("vr-feed-up", "Previous testimonial", "▲", () => go(-1)));
    overlay.appendChild(button("vr-feed-down", "Next testimonial", "▼", () => go(1)));
  }
  overlay.appendChild(live);

  const prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";
  document.addEventListener("keydown", onKey, true);
  ctx.root.appendChild(overlay);
  draw();
  closeBtn.focus();
}
