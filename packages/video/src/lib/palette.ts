import { contrastRatio, luminance, mix, rgba, shiftHue } from "./theme";
import type { BackgroundStyle } from "../types";

/**
 * Palette derivation. Templates never hard-code a colour: they ask for a palette built from the
 * customer's brand colour (and optional second colour) and background style.
 *
 * The rules, in order of importance:
 *  1. Keep the colour the customer chose. A light brand colour stays light and gets dark text; a
 *     dark one stays dark and gets light text. We only nudge a colour when no text colour can be
 *     read on it, and then by the smallest amount that reaches the target.
 *  2. Text is always at least 4.5:1 (WCAG AA) against the WORST point of the background gradient.
 *  3. Accent colours used on white or dark surfaces are adjusted for that surface, never the
 *     other way round.
 */

export const NIGHT = "#0b0d12";
export const INK = "#14110f";
export const WHITE = "#ffffff";
export const GOLD = "#ffc83d";
/** A deeper amber for rating stars on light backgrounds where gold would disappear. */
export const AMBER = "#b45309";

export const MIN_TEXT_CONTRAST = 4.5;
export const MIN_GRAPHIC_CONTRAST = 3;

export interface Palette {
  style: BackgroundStyle;
  /** The brand colour as given (valid hex). */
  brand: string;
  /** Background gradient endpoints; equal for flat styles. */
  bgFrom: string;
  bgTo: string;
  /** Text on the background. */
  text: string;
  textMuted: string;
  /** True when the background is dark (text is light). */
  isDark: boolean;
  /** Brand colour adjusted to read on WHITE surfaces (cards, light backgrounds). */
  accent: string;
  /** Brand colour adjusted to read on DARK surfaces. */
  accentOnDark: string;
  /** Colour for rating stars that is visible on the background. */
  star: string;
  /** Two translucent decoration colours for shapes behind the content. */
  decorA: string;
  decorB: string;
  /** Initials badge: background and text colour. */
  badgeBg: string;
  badgeText: string;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Moves `color` toward `target` in small steps until it reaches `min` contrast against `against`. */
function nudge(color: string, against: string, min: number, target: string): string {
  let c = color;
  for (let i = 0; i < 20 && contrastRatio(c, against) < min; i++) c = mix(c, target, 0.06);
  return c;
}

/** Worst (lowest) contrast of `text` over the whole gradient. */
function worstContrast(text: string, from: string, to: string): number {
  return Math.min(contrastRatio(text, from), contrastRatio(text, to));
}

/**
 * Picks light or dark text for a gradient, and, only if neither reaches AA, moves BOTH gradient
 * ends toward the better text colour by the smallest amount that gets there.
 */
function settle(from: string, to: string): { from: string; to: string; text: string } {
  const light = worstContrast(WHITE, from, to);
  const dark = worstContrast(INK, from, to);
  const text = light >= dark ? WHITE : INK;
  const target = text === WHITE ? "#000000" : WHITE;
  let a = from;
  let b = to;
  for (let i = 0; i < 20 && worstContrast(text, a, b) < MIN_TEXT_CONTRAST; i++) {
    a = mix(a, target, 0.05);
    b = mix(b, target, 0.05);
  }
  return { from: a, to: b, text };
}

/** How much deeper the second gradient colour is: subtle on light colours, stronger on dark ones. */
function shadeAmount(brand: string): number {
  return 0.12 + 0.38 * (1 - Math.min(1, luminance(brand) / 0.6));
}

/** A deeper shade of `from` for the far end of the gradient, never so deep that `text` stops being readable. */
function shadeFor(from: string, text: string): string {
  let end = mix(from, "#000000", shadeAmount(from));
  for (let i = 0; i < 12 && contrastRatio(text, end) < MIN_TEXT_CONTRAST; i++) end = mix(end, from, 0.2);
  return contrastRatio(text, end) >= MIN_TEXT_CONTRAST ? end : from;
}

export interface PaletteOptions {
  style?: BackgroundStyle;
  /** Optional second colour for the gradient end (colour styles only). */
  secondary?: string;
}

export function derivePalette(brandInput: string, options: PaletteOptions = {}): Palette {
  const brand = HEX.test(brandInput) ? brandInput.toLowerCase() : "#cf3d0b";
  const style = options.style ?? "gradient";
  const secondary = options.secondary && HEX.test(options.secondary) ? options.secondary.toLowerCase() : null;

  let bgFrom: string;
  let bgTo: string;
  let text: string;

  if (style === "light") {
    // Paper tinted with the brand colour; ink with a hint of it
    bgFrom = mix(brand, WHITE, 0.94);
    bgTo = mix(brand, WHITE, 0.86);
    const tintedInk = mix(brand, "#000000", 0.82);
    text = worstContrast(tintedInk, bgFrom, bgTo) >= 7 ? tintedInk : INK;
  } else if (style === "dark") {
    // Near-black carrying the brand hue
    bgFrom = mix(brand, "#000000", 0.9);
    bgTo = mix(brand, "#000000", 0.95);
    text = "#f4f5f7";
  } else {
    // Colour styles: the brand colour IS the background
    if (secondary) {
      // The customer chose both ends: keep them, nudging only if no text colour can read on both
      const settled = settle(brand, secondary);
      bgFrom = settled.from;
      bgTo = style === "solid" ? settled.from : settled.to;
      text = settled.text;
    } else {
      // Text comes from the brand colour itself; the far end is shaded only as far as that text stays readable
      const settled = settle(brand, brand);
      bgFrom = settled.from;
      text = settled.text;
      bgTo = style === "solid" ? bgFrom : shadeFor(bgFrom, text);
    }
  }

  const isDark = luminance(text) > 0.5;
  const mid = mix(bgFrom, bgTo, 0.5);
  let muted = mix(text, mid, 0.3);
  for (let i = 0; i < 20 && worstContrast(muted, bgFrom, bgTo) < MIN_TEXT_CONTRAST; i++) muted = mix(muted, text, 0.12);

  const accent = nudge(brand, WHITE, MIN_TEXT_CONTRAST, "#000000");
  const accentOnDark = nudge(brand, NIGHT, MIN_TEXT_CONTRAST, WHITE);

  const starCandidates = [GOLD, AMBER, text];
  const visible = (c: string) => worstContrast(c, bgFrom, bgTo) >= 2.4;
  const star = starCandidates.find((c) => c === text || visible(c)) ?? text;

  return {
    style,
    brand,
    bgFrom,
    bgTo,
    text,
    textMuted: muted,
    isDark,
    accent,
    accentOnDark,
    star,
    decorA: isDark ? "rgba(255, 255, 255, 0.07)" : rgba(brand, 0.12),
    decorB: isDark ? "rgba(0, 0, 0, 0.14)" : rgba(brand, 0.07),
    badgeBg: text,
    badgeText: bgFrom,
  };
}

export interface AuroraBlob {
  color: string;
  /** Position of the blob's centre, in percent of the frame. */
  x: number;
  y: number;
  /** Diameter in layout units (multiply by u). */
  size: number;
  phase: number;
}

/**
 * The three glows of the aurora style. They are small hue shifts of the background that keep its
 * brightness (so the text contrast the palette guaranteed still holds); with a second colour, that
 * colour's readability-adjusted version is used so it cannot break the guarantee either.
 */
export function auroraBlobs(palette: Pick<Palette, "bgFrom" | "bgTo">, hasSecondary: boolean): AuroraBlob[] {
  return [
    { color: shiftHue(palette.bgFrom, -20), x: 12, y: 18, size: 1250, phase: 0 },
    { color: hasSecondary ? palette.bgTo : shiftHue(palette.bgFrom, 24), x: 82, y: 40, size: 1150, phase: 2.1 },
    { color: shiftHue(palette.bgTo, 12), x: 40, y: 88, size: 1300, phase: 4.2 },
  ];
}

/** Translucent version of the text colour, for chips and quote marks. */
export function tint(palette: Pick<Palette, "text">, alpha: number): string {
  return rgba(palette.text, alpha);
}
