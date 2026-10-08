import type { TriggerType, WidgetPosition, WidgetTemplate, WidgetTheme } from "@/lib/validations/widget-config";

/**
 * The widget editor's live preview runs the real widget in a frame (`/widget/preview.html`, built by
 * packages/widget) and sends it the draft configuration with postMessage. This module holds the parts
 * that are not React: the message, the sample content, and the device sizes.
 */

export interface PreviewTestimonial {
  id: string;
  videoUrl: string;
  platform: string;
  thumbnailUrl?: string | null;
  customerName?: string;
  customerCompany?: string;
  quote?: string | null;
  durationSeconds?: number | null;
  [key: string]: unknown;
}

export interface PreviewReview {
  id: string;
  provider: string;
  authorName: string;
  authorPhotoUrl?: string | null;
  rating: number;
  text: string | null;
  reviewDate: string | null;
}

export interface PreviewContent {
  testimonials: PreviewTestimonial[];
  reviews: PreviewReview[];
  whiteLabel?: { removeBranding?: boolean; logoUrl?: string | null };
  /** True when the space has nothing published yet and the preview shows made-up items. */
  sample: boolean;
}

export interface PreviewDraft {
  template: WidgetTemplate;
  position: WidgetPosition;
  theme: WidgetTheme;
  autoplayPreview: boolean;
}

export interface PreviewPage {
  dark: boolean;
  background?: string;
}

export const DEVICES = {
  desktop: { label: "Desktop", width: 1280, height: 800 },
  tablet: { label: "Tablet", width: 768, height: 1024 },
  mobile: { label: "Mobile", width: 375, height: 740 },
} as const;
export type PreviewDevice = keyof typeof DEVICES;

/** The message `preview.js` listens for (see packages/widget/src/preview.ts). */
export function buildPreviewMessage(draft: PreviewDraft, content: PreviewContent, page: PreviewPage) {
  return {
    type: "vouchreel:preview" as const,
    config: {
      template: draft.template,
      position: draft.position,
      theme: draft.theme,
      autoplayPreview: draft.autoplayPreview,
    },
    testimonials: content.testimonials,
    reviews: content.reviews,
    whiteLabel: content.whiteLabel,
    page,
  };
}

/** Scale that fits a device-sized page into the space available, never enlarging it. */
export function fitScale(available: { width: number; height: number }, device: { width: number; height: number }): number {
  if (available.width <= 0 || available.height <= 0) return 1;
  return Math.min(1, available.width / device.width, available.height / device.height);
}

/** A poster for sample videos: a soft gradient with the person's initial, as an inline SVG (no outside host). */
function samplePoster(initial: string, from: string, to: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="640" height="640" fill="url(#g)"/><circle cx="320" cy="270" r="96" fill="#ffffff" fill-opacity="0.22"/><path d="M150 560c20-110 90-170 170-170s150 60 170 170" fill="#ffffff" fill-opacity="0.22"/><text x="320" y="296" font-family="system-ui,sans-serif" font-size="88" font-weight="600" fill="#ffffff" text-anchor="middle">${initial}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Made-up items shown while a space has nothing published, so every layout has something to draw. */
export const SAMPLE_CONTENT: PreviewContent = {
  sample: true,
  testimonials: [
    { id: "sample-1", platform: "mp4", videoUrl: "", thumbnailUrl: samplePoster("S", "#f97316", "#be185d"), customerName: "Sarah Chen", customerCompany: "Northwind", quote: "We doubled our demo bookings within a month of adding video reviews.", durationSeconds: 42 },
    { id: "sample-2", platform: "mp4", videoUrl: "", thumbnailUrl: samplePoster("D", "#0ea5e9", "#4f46e5"), customerName: "David Okafor", customerCompany: "Brightside", quote: "Setup took five minutes and it looks like part of our site.", durationSeconds: 31 },
    { id: "sample-3", platform: "mp4", videoUrl: "", thumbnailUrl: samplePoster("M", "#10b981", "#0f766e"), customerName: "Maria Lopez", customerCompany: "Fieldnote", quote: "Customers trust a face more than a paragraph.", durationSeconds: 27 },
  ],
  reviews: [
    { id: "sample-r1", provider: "google", authorName: "James W.", rating: 5, text: "Friendly team and a product that just works.", reviewDate: "2026-09-12" },
    { id: "sample-r2", provider: "trustpilot", authorName: "Priya N.", rating: 5, text: "Our conversion rate went up the week we installed it.", reviewDate: "2026-08-28" },
    { id: "sample-r3", provider: "google", authorName: "Tom B.", rating: 4, text: "Great value. Would love even more layouts.", reviewDate: "2026-08-03" },
  ],
};

/** Content for the preview from the public widget endpoint's answer; the samples when it has nothing. */
export function previewContentFrom(data: unknown): PreviewContent {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const testimonials = Array.isArray(d.testimonials) ? (d.testimonials as PreviewTestimonial[]) : [];
  const reviews = Array.isArray(d.reviews) ? (d.reviews as PreviewReview[]) : [];
  const whiteLabel = (d.whiteLabel ?? undefined) as PreviewContent["whiteLabel"];
  if (testimonials.length === 0 && reviews.length === 0) return { ...SAMPLE_CONTENT, whiteLabel };
  return { testimonials, reviews, whiteLabel, sample: false };
}

/** The line next to the preview title that says when the widget would appear. */
export function triggerLabel(triggerType: TriggerType, triggerValue: Record<string, unknown>): string {
  switch (triggerType) {
    case "delay":
      return `Trigger: ${triggerValue.seconds ?? 5}s delay`;
    case "scroll-depth":
      return `Trigger: ${triggerValue.percentage ?? 50}% scroll`;
    case "pageview-count":
      return `Trigger: ${triggerValue.count ?? 2} pageviews`;
    case "exit-intent":
      return "Trigger: Exit intent";
    case "returning-visitor":
      return "Trigger: Returning visitor";
    default:
      return "Trigger: Instant";
  }
}
