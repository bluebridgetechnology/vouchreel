import { defineLayout } from "../layout-api";
import { mediaFor } from "./media";
import css from "./floating-bubble.css";

/**
 * Floating bubble: a round video in the corner, playing muted, that opens the player when clicked.
 * With no videos it shows the best review's rating instead.
 */
defineLayout("floating-bubble", {
  css,
  inline: false,
  render(ctx) {
    const wrap = document.createElement("div");
    wrap.className = "vr-bubble";

    const item = ctx.testimonials[0];
    const review = ctx.reviews[0];
    const open = document.createElement("button");
    open.type = "button";
    open.className = "vr-bubble-open";

    if (item) {
      open.setAttribute("aria-label", `Play video testimonial${item.customerName ? ` from ${item.customerName}` : ""}`);
      open.appendChild(mediaFor(ctx, item, "vr-bubble-media"));
      open.addEventListener("click", () => {
        ctx.track("click", item.id);
        ctx.openVideo(0);
      });
    } else if (review) {
      open.setAttribute("aria-label", `View review from ${review.authorName}`);
      const rating = document.createElement("span");
      rating.className = "vr-bubble-media vr-media-initial";
      rating.textContent = `★ ${review.rating}`;
      open.appendChild(rating);
      open.addEventListener("click", () => ctx.openReview(review));
    } else {
      return;
    }

    const name = item?.customerName || review?.authorName;
    if (name) {
      const label = document.createElement("span");
      label.className = "vr-bubble-label";
      label.textContent = name;
      open.appendChild(label);
    }
    wrap.appendChild(open);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "vr-bubble-close";
    close.setAttribute("aria-label", "Dismiss testimonial widget");
    close.textContent = "×";
    close.addEventListener("click", () => ctx.dismiss?.());
    wrap.appendChild(close);

    ctx.root.appendChild(wrap);
  },
});
