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
