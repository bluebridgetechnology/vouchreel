/**
 * Pure brand-kit helpers with no database imports, so client components (the Brand page, the
 * widget preview) and server code can share them.
 */

/** Background styles for review videos (see packages/video). */
export type VideoStyleValue = "gradient" | "solid" | "aurora" | "dots" | "light" | "dark";

/** The editable fields of a kit, as the UI and API use them. */
export interface BrandKitValues {
  primaryColor: string;
  accentColor: string | null;
  borderRadius: number | null;
  fontMode: "default" | "inherit" | "custom";
  fontFamily: string | null;
  inheritTextColor: boolean;
  /** Default background style for review videos; null = each template's own default. */
  videoStyle: VideoStyleValue | null;
  /** Optional second colour for review video backgrounds. */
  videoSecondaryColor: string | null;
}

/**
 * Widget theme with the brand kit applied. Once a kit exists it decides colours, radius and
 * typography; the widget's own theme keeps only what is specific to it (light or dark mode).
 * Without a kit the theme is returned untouched, so existing widgets do not change.
 */
export function applyBrandKitToTheme<T extends Record<string, unknown>>(theme: T, kit: BrandKitValues | null): T {
  if (!kit) return theme;
  return {
    ...theme,
    primaryColor: kit.primaryColor,
    ...(kit.accentColor ? { accentColor: kit.accentColor } : {}),
    ...(kit.borderRadius !== null ? { borderRadius: kit.borderRadius } : {}),
    fontMode: kit.fontMode,
    ...(kit.fontMode === "custom" && kit.fontFamily ? { fontFamily: kit.fontFamily } : {}),
    inheritTextColor: kit.inheritTextColor,
  };
}

function channel(hex: string, from: number): number {
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const v = parseInt(full.slice(from, from + 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** WCAG contrast ratio between two hex colours (#rgb or #rrggbb), 1 to 21. */
export function contrastBetween(a: string, b: string): number {
  const lum = (hex: string) => 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Colour of text on the primary colour when the owner has not chosen one (the widget's own default). */
export const DEFAULT_ACCENT_HEX = "#ffffff";

/** Text on a coloured button needs at least this contrast to be comfortably readable. */
export const MIN_BUTTON_CONTRAST = 4.5;

/** Human description of the font choice, for settings screens. */
export function describeFont(kit: Pick<BrandKitValues, "fontMode" | "fontFamily">): string {
  if (kit.fontMode === "inherit") return "Your site's font";
  if (kit.fontMode === "custom") return kit.fontFamily ? `${kit.fontFamily} (from your site)` : "Custom font";
  return "Vouchreel's default font";
}
