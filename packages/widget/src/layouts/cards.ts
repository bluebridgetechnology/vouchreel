import type { ReviewItem } from "../matcher";
import type { LayoutContext } from "../layout-api";
import { videoTile } from "./tile";

/**
 * Video and review cards shared by the grid-style layouts (wall of love, carousel, masonry).
 * Bundled into each of those chunks rather than the core: a page loads one layout only.
 */

/** A div whose content is text, never markup: names and other words from visitors and review sites must not become HTML on a customer's page. */
function textDiv(className: string, text: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = text;
  return el;
}

function avatar(name: string | undefined, fallback: string, photoUrl?: string | null): HTMLElement {
  if (photoUrl) {
    const img = document.createElement("img");
    img.src = photoUrl;
    img.alt = name || "";
    img.className = "vr-card-avatar";
    return img;
  }
  return textDiv("vr-card-avatar", (name || fallback).charAt(0).toUpperCase());
}

export const createVideoCard = videoTile;

export function createReviewCard(ctx: LayoutContext, review: ReviewItem): HTMLElement {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "vr-card vr-blend-review-card";
  card.setAttribute("aria-label", `View review from ${review.authorName} on ${review.provider}`);

  // Top Row: Source Badge & Stars
  const topRow = document.createElement("div");
  topRow.className = "vr-card-top-row";

  const badge = document.createElement("span");
  badge.className = `vr-provider-badge ${review.provider === "google" ? "vr-badge-google" : "vr-badge-trustpilot"}`;
  badge.textContent = review.provider === "google" ? "Google" : "Trustpilot";
  topRow.appendChild(badge);

  const stars = document.createElement("div");
  stars.className = "vr-stars";
  stars.textContent = Array.from({ length: 5 })
    .map((_, i) => (i < review.rating ? "★" : "☆"))
    .join("");
  topRow.appendChild(stars);
  card.appendChild(topRow);

  // Review Text
  if (review.text) {
    const text = document.createElement("p");
    text.className = "vr-card-quote-text";
    text.textContent = `"${review.text}"`;
    card.appendChild(text);
  }

  // Author Row
  const authorRow = document.createElement("div");
  authorRow.className = "vr-card-author-row";
  authorRow.appendChild(avatar(review.authorName, "A", review.authorPhotoUrl));

  const info = document.createElement("div");
  const dateStr = review.reviewDate ? new Date(review.reviewDate).toLocaleDateString() : "";
  info.appendChild(textDiv("vr-card-author-name", review.authorName));
  if (dateStr) info.appendChild(textDiv("vr-card-author-sub", dateStr));
  authorRow.appendChild(info);
  card.appendChild(authorRow);

  card.addEventListener("click", () => ctx.openReview(review));

  return card;
}

/** Video testimonials and text reviews, alternating, so neither kind bunches at one end. */
export function interleavedCards(ctx: LayoutContext): HTMLElement[] {
  const cards: HTMLElement[] = [];
  const maxLen = Math.max(ctx.testimonials.length, ctx.reviews.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < ctx.testimonials.length) cards.push(createVideoCard(ctx, ctx.testimonials[i], i));
    if (i < ctx.reviews.length) cards.push(createReviewCard(ctx, ctx.reviews[i]));
  }
  return cards;
}
