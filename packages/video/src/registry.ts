import { ASPECTS, BACKGROUND_STYLES, FPS, type Aspect, type BackgroundStyle, type ReviewVideoProps, type VideoReview } from "./types";

export * from "./types";
export { derivePalette, auroraBlobs, tint, type Palette, type PaletteOptions } from "./lib/palette";
export { swatchFor, type Swatch } from "./lib/swatch";
export { SAMPLE_PROPS } from "./sample";

/**
 * Template catalogue. This file is imported by the dashboard (including the browser), so it
 * must stay free of Remotion/React imports: only data and pure functions live here.
 * To add a template: add an entry here, a component in src/templates, and a line in src/Root.tsx.
 */

export interface TemplateInfo {
  id: string;
  label: string;
  description: string;
  /** How many reviews the template shows. */
  reviews: { min: number; max: number };
  /** The background style used when the customer has not chosen one. */
  defaultStyle: BackgroundStyle;
  /** Needs provider-reported totals (rating and count) to show. */
  requiresAggregate: boolean;
  /** Longest single review (characters) that still reads comfortably. Reviews are never trimmed. */
  maxChars: number;
  /** Length of the finished video, from the content. */
  durationSeconds(props: ReviewVideoProps): number;
}

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Seconds for one review: lead-in, word-by-word reveal, then time to read the author. */
export const singleReviewSeconds = (text: string, lead: number, wordsPerSecond: number, hold: number) =>
  clamp(lead + words(text) / wordsPerSecond + hold, 6, 24);

export const STACK_HEADER_SECONDS = 1.6;
export const STACK_OUTRO_SECONDS = 1.2;
export const stackItemSeconds = (text: string) => clamp(1 + words(text) / 4.8 + 1.4, 3.6, 9);

export const RATING_INTRO_SECONDS = 3.4;

export const TEMPLATES: TemplateInfo[] = [
  {
    id: "spotlight",
    defaultStyle: "gradient",
    label: "Spotlight",
    description: "Bold brand gradient. Stars pop in, the review types out word by word.",
    reviews: { min: 1, max: 1 },
    requiresAggregate: false,
    maxChars: 400,
    durationSeconds: (p) => singleReviewSeconds(p.reviews[0].text, 1.2, 4.6, 3.2),
  },
  {
    id: "minimal",
    defaultStyle: "light",
    label: "Minimal",
    description: "Clean light layout with an elegant serif quote. Suits premium brands.",
    reviews: { min: 1, max: 1 },
    requiresAggregate: false,
    maxChars: 400,
    durationSeconds: (p) => singleReviewSeconds(p.reviews[0].text, 0.8, 4.2, 2.8),
  },
  {
    id: "dark-card",
    defaultStyle: "dark",
    label: "Dark card",
    description: "Dark theme with a glowing accent and a floating review card.",
    reviews: { min: 1, max: 1 },
    requiresAggregate: false,
    maxChars: 400,
    durationSeconds: (p) => singleReviewSeconds(p.reviews[0].text, 1, 4.4, 3),
  },
  {
    id: "stack",
    defaultStyle: "gradient",
    label: "Review stack",
    description: "3 to 5 short reviews appearing one after another, like a wall of love.",
    reviews: { min: 3, max: 5 },
    requiresAggregate: false,
    maxChars: 240,
    durationSeconds: (p) =>
      STACK_HEADER_SECONDS + p.reviews.reduce((sum, r) => sum + stackItemSeconds(r.text), 0) + STACK_OUTRO_SECONDS,
  },
  {
    id: "rating-spotlight",
    defaultStyle: "gradient",
    label: "Rating spotlight",
    description: "Opens on the overall rating and review count, then one standout review.",
    reviews: { min: 1, max: 1 },
    requiresAggregate: true,
    maxChars: 320,
    durationSeconds: (p) => RATING_INTRO_SECONDS + singleReviewSeconds(p.reviews[0].text, 0.8, 4.6, 3),
  },
];

export const getTemplate = (id: string) => TEMPLATES.find((t) => t.id === id);

export interface StyleInfo {
  id: BackgroundStyle;
  label: string;
  description: string;
}

/** Background styles every template supports. Colours always come from the brand colour. */
export const STYLES: StyleInfo[] = [
  { id: "gradient", label: "Gradient", description: "Your colour deepening into a richer shade." },
  { id: "solid", label: "Solid", description: "One flat brand colour with soft shapes." },
  { id: "aurora", label: "Aurora", description: "Soft blurred glows of your colour drifting around." },
  { id: "dots", label: "Dots", description: "A subtle dot pattern over your colour." },
  { id: "light", label: "Light", description: "Clean paper tinted with your colour." },
  { id: "dark", label: "Dark", description: "Near-black with a glow of your colour." },
];

export const isBackgroundStyle = (value: unknown): value is BackgroundStyle => BACKGROUND_STYLES.includes(value as BackgroundStyle);

/** The style a video will actually use: the customer's choice, else the template's default. */
export function effectiveStyle(templateId: string, theme?: ReviewVideoProps["theme"]): BackgroundStyle {
  return theme?.style ?? getTemplate(templateId)?.defaultStyle ?? "gradient";
}

export const durationInFrames = (templateId: string, props: ReviewVideoProps): number => {
  const template = getTemplate(templateId);
  if (!template) throw new Error(`Unknown template "${templateId}"`);
  return Math.round(template.durationSeconds(props) * FPS);
};

export const compositionId = (templateId: string, aspect: Aspect) => `${templateId}-${aspect.replace(":", "x")}`;

export const dimensionsFor = (aspect: Aspect) => ASPECTS[aspect];

/** Whether a review can be shown by the template without trimming it. */
export function reviewFits(template: TemplateInfo, review: Pick<VideoReview, "text">): boolean {
  const length = review.text.trim().length;
  return length >= 12 && length <= template.maxChars;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Returns a list of problems (empty when the input can be rendered). Used by the API and the renderer. */
export function validateProps(templateId: string, props: ReviewVideoProps): string[] {
  const template = getTemplate(templateId);
  if (!template) return [`Unknown template "${templateId}".`];

  const problems: string[] = [];
  const { reviews, brand, aggregate, theme } = props;

  if (!HEX.test(brand)) problems.push("Brand colour must be a hex colour like #cf3d0b.");
  if (theme?.style !== undefined && !isBackgroundStyle(theme.style)) problems.push(`Unknown background style "${String(theme.style)}".`);
  if (theme?.secondary !== undefined && !HEX.test(theme.secondary)) problems.push("The second colour must be a hex colour like #1d4ed8.");
  if (!Array.isArray(reviews) || reviews.length < template.reviews.min || reviews.length > template.reviews.max) {
    const range = template.reviews.min === template.reviews.max ? `${template.reviews.min}` : `${template.reviews.min} to ${template.reviews.max}`;
    problems.push(`${template.label} needs ${range} review${template.reviews.max === 1 ? "" : "s"}.`);
    return problems;
  }

  reviews.forEach((review, i) => {
    const label = `Review ${i + 1}`;
    if (!review.author?.trim()) problems.push(`${label} has no author.`);
    if (review.rating == null ? review.source !== "own" : !Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) problems.push(`${label} needs a rating from 1 to 5.`);
    if (!reviewFits(template, review)) {
      problems.push(`${label} must be between 12 and ${template.maxChars} characters for this template (reviews are never shortened).`);
    }
    if (review.source !== "google" && review.source !== "trustpilot" && review.source !== "own") problems.push(`${label} has an unknown source.`);
  });

  if (template.requiresAggregate) {
    if (!aggregate || !(aggregate.rating >= 0 && aggregate.rating <= 5) || !Number.isInteger(aggregate.total) || aggregate.total < 1) {
      problems.push(`${template.label} needs the source's overall rating and review count.`);
    }
  }
  return problems;
}
