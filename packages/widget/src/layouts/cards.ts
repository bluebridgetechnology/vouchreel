import type { TestimonialItem, ReviewItem } from "../matcher";
import type { LayoutContext } from "../layout-api";

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

export function createVideoCard(ctx: LayoutContext, item: TestimonialItem, idx: number): HTMLElement {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "vr-card vr-blend-video-card";
  card.setAttribute("aria-label", `Play video testimonial from ${item.customerName || "customer"}`);

  // Media Thumbnail
  const thumb = document.createElement("div");
  thumb.className = "vr-card-video-thumb";

  if (item.thumbnailUrl) {
    const img = document.createElement("img");
    img.src = item.thumbnailUrl;
    img.alt = item.customerName || "Video testimonial thumbnail";
    thumb.appendChild(img);
  } else if (item.generated) {
    // A made video has no poster: show its first frames. If the file is gone (taken down), drop the card.
    const frame = document.createElement("video");
    frame.src = `${item.videoUrl}#t=1`;
    frame.preload = "metadata";
    frame.muted = true;
    frame.onerror = () => card.remove();
    thumb.appendChild(frame);
  }

  const playBadge = document.createElement("div");
  playBadge.className = "vr-play-badge";
  playBadge.setAttribute("aria-hidden", "true");
  playBadge.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  thumb.appendChild(playBadge);

  if (item.durationSeconds) {
    const duration = document.createElement("span");
    duration.className = "vr-card-duration";
    const mins = Math.floor(item.durationSeconds / 60);
    const secs = String(item.durationSeconds % 60).padStart(2, "0");
    duration.textContent = `${mins}:${secs}`;
    thumb.appendChild(duration);
  }

  card.appendChild(thumb);

  // Badge
  const badgeRow = document.createElement("div");
  const badge = document.createElement("span");
  badge.className = "vr-provider-badge vr-badge-video";
  badge.textContent = (item.badge as string) || "📹 Video Testimonial";
  badgeRow.appendChild(badge);
  card.appendChild(badgeRow);

  // Quote / Title (with multi-language translation support)
  const effective = ctx.quote(item);
  if (effective.text) {
    const text = document.createElement("p");
    text.className = "vr-card-quote-text";
    text.textContent = `"${effective.text}"`;
    if (effective.isTranslated) {
      text.setAttribute("data-translated-lang", effective.lang || "");
    }
    card.appendChild(text);
  }

  // Author
  const authorRow = document.createElement("div");
  authorRow.className = "vr-card-author-row";
  authorRow.appendChild(avatar(item.customerName, "C"));

  const info = document.createElement("div");
  info.appendChild(textDiv("vr-card-author-name", item.customerName || "Customer"));
  if (item.customerCompany) info.appendChild(textDiv("vr-card-author-sub vr-card-company", item.customerCompany));
  authorRow.appendChild(info);
  card.appendChild(authorRow);

  card.addEventListener("click", () => {
    ctx.track("click", item.id);
    ctx.openVideo(idx);
  });

  return card;
}

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
