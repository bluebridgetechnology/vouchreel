/**
 * Typography for the embedded widget: use the host site's font, optionally a named font the site
 * already loads, and optionally the site's text colour (only when it stays readable).
 *
 * The widget lives in a shadow root with `all: initial`, so nothing is inherited unless we ask.
 * It never loads fonts itself (no third-party font requests on customer sites).
 */

export type FontMode = "default" | "inherit" | "custom";

/** Same stack as the :host rule in styles.css; custom fonts fall back to it. */
export const FALLBACK_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"';

const GENERIC = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace"]);
const NAME = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/;
const MAX_NAMES = 4;

/**
 * Turns user input into a safe CSS font-family list, or null when it is not acceptable. The value
 * ends up in a style attribute on other people's sites, so only plain family names (optionally
 * quoted) and generic keywords pass: no url(), braces, semicolons, backslashes or comments.
 */
export function sanitizeFontFamily(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const parts = raw.split(",").map((p) => p.trim());
  if (parts.length === 0 || parts.length > MAX_NAMES || parts.some((p) => !p)) return null;

  const out: string[] = [];
  for (const part of parts) {
    const unquoted = /^(["'])(.*)\1$/.exec(part)?.[2] ?? part;
    if (GENERIC.has(unquoted.toLowerCase())) {
      out.push(unquoted.toLowerCase());
    } else if (NAME.test(unquoted)) {
      out.push(`"${unquoted}"`);
    } else {
      return null;
    }
  }
  return out.join(", ");
}

/** The inline `font-family` for the host element, or null to keep the default stack. */
export function fontFamilyFor(mode: unknown, family: unknown): string | null {
  if (mode === "inherit") return "inherit";
  if (mode === "custom") {
    const safe = sanitizeFontFamily(family);
    return safe ? `${safe}, ${FALLBACK_STACK}` : null;
  }
  return null;
}

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Parses the colour formats browsers report: rgb()/rgba() (comma or space syntax) and #rgb/#rrggbb. */
export function parseCssColor(value: string): Rgba | null {
  const v = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const fn = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(v);
  if (!fn) return null;
  const [r, g, b] = [fn[1], fn[2], fn[3]].map(Number);
  let a = 1;
  if (fn[4] !== undefined) a = fn[4].endsWith("%") ? parseFloat(fn[4]) / 100 : parseFloat(fn[4]);
  if ([r, g, b, a].some((n) => Number.isNaN(n)) || r > 255 || g > 255 || b > 255 || a < 0 || a > 1) return null;
  return { r, g, b, a };
}

function luminance({ r, g, b }: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The site's text colour as an opaque rgb() string, if it is readable on the widget's background
 * (WCAG AA, 4.5:1). Otherwise null, and the widget keeps its own text colour. This is what stops a
 * light-on-dark site from producing white text on the widget's white card.
 */
export function readableInheritedColor(siteColor: string, widgetBackground: string, minContrast = 4.5): string | null {
  const text = parseCssColor(siteColor);
  const bg = parseCssColor(widgetBackground);
  if (!text || !bg || text.a < 0.99 || bg.a < 0.99) return null;
  return contrastRatio(text, bg) >= minContrast ? `rgb(${text.r}, ${text.g}, ${text.b})` : null;
}
