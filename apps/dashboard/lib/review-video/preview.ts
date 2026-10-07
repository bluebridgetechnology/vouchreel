import { SAMPLE_PROPS, type BackgroundStyle, type ReviewVideoProps, type VideoFontId } from "@vouchreel/video";
import { DEFAULT_BRAND_HEX } from "@/lib/brand";
import type { ReviewOptionView, SourceStatsView, TemplateView } from "./ui-state";

const HEX = /^#[0-9a-fA-F]{6}$/;

export interface PreviewInput {
  template: TemplateView;
  /** The reviews picked so far, in order. */
  picked: ReviewOptionView[];
  stats: SourceStatsView[];
  brand: string;
  /** This video's style; null = the brand kit's default. */
  style: BackgroundStyle | null;
  brandStyle: BackgroundStyle | null;
  /** undefined = the brand default, null = none. */
  secondary: string | null | undefined;
  brandSecondary: string | null;
  /** This video's font; null = the brand kit's default. */
  font?: VideoFontId | null;
  brandFont?: VideoFontId | null;
}

export interface PreviewResult {
  props: ReviewVideoProps;
  /** True while the preview still shows made-up sample reviews (nothing valid picked yet). */
  usingSample: boolean;
}

/**
 * What the live preview renders: the customer's real picks once there are enough of them, otherwise
 * sample text, always in the colours and style they have chosen. Mirrors how the server resolves a
 * video's theme (this video's choice, then the brand kit, then the template's own default).
 */
export function previewProps(input: PreviewInput): PreviewResult {
  const sample = SAMPLE_PROPS[input.template.id];
  const enough = input.picked.length >= input.template.reviews.min && input.picked.length <= input.template.reviews.max;

  const reviews: ReviewVideoProps["reviews"] = enough
    ? input.picked.map((r) => ({ author: r.author, rating: r.rating, text: r.text, date: r.date ?? undefined, source: r.source, ...(r.link ? { link: r.link } : {}) }))
    : (sample?.reviews ?? []);

  const aggregate = input.template.requiresAggregate ? (input.stats[0] ? { source: input.stats[0].source, rating: input.stats[0].rating, total: input.stats[0].total } : sample?.aggregate) : undefined;

  const style = input.style ?? input.brandStyle ?? undefined;
  const second = input.secondary === undefined ? input.brandSecondary : input.secondary;
  const secondary = second && HEX.test(second) ? second : undefined;
  const font = input.font ?? input.brandFont ?? undefined;
  const theme = style || secondary || font ? { ...(style ? { style } : {}), ...(secondary ? { secondary } : {}), ...(font ? { font } : {}) } : undefined;

  return {
    props: { reviews, brand: HEX.test(input.brand) ? input.brand : DEFAULT_BRAND_HEX, ...(aggregate ? { aggregate } : {}), ...(theme ? { theme } : {}) },
    usingSample: !enough,
  };
}
