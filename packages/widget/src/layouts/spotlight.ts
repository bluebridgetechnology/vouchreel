import { defineLayout, type LayoutContext } from "../layout-api";
import css from "./spotlight.css";

const MAX_SLIDES = 6;

function textEl(tag: string, className: string, text: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

type Slide = { kind: "video"; index: number } | { kind: "review"; index: number };

/**
 * Spotlight: one large featured testimonial, with a row of small pictures to switch between up to six.
 * The picture is a poster (no video is downloaded); clicking it opens the widget's player, which can play
 * every kind of video. With `autoAdvance` set it moves on by itself, pausing while the visitor hovers or
 * focuses inside and stopping for good once they choose one themselves.
 */
defineLayout("spotlight", {
  css,
  inline: true,
  render(ctx: LayoutContext) {
    const slides: Slide[] = [
      ...ctx.testimonials.slice(0, MAX_SLIDES).map((_, index): Slide => ({ kind: "video", index })),
      ...ctx.reviews.slice(0, Math.max(0, MAX_SLIDES - ctx.testimonials.length)).map((_, index): Slide => ({ kind: "review", index })),
    ];
    if (slides.length === 0) return;

    let current = 0;
    const wrap = document.createElement("div");
    wrap.className = "vr-spot";
    const main = document.createElement("div");
    main.className = "vr-spot-main";
    const rail = document.createElement("div");
    rail.className = "vr-spot-rail";
    const live = document.createElement("div");
    live.className = "vr-sr-only";
    live.setAttribute("aria-live", "polite");

    const dots = slides.map((slide, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "vr-spot-dot";
      const item = slide.kind === "video" ? ctx.testimonials[slide.index] : null;
      const review = slide.kind === "review" ? ctx.reviews[slide.index] : null;
      const name = item?.customerName || review?.authorName || "";
      dot.setAttribute("aria-label", `Show testimonial${name ? ` from ${name}` : ""}`);
      if (item?.thumbnailUrl) {
        const img = document.createElement("img");
        img.src = item.thumbnailUrl;
        img.alt = "";
        dot.appendChild(img);
      } else {
        dot.textContent = (name || "★").charAt(0).toUpperCase();
      }
      dot.addEventListener("click", () => {
        stopped = true;
        show(i);
      });
      rail.appendChild(dot);
      return dot;
    });

    const show = (i: number) => {
      current = i;
      dots.forEach((d, n) => d.setAttribute("aria-pressed", String(n === i)));
      main.textContent = "";
      const slide = slides[i];

      if (slide.kind === "video") {
        const item = ctx.testimonials[slide.index];
        const media = document.createElement("button");
        media.type = "button";
        media.className = "vr-spot-media";
        media.setAttribute("aria-label", `Play video testimonial${item.customerName ? ` from ${item.customerName}` : ""}`);
        if (item.thumbnailUrl) {
          const img = document.createElement("img");
          img.src = item.thumbnailUrl;
          img.alt = "";
          media.appendChild(img);
        } else {
          media.appendChild(textEl("span", "vr-spot-initial", (item.customerName || "V").charAt(0).toUpperCase()));
        }
        const badge = document.createElement("span");
        badge.className = "vr-play-badge";
        badge.setAttribute("aria-hidden", "true");
        badge.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
        media.appendChild(badge);
        media.addEventListener("click", () => {
          ctx.track("click", item.id);
          ctx.openVideo(slide.index);
        });
        main.appendChild(media);

        const body = document.createElement("div");
        body.className = "vr-spot-body";
        const quote = ctx.quote(item).text;
        if (quote) body.appendChild(textEl("blockquote", "vr-spot-quote", `"${quote}"`));
        const who = document.createElement("div");
        who.className = "vr-spot-who";
        if (item.customerName) who.appendChild(textEl("span", "vr-spot-name", item.customerName));
        if (item.customerCompany) who.appendChild(textEl("span", "vr-spot-company", item.customerCompany));
        body.appendChild(who);
        main.appendChild(body);
        live.textContent = item.customerName || "Testimonial";
      } else {
        const review = ctx.reviews[slide.index];
        const body = document.createElement("div");
        body.className = "vr-spot-body vr-spot-wide";
        body.appendChild(textEl("div", "vr-stars", "★".repeat(Math.max(0, Math.min(5, review.rating)))));
        if (review.text) body.appendChild(textEl("blockquote", "vr-spot-quote", `"${review.text}"`));
        const who = document.createElement("div");
        who.className = "vr-spot-who";
        who.appendChild(textEl("span", "vr-spot-name", review.authorName));
        const source = textEl("span", `vr-provider-badge ${review.provider === "google" ? "vr-badge-google" : "vr-badge-trustpilot"}`, review.provider === "google" ? "Google" : "Trustpilot");
        who.appendChild(source);
        body.appendChild(who);
        const more = textEl("button", "vr-spot-more", "Read full review");
        (more as HTMLButtonElement).type = "button";
        more.addEventListener("click", () => ctx.openReview(review));
        body.appendChild(more);
        main.appendChild(body);
        live.textContent = review.authorName;
      }
    };

    // Moving on by itself
    const seconds = Number(ctx.theme?.autoAdvance) || 0;
    let stopped = false;
    let paused = false;
    if (seconds > 0 && slides.length > 1 && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      const pause = (v: boolean) => () => (paused = v);
      for (const [type, v] of [["mouseenter", true], ["mouseleave", false], ["focusin", true], ["focusout", false]] as const) wrap.addEventListener(type, pause(v));
      const timer = setInterval(() => {
        if (stopped || !wrap.isConnected) return clearInterval(timer);
        if (!paused) show((current + 1) % slides.length);
      }, seconds * 1000);
    }

    wrap.appendChild(main);
    if (slides.length > 1) wrap.appendChild(rail);
    wrap.appendChild(live);
    ctx.root.appendChild(wrap);
    show(0);
  },
});
