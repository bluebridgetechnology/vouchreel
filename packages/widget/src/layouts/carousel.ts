import { defineLayout } from "../layout-api";
import { interleavedCards } from "./cards";
import cardsCss from "./cards.css";
import tileCss from "./tile.css";
import css from "./carousel.css";

function arrow(direction: "prev" | "next"): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `vr-carousel-arrow vr-carousel-${direction}`;
  btn.setAttribute("aria-label", direction === "prev" ? "Previous items" : "Next items");
  btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="${direction === "prev" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"}"></polyline></svg>`;
  return btn;
}

/**
 * Scrolls one card along every few seconds, back to the start at the end. Pauses while the visitor
 * hovers or focuses inside, stops for good once they scroll or click themselves, and never runs for
 * visitors who ask for reduced motion. Stops when the track leaves the page (the core re-renders).
 */
function autoAdvance(track: HTMLElement, seconds: number): void {
  if (seconds <= 0 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  let paused = false;
  let stopped = false;
  const pause = (v: boolean) => () => (paused = v);
  track.addEventListener("mouseenter", pause(true));
  track.addEventListener("mouseleave", pause(false));
  track.addEventListener("focusin", pause(true));
  track.addEventListener("focusout", pause(false));
  track.addEventListener("pointerdown", () => (stopped = true));
  track.addEventListener("wheel", () => (stopped = true), { passive: true });
  const timer = setInterval(() => {
    if (stopped || !track.isConnected) return clearInterval(timer);
    if (paused) return;
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    track.scrollTo({ left: atEnd ? 0 : track.scrollLeft + 310, behavior: "smooth" });
  }, seconds * 1000);
}

/** Carousel: a horizontal scroll slider with arrow controls and touch swipe. */
defineLayout("carousel", {
  css: cardsCss + tileCss + css,
  inline: true,
  render(ctx) {
    const container = document.createElement("div");
    container.className = "vr-carousel-container";

    const track = document.createElement("div");
    track.className = "vr-carousel-track";
    for (const card of interleavedCards(ctx)) track.appendChild(card);

    const prevBtn = arrow("prev");
    const nextBtn = arrow("next");
    prevBtn.addEventListener("click", () => track.scrollBy({ left: -310, behavior: "smooth" }));
    nextBtn.addEventListener("click", () => track.scrollBy({ left: 310, behavior: "smooth" }));

    autoAdvance(track, Number(ctx.theme?.autoAdvance) || 0);

    container.appendChild(prevBtn);
    container.appendChild(track);
    container.appendChild(nextBtn);
    ctx.root.appendChild(container);
  },
});
