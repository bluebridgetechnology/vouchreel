import { defineLayout, type LayoutContext } from "../layout-api";
import type { ReviewItem } from "../matcher";
import css from "./marquee.css";
import tileCss from "./tile.css";
import { videoTile } from "./tile";

const MAX_ITEMS = 16;
/** Scroll speed, in pixels per second: slow enough to read. */
const SPEED = 40;
/** The strip is repeated until it is at least this wide, so there is never a gap on a wide screen. */
const FILL_PX = 2400;

const textEl = (tag: string, className: string, text: string): HTMLElement => {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
};

function reviewCard(ctx: LayoutContext, review: ReviewItem): (clone: boolean) => HTMLElement {
  return (clone) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "vr-mq-card vr-mq-review";
    card.setAttribute("aria-label", `View review from ${review.authorName}`);
    const body = document.createElement("span");
    body.className = "vr-mq-body";
    body.appendChild(textEl("span", "vr-stars", "★".repeat(Math.max(0, Math.min(5, review.rating)))));
    if (review.text) body.appendChild(textEl("span", "vr-mq-quote", `"${review.text}"`));
    body.appendChild(textEl("span", "vr-mq-name", review.authorName));
    card.appendChild(body);
    if (clone) card.tabIndex = -1;
    card.addEventListener("click", () => ctx.openReview(review));
    return card;
  };
}

/**
 * Marquee: a slowly scrolling strip of video pictures, with a few reviews between them, for a landing page. The motion is plain
 * CSS: the strip repeats and slides by one repeat. It pauses when the visitor hovers or focuses a card and has
 * a visible Pause button; for visitors who ask for reduced motion it does not move at all and becomes a row
 * they scroll themselves (see the stylesheet). The repeats are hidden from screen readers and the keyboard.
 */
defineLayout("marquee", {
  css: tileCss + css,
  inline: true,
  render(ctx: LayoutContext) {
    // Videos lead: two pictures, then a review, so the strip reads as people first
    const cards: ((clone: boolean) => HTMLElement)[] = [];
    const videos = ctx.testimonials;
    const reviews = ctx.reviews;
    let next = 0;
    for (let i = 0; i < videos.length && cards.length < MAX_ITEMS; i++) {
      const item = videos[i];
      cards.push((clone) => {
        const tile = videoTile(ctx, item, i);
        if (clone) tile.tabIndex = -1;
        return tile;
      });
      if (i % 2 === 1 && next < reviews.length && cards.length < MAX_ITEMS) cards.push(reviewCard(ctx, reviews[next++]));
    }
    // With few videos the reviews still fill the strip
    while (next < reviews.length && cards.length < MAX_ITEMS) cards.push(reviewCard(ctx, reviews[next++]));
    if (cards.length === 0) return;

    const set = (clone: boolean) => {
      const group = document.createElement("div");
      group.className = clone ? "vr-mq-set vr-mq-clone" : "vr-mq-set";
      if (clone) group.setAttribute("aria-hidden", "true");
      for (const make of cards) group.appendChild(make(clone));
      return group;
    };

    const wrap = document.createElement("div");
    wrap.className = "vr-mq";
    const viewport = document.createElement("div");
    viewport.className = "vr-mq-viewport";
    const track = document.createElement("div");
    track.className = "vr-mq-track";
    const first = set(false);
    track.appendChild(first);
    viewport.appendChild(track);

    const pause = document.createElement("button");
    pause.type = "button";
    pause.className = "vr-mq-pause";
    pause.setAttribute("aria-pressed", "false");
    pause.textContent = "Pause scrolling";
    pause.addEventListener("click", () => {
      const paused = pause.getAttribute("aria-pressed") !== "true";
      pause.setAttribute("aria-pressed", String(paused));
      pause.textContent = paused ? "Play scrolling" : "Pause scrolling";
      wrap.classList.toggle("vr-mq-paused", paused);
    });

    wrap.appendChild(viewport);
    wrap.appendChild(pause);
    ctx.root.appendChild(wrap);

    // Now that the first repeat is on the page, measure it: repeat until the strip is wide enough, and
    // slide by exactly one repeat per cycle so the loop has no seam
    const width = (first as HTMLElement).offsetWidth || cards.length * 300;
    const copies = Math.max(2, Math.ceil(FILL_PX / width) + 1);
    for (let n = 1; n < copies; n++) track.appendChild(set(true));
    track.style.setProperty("--vr-mq-shift", `-${(100 / copies).toFixed(4)}%`);
    track.style.setProperty("--vr-mq-dur", `${Math.max(12, Math.round(width / SPEED))}s`);
  },
});
