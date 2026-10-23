import type { WidgetTemplate } from "@/lib/validations/widget-config";
import { DEFAULT_WIDGET_THEME } from "@/lib/validations/widget-config";
import type { PreviewContent, PreviewDraft } from "@/lib/widget-preview";

/**
 * Content for the marketing site's live widget demo: the real widget (through the editor's preview frame)
 * playing short sample videos. Every person and business is made up and the demo says so on screen.
 * The videos and posters are rendered by `npm run landing-demo -w @vouchreel/video`, which has the same
 * people and words in the same order. There are no reviews: the widget would badge them as Google or
 * Trustpilot reviews, and made-up reviews under a real provider's name are not something to show.
 */
const PEOPLE: { name: string; company: string; quote: string; seconds: number }[] = [
  { name: "Sarah Chen", company: "Northwind Coffee", quote: "The beans arrive fresh every month and the tasting notes are spot on.", seconds: 9 },
  { name: "David Okafor", company: "Brightside Gym", quote: "The coaches made the first week easy and I've kept going ever since.", seconds: 9 },
  { name: "Maria Lopez", company: "Fieldnote Studio", quote: "They rebuilt our website in three weeks and explained every decision.", seconds: 8 },
  { name: "Aiko Tanaka", company: "Lumen Skincare", quote: "Gentle, simple and it smells lovely.", seconds: 8 },
  { name: "Liam Walsh", company: "Harbor Homes", quote: "Booking a viewing took two minutes.", seconds: 8 },
  { name: "Nia Adeyemi", company: "Kite Design School", quote: "Practical from day one.", seconds: 8 },
];

export const LANDING_DEMO_CONTENT: PreviewContent = {
  sample: true,
  testimonials: PEOPLE.map((p, i) => ({
    id: `demo-${i + 1}`,
    platform: "mp4",
    videoUrl: `/demo/sample-${i + 1}.mp4`,
    thumbnailUrl: `/demo/sample-${i + 1}.jpg`,
    customerName: p.name,
    customerCompany: p.company,
    quote: p.quote,
    durationSeconds: p.seconds,
  })),
  reviews: [],
};

/** The layouts the demo offers, in the order of the picker. Rating badge is left out: it shows reviews only. */
export const LANDING_DEMO_LAYOUTS: WidgetTemplate[] = [
  "floating-bubble",
  "floating-reel",
  "floating-card",
  "story-strip",
  "carousel",
  "wall-of-love",
  "reel-feed",
  "spotlight",
  "masonry",
  "marquee",
];

export function landingDemoDraft(template: WidgetTemplate): PreviewDraft {
  // The sample videos already show their quote on screen, so the widget does not print it again over them
  return { template, position: "bottom-right", theme: { ...DEFAULT_WIDGET_THEME, showQuote: false }, autoplayPreview: true };
}
