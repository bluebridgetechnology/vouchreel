import { defineLayout } from "../layout-api";
import { mediaFor } from "./media";
import css from "./floating-reel.css";

/** Slides shown at most, so the progress bars stay readable and few videos load. */
const MAX_SLIDES = 6;
/** How far a horizontal drag must go to count as a swipe. */
const SWIPE_PX = 40;

/**
 * Floating reel: a tall corner card that plays one testimonial at a time, like a story. Tap the arrows or
 * swipe to move on; tap the picture to open the full player. Reviews join as text slides after the videos.
 * Only the current slide's video is on the page, so it downloads one preview at a time.
 */
defineLayout("floating-reel", {
  css,
  inline: false,
  render(ctx) {
    const videos = ctx.testimonials.slice(0, MAX_SLIDES);
    const reviews = ctx.reviews.slice(0, MAX_SLIDES - videos.length);
    const total = videos.length + reviews.length;
    if (total === 0) return;

    let index = 0;
    const card = document.createElement("div");
    card.className = "vr-reel";
    card.setAttribute("role", "group");
    card.setAttribute("aria-roledescription", "carousel");
    card.setAttribute("aria-label", "Customer testimonials");

    const bars = document.createElement("div");
    bars.className = "vr-reel-bars";
    const barEls = Array.from({ length: total }, () => {
      const bar = document.createElement("span");
      bar.className = "vr-reel-bar";
      bars.appendChild(bar);
      return bar;
    });

    const stage = document.createElement("button");
    stage.type = "button";
    stage.className = "vr-reel-stage";

    const caption = document.createElement("div");
    caption.className = "vr-reel-caption";
    const live = document.createElement("div");
    live.className = "vr-sr-only";
    live.setAttribute("aria-live", "polite");

    const draw = () => {
      barEls.forEach((bar, i) => bar.classList.toggle("vr-reel-bar-on", i <= index));
      stage.textContent = "";
      caption.textContent = "";

      if (index < videos.length) {
        const item = videos[index];
        stage.setAttribute("aria-label", `Play video testimonial${item.customerName ? ` from ${item.customerName}` : ""}`);
        stage.appendChild(mediaFor(ctx, item, "vr-reel-media"));
        const name = document.createElement("div");
        name.className = "vr-reel-name";
        name.textContent = item.customerName || item.title || "";
        caption.appendChild(name);
        const quote = ctx.quote(item).text;
        if (quote) {
          const q = document.createElement("div");
          q.className = "vr-reel-quote";
          q.textContent = `"${quote}"`;
          caption.appendChild(q);
        }
        live.textContent = `${name.textContent}, ${index + 1} of ${total}`;
      } else {
        const review = reviews[index - videos.length];
        stage.setAttribute("aria-label", `View review from ${review.authorName}`);
        const text = document.createElement("div");
        text.className = "vr-reel-media vr-reel-text";
        const stars = document.createElement("div");
        stars.className = "vr-stars";
        stars.textContent = "★".repeat(Math.max(0, Math.min(5, review.rating)));
        const body = document.createElement("p");
        body.textContent = review.text ? `"${review.text}"` : "";
        text.appendChild(stars);
        text.appendChild(body);
        stage.appendChild(text);
        const name = document.createElement("div");
        name.className = "vr-reel-name";
        name.textContent = review.authorName;
        caption.appendChild(name);
        live.textContent = `${review.authorName}, ${index + 1} of ${total}`;
      }
    };

    const go = (to: number) => {
      index = (to + total) % total;
      draw();
    };

    stage.addEventListener("click", () => {
      if (index < videos.length) {
        ctx.track("click", videos[index].id);
        ctx.openVideo(index);
      } else {
        ctx.openReview(reviews[index - videos.length]);
      }
    });

    // A horizontal drag moves on; a tap (no drag) falls through to the click above
    let startX: number | null = null;
    let swiped = false;
    stage.addEventListener("pointerdown", (e) => {
      startX = (e as PointerEvent).clientX;
      swiped = false;
    });
    stage.addEventListener("pointerup", (e) => {
      if (startX === null) return;
      const dx = (e as PointerEvent).clientX - startX;
      startX = null;
      if (Math.abs(dx) >= SWIPE_PX) {
        swiped = true;
        go(index + (dx < 0 ? 1 : -1));
      }
    });
    stage.addEventListener(
      "click",
      (e) => {
        if (swiped) {
          e.stopImmediatePropagation();
          swiped = false;
        }
      },
      true
    );

    const arrow = (dir: -1 | 1) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `vr-reel-arrow vr-reel-${dir < 0 ? "prev" : "next"}`;
      btn.setAttribute("aria-label", dir < 0 ? "Previous testimonial" : "Next testimonial");
      btn.textContent = dir < 0 ? "‹" : "›";
      btn.addEventListener("click", () => go(index + dir));
      return btn;
    };

    const close = document.createElement("button");
    close.type = "button";
    close.className = "vr-reel-close";
    close.setAttribute("aria-label", "Dismiss testimonial widget");
    close.textContent = "×";
    close.addEventListener("click", () => ctx.dismiss?.());

    card.appendChild(stage);
    card.appendChild(bars);
    card.appendChild(caption);
    card.appendChild(close);
    if (total > 1) {
      card.appendChild(arrow(-1));
      card.appendChild(arrow(1));
    }
    card.appendChild(live);
    draw();
    ctx.root.appendChild(card);
  },
});
