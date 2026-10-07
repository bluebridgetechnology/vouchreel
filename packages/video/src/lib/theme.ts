import { fontStack } from "./font-catalog";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
export const rgbToHex = ({ r, g, b }: Rgb) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

/** Mix `a` toward `b` by `t` (0 = a, 1 = b). */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}

export const darken = (hex: string, t: number) => mix(hex, "#000000", t);
export const lighten = (hex: string, t: number) => mix(hex, "#ffffff", t);

export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Text colour that stays readable on `background`: white unless the background is light. */
export function readableOn(background: string): "#ffffff" | "#14110f" {
  return contrastRatio(background, "#ffffff") >= contrastRatio(background, "#14110f") ? "#ffffff" : "#14110f";
}

/**
 * A brand colour that is safe to use as a background for white text: very light brand colours
 * are darkened until white text reaches 4.5:1 contrast.
 */
export function brandForWhiteText(brand: string): string {
  let color = brand;
  for (let i = 0; i < 12 && contrastRatio(color, "#ffffff") < 4.5; i++) color = darken(color, 0.12);
  return color;
}

export const GOLD = "#ffc83d";
export const FONT_SANS = "'Outfit', 'Noto Sans', 'Segoe UI', Arial, sans-serif";
export const FONT_SERIF = "'Playfair Display', 'Noto Serif', Georgia, serif";

/** Font for a template's text: the customer's choice, else the default (Outfit). */
export const bodyFont = (font?: string | null): string => (font ? fontStack(font) : FONT_SANS);

/**
 * Font for Minimal's large quote. Left alone it is Playfair Display italic; a chosen font is used as it
 * is (upright: only the regular weights ship, and a made-up slant looks wrong).
 */
export const quoteFont = (font?: string | null): { fontFamily: string; fontStyle: "italic" | "normal" } =>
  font ? { fontFamily: fontStack(font), fontStyle: "normal" } : { fontFamily: FONT_SERIF, fontStyle: "italic" };

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
}

/**
 * Rotates the hue by `degrees` while keeping the colour's brightness (WCAG luminance), so a text
 * colour that is readable on the original stays readable on the shifted one. Different hues of equal
 * HSL lightness differ a lot in brightness, so lightness is searched until the luminance matches.
 */
export function shiftHue(hex: string, degrees: number): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  // Greys have no hue to rotate
  if (hsl.s < 0.05) return hex;
  const h = (hsl.h + degrees + 360) % 360;
  const target = luminance(hex);
  let lo = 0;
  let hi = 1;
  let best = hslToHex({ h, s: hsl.s, l: hsl.l });
  for (let i = 0; i < 24; i++) {
    const l = (lo + hi) / 2;
    const candidate = hslToHex({ h, s: hsl.s, l });
    best = candidate;
    if (luminance(candidate) < target) lo = l;
    else hi = l;
  }
  return best;
}
