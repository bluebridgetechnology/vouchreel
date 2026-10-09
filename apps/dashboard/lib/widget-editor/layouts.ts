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
  /** Shapes that look right in this layout, the layout's own look first (what "Default" means). */
  shapes: WidgetShape[];
}

export const LAYOUTS: LayoutInfo[] = [
  { id: "floating-card", name: "Floating card", bestFor: "Any page: a small card in the corner", placement: "floating", grid: false, autoAdvance: false, shapes: ["rounded", "square", "circle", "landscape", "portrait", "vertical"] },
  { id: "floating-bubble", name: "Video bubble", bestFor: "Any page: a round video playing in the corner", placement: "floating", grid: false, autoAdvance: false, shapes: ["circle", "rounded", "vertical"] },
  { id: "story-strip", name: "Story strip", bestFor: "Mobile visitors: tappable bubbles", placement: "floating", grid: false, autoAdvance: false, shapes: ["circle", "rounded", "vertical"] },
  { id: "carousel", name: "Carousel", bestFor: "Landing pages: a swipeable row", placement: "inline", grid: false, autoAdvance: true, shapes: ["landscape", "square", "rounded", "portrait", "vertical"] },
  { id: "wall-of-love", name: "Wall of love", bestFor: "A testimonials page: an even grid", placement: "inline", grid: true, autoAdvance: false, shapes: ["landscape", "square", "rounded", "circle", "portrait", "vertical"] },
  { id: "masonry", name: "Masonry", bestFor: "Mixed quotes and videos: staggered columns", placement: "inline", grid: true, autoAdvance: false, shapes: ["landscape", "square", "rounded", "circle", "portrait", "vertical"] },
];

export function layoutInfo(id: WidgetTemplate): LayoutInfo {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

/** A shape the new layout cannot use goes back to the layout's own look (null), so nothing looks broken. */
export function shapeForLayout(shape: WidgetShape | null, template: WidgetTemplate): WidgetShape | null {
  return shape && layoutInfo(template).shapes.includes(shape) ? shape : null;
}
