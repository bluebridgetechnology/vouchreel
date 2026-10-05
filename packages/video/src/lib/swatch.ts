import { auroraBlobs, tint, type Palette } from "./palette";
import { mix, rgba } from "./theme";

/**
 * A small CSS approximation of a background style, for pickers in the dashboard. It is built from the
 * same palette the renders use, so the colours (and the readable text colour) always match the video.
 * Pure data: no React, no Remotion, safe in the browser.
 */
export interface Swatch {
  background: string;
  backgroundSize?: string;
  /** Text colour that is readable on this swatch. */
  color: string;
}

export function swatchFor(palette: Palette, hasSecondary = false): Swatch {
  const gradient = `linear-gradient(135deg, ${palette.bgFrom} 0%, ${palette.bgTo} 100%)`;

  switch (palette.style) {
    case "solid":
      return { background: palette.bgFrom, color: palette.text };

    case "aurora": {
      const [a, b, c] = auroraBlobs(palette, hasSecondary);
      const base = mix(palette.bgFrom, palette.bgTo, 0.5);
      return {
        background: [
          `radial-gradient(circle at ${a.x}% ${a.y}%, ${rgba(a.color, 0.9)} 0%, transparent 58%)`,
          `radial-gradient(circle at ${b.x}% ${b.y}%, ${rgba(b.color, 0.9)} 0%, transparent 58%)`,
          `radial-gradient(circle at ${c.x}% ${c.y}%, ${rgba(c.color, 0.9)} 0%, transparent 58%)`,
          base,
        ].join(", "),
        color: palette.text,
      };
    }

    case "dots":
      return {
        background: `radial-gradient(circle, ${tint(palette, 0.28)} 1.2px, transparent 1.8px), ${gradient}`,
        backgroundSize: "9px 9px, 100% 100%",
        color: palette.text,
      };

    case "dark":
      return {
        background: `radial-gradient(circle at 50% 30%, ${rgba(palette.accentOnDark, 0.5)} 0%, transparent 65%), ${gradient}`,
        color: palette.text,
      };

    case "light":
    case "gradient":
    default:
      return { background: gradient, color: palette.text };
  }
}
