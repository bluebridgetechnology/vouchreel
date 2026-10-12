import type { WIDGET_SHAPES, WidgetTemplate } from "@/lib/validations/widget-config";

export type WidgetShape = (typeof WIDGET_SHAPES)[number];

/**
 * What the editor knows about each layout: how it is described, and which settings mean anything for it,
 * so the editor only shows controls that change something.
 */
export interface LayoutInfo {
  id: WidgetTemplate;
  name: string;
  /** One line: where it works best. */
  bestFor: string;
  /** Floating layouts sit in a corner of every matching page; inline ones go where the owner places them. */
  placement: "floating" | "inline";
  /** Columns and spacing apply. */
  grid: boolean;
  /** Can scroll itself. */
  autoAdvance: boolean;
  /** Shapes that look right in this layout, the layout's own look first (what "Default" means). Empty when the layout has no picture to shape. */
  shapes: WidgetShape[];
}

export const LAYOUTS: LayoutInfo[] = [
  { id: "floating-card", name: "Floating card", bestFor: "Any page: a small card in the corner", placement: "floating", grid: false, autoAdvance: false, shapes: ["rounded", "square", "circle", "landscape", "portrait", "vertical"] },
  { id: "floating-bubble", name: "Video bubble", bestFor: "Any page: a round video playing in the corner", placement: "floating", grid: false, autoAdvance: false, shapes: ["circle", "rounded", "vertical"] },
  { id: "floating-reel", name: "Video reel", bestFor: "Mobile and social-style sites: a tall card you swipe through", placement: "floating", grid: false, autoAdvance: false, shapes: ["vertical", "portrait", "square", "rounded"] },
  { id: "story-strip", name: "Story strip", bestFor: "Mobile visitors: tappable bubbles", placement: "floating", grid: false, autoAdvance: false, shapes: ["circle", "rounded", "vertical"] },
  { id: "reel-feed", name: "Reel feed", bestFor: "Product and landing pages: tall tiles that open full screen", placement: "inline", grid: false, autoAdvance: false, shapes: ["vertical", "portrait", "square", "rounded"] },
  { id: "spotlight", name: "Spotlight", bestFor: "Hero and pricing sections: one big testimonial", placement: "inline", grid: false, autoAdvance: true, shapes: ["landscape", "portrait", "square", "vertical", "rounded"] },
  { id: "rating-badge", name: "Rating badge", bestFor: "Headers and footers: a small score that opens the reviews", placement: "inline", grid: false, autoAdvance: false, shapes: [] },
  { id: "marquee", name: "Marquee", bestFor: "Landing pages: a slow strip of reviews and videos", placement: "inline", grid: false, autoAdvance: false, shapes: [] },
  { id: "carousel", name: "Carousel", bestFor: "Landing pages: a swipeable row", placement: "inline", grid: false, autoAdvance: true, shapes: ["portrait", "landscape", "square", "rounded", "vertical"] },
  { id: "wall-of-love", name: "Wall of love", bestFor: "A testimonials page: an even grid", placement: "inline", grid: true, autoAdvance: false, shapes: ["portrait", "landscape", "square", "rounded", "circle", "vertical"] },
  { id: "masonry", name: "Masonry", bestFor: "Mixed quotes and videos: staggered columns", placement: "inline", grid: true, autoAdvance: false, shapes: ["portrait", "landscape", "square", "rounded", "circle", "vertical"] },
];

export function layoutInfo(id: WidgetTemplate): LayoutInfo {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

/** A shape the new layout cannot use goes back to the layout's own look (null), so nothing looks broken. */
export function shapeForLayout(shape: WidgetShape | null, template: WidgetTemplate): WidgetShape | null {
  return shape && layoutInfo(template).shapes.includes(shape) ? shape : null;
}
