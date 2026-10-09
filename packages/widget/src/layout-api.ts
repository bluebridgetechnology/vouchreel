import type { TestimonialItem, ReviewItem } from "./matcher";

/**
 * The contract between the widget core and a layout chunk.
 *
 * Every layout except the default floating card ships as its own small script
 * (`dist/layouts/<name>.js`), so the core stays inside its size budget and a page only
 * downloads the layout it shows. A chunk is an IIFE that calls `defineLayout`; it must
 * only import types from the core, never code, or that code is bundled twice.
 *
 * A core cached by a browser can meet a newer chunk after a deploy, so changes to this
 * contract must stay backward compatible: add optional members, never rename or remove.
 */

export interface EffectiveQuote {
  text: string | null;
  isTranslated: boolean;
  lang?: string;
}

export interface LayoutContext {
  /** The themed root inside the shadow DOM. Cleared by the core before each render. */
  root: HTMLElement;
  testimonials: TestimonialItem[];
  reviews: ReviewItem[];
  /** Quote in the visitor's language when a translation exists. */
  quote(item: TestimonialItem): EffectiveQuote;
  openVideo(index: number): void;
  openReview(review: ReviewItem): void;
  track(type: "click", testimonialId?: string): void;
  /** The widget's theme (normalized by the API), for layout behaviour such as auto-advance. */
  theme?: Record<string, unknown>;
  /** Floating layouts: hides the widget for the rest of the visit (the close button). */
  dismiss?(): void;
  /** False when the owner turned off muted video previews. */
  autoplay?: boolean;
}

export interface LayoutDefinition {
  /** Scoped CSS added to the shadow root next to the core styles. */
  css: string;
  /** Inline layouts render in the page flow; floating ones are fixed to a corner and can be dismissed. */
  inline: boolean;
  render(ctx: LayoutContext): void;
}

declare global {
  interface Window {
    __vrLayouts?: Record<string, LayoutDefinition>;
  }
}

export function layoutRegistry(): Record<string, LayoutDefinition> {
  if (typeof window === "undefined") return {};
  return (window.__vrLayouts ||= {});
}

/** Called by a layout chunk to make itself available to the core. */
export function defineLayout(name: string, layout: LayoutDefinition): void {
  layoutRegistry()[name] = layout;
}
