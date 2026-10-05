import type { ReviewVideoProps } from "./types";

/**
 * Made-up reviews used only to preview templates (Remotion Studio, `npm run preview`, tests).
 * They are never shown to customers.
 */
const SAMPLES = [
  {
    author: "Maya Okafor",
    rating: 5,
    date: "March 2026",
    source: "google" as const,
    text: "Setup took ten minutes and support answered every question the same day. We tried three other tools before this and none of them stuck. Honestly the best purchase we made this year.",
  },
  {
    author: "Daniel Reyes",
    rating: 5,
    date: "February 2026",
    source: "trustpilot" as const,
    text: "Our conversion rate went up within a week. The team is lovely to work with.",
  },
  {
    author: "Priya Nair",
    rating: 4,
    date: "January 2026",
    source: "google" as const,
    text: "Simple to use and the reports are genuinely useful. Would recommend to any founder.",
  },
  {
    author: "Tom Becker",
    rating: 5,
    date: "December 2025",
    source: "trustpilot" as const,
    text: "Fast, friendly and exactly what we needed. Five stars.",
  },
];

const BRAND = "#cf3d0b";

export const SAMPLE_PROPS: Record<string, ReviewVideoProps> = {
  spotlight: { reviews: [SAMPLES[0]], brand: BRAND },
  minimal: { reviews: [SAMPLES[0]], brand: BRAND },
  "dark-card": { reviews: [SAMPLES[0]], brand: BRAND },
  stack: { reviews: SAMPLES, brand: BRAND },
  "rating-spotlight": { reviews: [SAMPLES[0]], brand: BRAND, aggregate: { source: "google", rating: 4.8, total: 213 } },
};
