import type { CSSProperties } from "react";

/** Hex mirror of `--palette-coral-600` (the light-mode `--brand`) for server code
 *  and canvas/OG rendering where CSS variables are unavailable. Keep in sync with
 *  globals.css; lib/__tests__/brand.test.ts enforces it. */
export const DEFAULT_BRAND_HEX = "#d9471b";

function luminance(hex: string): number {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** Black or white, whichever reads better on `hex`. */
export function readableOn(hex: string): "#000000" | "#ffffff" {
  return luminance(hex) > 0.4 ? "#000000" : "#ffffff";
}

/** User-chosen brand colour (collect form, widget, social) is data, not a design token.
 *  Apply it once on a wrapper, then use `bg-(--user-accent)` / `text-(--user-accent-fg)`. */
export function userAccentStyle(hex?: string | null): CSSProperties {
  const color = hex || DEFAULT_BRAND_HEX;
  return { "--user-accent": color, "--user-accent-fg": readableOn(color) } as CSSProperties;
}
