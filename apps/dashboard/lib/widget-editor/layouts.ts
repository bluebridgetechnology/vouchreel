import type { WidgetTemplate } from "@/lib/validations/widget-config";

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
}

export const LAYOUTS: LayoutInfo[] = [
  { id: "floating-card", name: "Floating card", bestFor: "Any page: a small card in the corner", placement: "floating", grid: false, autoAdvance: false },
  { id: "story-strip", name: "Story strip", bestFor: "Mobile visitors: tappable bubbles", placement: "floating", grid: false, autoAdvance: false },
  { id: "carousel", name: "Carousel", bestFor: "Landing pages: a swipeable row", placement: "inline", grid: false, autoAdvance: true },
  { id: "wall-of-love", name: "Wall of love", bestFor: "A testimonials page: an even grid", placement: "inline", grid: true, autoAdvance: false },
  { id: "masonry", name: "Masonry", bestFor: "Mixed quotes and videos: staggered columns", placement: "inline", grid: true, autoAdvance: false },
];

export function layoutInfo(id: WidgetTemplate): LayoutInfo {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}
