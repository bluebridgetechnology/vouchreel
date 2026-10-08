import { defineLayout } from "../layout-api";
import css from "./story-strip.css";

function storyButton(label: string, title: string, photoUrl: string | null | undefined, name: string | undefined, fallback: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "vr-story-item";
  btn.setAttribute("aria-label", label);
  btn.setAttribute("title", title);
  if (photoUrl) {
    const img = document.createElement("img");
    img.src = photoUrl;
    img.alt = name || "";
    btn.appendChild(img);
  } else {
    btn.textContent = (name || fallback).charAt(0).toUpperCase();
  }
  return btn;
}

/** Story Strip: Instagram-style circles, a ring per video and per review. */
defineLayout("story-strip", {
  css,
  inline: false,
  render(ctx) {
    const strip = document.createElement("div");
    strip.className = "vr-strip-wrapper";

    ctx.testimonials.slice(0, 4).forEach((item, idx) => {
      const btn = storyButton(
        `Play video testimonial from ${item.customerName || "Customer"}`,
        item.customerName || "Video testimonial",
        item.thumbnailUrl,
        item.customerName,
        "V"
      );
      btn.addEventListener("click", () => {
        ctx.track("click", item.id);
        ctx.openVideo(idx);
      });
      strip.appendChild(btn);
    });

    ctx.reviews.slice(0, 3).forEach((review) => {
      const btn = storyButton(
        `View review from ${review.authorName} on ${review.provider}`,
        `${review.authorName} (${review.provider})`,
        review.authorPhotoUrl,
        review.authorName,
        "R"
      );
      btn.classList.add(review.provider === "google" ? "vr-story-review-google" : "vr-story-review-trustpilot");

      const starBadge = document.createElement("span");
      starBadge.className = "vr-story-badge";
      starBadge.textContent = "★";
      btn.appendChild(starBadge);

      btn.addEventListener("click", () => ctx.openReview(review));
      strip.appendChild(btn);
    });

    ctx.root.appendChild(strip);
  },
});
