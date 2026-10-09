import { defineLayout, type LayoutContext } from "../layout-api";
import type { ReviewItem } from "../matcher";
import css from "./rating-badge.css";

/** Reviews listed in the sheet. The badge's count and average still cover all of them. */
const PANEL_MAX = 8;

const textEl = (tag: string, className: string, text: string): HTMLElement => {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
};

/** Average and count over the reviews that carry a usable 1 to 5 rating. */
export function summarize(reviews: ReviewItem[]): { average: number; count: number } {
  const rated = reviews.map((r) => Number(r.rating)).filter((n) => n >= 1 && n <= 5);
  if (rated.length === 0) return { average: 0, count: 0 };
  return { average: rated.reduce((a, b) => a + b, 0) / rated.length, count: rated.length };
}

const PROVIDERS: Record<string, string> = { google: "Google", trustpilot: "Trustpilot" };

/**
 * Rating badge: "4.9 from 312 reviews", small enough for a header or footer. Clicking it opens a sheet with
 * the reviews. The numbers come only from the approved reviews the widget already has, so the badge says
 * "from N reviews" and names a source only when every one of them comes from that one source.
 */
defineLayout("rating-badge", {
  css,
  inline: true,
  render(ctx: LayoutContext) {
    const { average, count } = summarize(ctx.reviews);
    if (count === 0) return;
    const shown = (Math.round(average * 10) / 10).toFixed(1);
    const providers = Array.from(new Set(ctx.reviews.map((r) => r.provider)));
    const source = providers.length === 1 ? PROVIDERS[providers[0]] : undefined;

    const badge = document.createElement("button");
    badge.type = "button";
    badge.className = "vr-badge";
    badge.setAttribute("aria-haspopup", "dialog");
    badge.setAttribute("aria-label", `Rated ${shown} out of 5 from ${count} ${count === 1 ? "review" : "reviews"}. Show reviews`);

    const stars = textEl("span", "vr-stars vr-badge-stars", "★★★★★");
    stars.setAttribute("aria-hidden", "true");
    (stars as HTMLElement).style.setProperty("--vr-fill", `${(average / 5) * 100}%`);
    badge.appendChild(stars);
    badge.appendChild(textEl("span", "vr-badge-score", shown));
    badge.appendChild(textEl("span", "vr-badge-count", `from ${count.toLocaleString("en")} ${count === 1 ? "review" : "reviews"}`));
    if (source) badge.appendChild(textEl("span", "vr-badge-source", `on ${source}`));
    badge.addEventListener("click", () => {
      ctx.track("click");
      openPanel(ctx, badge, shown, count);
    });
    ctx.root.appendChild(badge);
  },
});

/** The sheet of reviews, inside the widget's shadow root. */
function openPanel(ctx: LayoutContext, opener: HTMLElement, shown: string, count: number): void {
  const backdrop = document.createElement("div");
  backdrop.className = "vr-badge-backdrop";
  const sheet = document.createElement("div");
  sheet.className = "vr-badge-sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-label", "Customer reviews");

  const head = document.createElement("div");
  head.className = "vr-badge-head";
  head.appendChild(textEl("span", "vr-badge-score", shown));
  head.appendChild(textEl("span", "vr-badge-count", `from ${count.toLocaleString("en")} ${count === 1 ? "review" : "reviews"}`));
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "vr-badge-close";
  closeBtn.setAttribute("aria-label", "Close reviews");
  closeBtn.textContent = "×";
  head.appendChild(closeBtn);
  sheet.appendChild(head);

  const list = document.createElement("div");
  list.className = "vr-badge-list";
  ctx.reviews.slice(0, PANEL_MAX).forEach((review) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "vr-badge-review";
    row.setAttribute("aria-label", `Read the full review from ${review.authorName}`);
    row.appendChild(textEl("span", "vr-stars", "★".repeat(Math.max(0, Math.min(5, review.rating)))));
    if (review.text) row.appendChild(textEl("span", "vr-badge-text", `"${review.text}"`));
    const by = textEl("span", "vr-badge-by", review.authorName);
    if (PROVIDERS[review.provider]) by.textContent = `${review.authorName} · ${PROVIDERS[review.provider]}`;
    row.appendChild(by);
    row.addEventListener("click", () => {
      close(false);
      ctx.openReview(review);
    });
    list.appendChild(row);
  });
  sheet.appendChild(list);

  const close = (restoreFocus = true) => {
    document.removeEventListener("keydown", onKey, true);
    backdrop.remove();
    sheet.remove();
    if (restoreFocus) opener.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      // Keep focus inside the sheet
      const items = Array.from(sheet.querySelectorAll<HTMLElement>("button"));
      const i = items.indexOf((sheet.getRootNode() as ShadowRoot).activeElement as HTMLElement);
      e.preventDefault();
      items[e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === items.length - 1 ? 0 : i + 1].focus();
    }
  };
  closeBtn.addEventListener("click", () => close());
  backdrop.addEventListener("click", () => close());

  document.addEventListener("keydown", onKey, true);
  ctx.root.appendChild(backdrop);
  ctx.root.appendChild(sheet);
  closeBtn.focus();
}
