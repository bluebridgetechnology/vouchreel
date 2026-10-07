/**
 * The fonts a review video can use. A short, curated list of open-licence (SIL OFL 1.1) families, not
 * uploads: the files ship with the app, so renders are identical on every machine and need no network.
 * Pure data and functions only (no Remotion/React), because the dashboard imports this in the browser.
 *
 * To add a font: add the package to this package's dependencies, add an entry here, import its three
 * weights in fonts.ts, copy the files and licence to apps/dashboard/public/video-fonts, then run
 * `npm run fonts:measure -w @vouchreel/video` and paste the numbers. Tests fail until all four are done.
 */

export type VideoFontId = "outfit" | "lora" | "nunito" | "barlow-condensed" | "jetbrains-mono" | "caveat";

export interface VideoFontInfo {
  id: VideoFontId;
  /** CSS family name, as loaded. */
  family: string;
  label: string;
  /** Short description for the picker. */
  kind: string;
  /** CSS fallback list used when a character is outside the font's Latin range. */
  fallback: string;
  /**
   * Average width of English text in this font (weight 600) divided by Outfit's, measured by
   * `npm run fonts:measure`. 1 = as wide as Outfit.
   */
  widthFactor: number;
  /** Font size multiplier that keeps a review about as long (in lines) as it is in Outfit. */
  sizeScale: number;
  /** Share of a template's `maxChars` that still fits at that size (1 = all of it). */
  maxCharsScale: number;
  /** Where the package gets its files from, for the licence test and the player. */
  package: string;
}

export const VIDEO_FONTS: VideoFontInfo[] = [
  { id: "outfit", family: "Outfit", label: "Outfit", kind: "Rounded geometric sans (default)", fallback: "'Noto Sans', 'Segoe UI', Arial, sans-serif", widthFactor: 1, sizeScale: 1, maxCharsScale: 1, package: "outfit" },
  { id: "lora", family: "Lora", label: "Lora", kind: "Warm serif", fallback: "'Noto Serif', Georgia, serif", widthFactor: 1.06, sizeScale: 0.94, maxCharsScale: 1, package: "lora" },
  { id: "nunito", family: "Nunito", label: "Nunito", kind: "Friendly rounded sans", fallback: "'Noto Sans', 'Segoe UI', Arial, sans-serif", widthFactor: 1.03, sizeScale: 0.97, maxCharsScale: 1, package: "nunito" },
  { id: "barlow-condensed", family: "Barlow Condensed", label: "Barlow Condensed", kind: "Condensed sans", fallback: "'Noto Sans', 'Segoe UI', Arial, sans-serif", widthFactor: 0.79, sizeScale: 1.27, maxCharsScale: 1, package: "barlow-condensed" },
  { id: "jetbrains-mono", family: "JetBrains Mono", label: "JetBrains Mono", kind: "Monospace", fallback: "'Noto Sans Mono', Menlo, Consolas, monospace", widthFactor: 1.32, sizeScale: 0.85, maxCharsScale: 0.85, package: "jetbrains-mono" },
  { id: "caveat", family: "Caveat", label: "Caveat", kind: "Handwriting", fallback: "'Segoe Print', 'Comic Sans MS', cursive", widthFactor: 0.76, sizeScale: 1.3, maxCharsScale: 1, package: "caveat" },
];

/** The weights every font ships with. The templates use these three. */
export const VIDEO_FONT_WEIGHTS = [400, 500, 600] as const;

export const DEFAULT_VIDEO_FONT: VideoFontId = "outfit";

export const VIDEO_FONT_IDS = VIDEO_FONTS.map((f) => f.id) as VideoFontId[];

export function isVideoFont(value: unknown): value is VideoFontId {
  return typeof value === "string" && (VIDEO_FONT_IDS as string[]).includes(value);
}

export function getVideoFont(id: string | undefined | null): VideoFontInfo {
  return VIDEO_FONTS.find((f) => f.id === id) ?? VIDEO_FONTS[0];
}

/** The file name of one weight, as served from the dashboard's /video-fonts folder. */
export const videoFontFile = (id: VideoFontId, weight: (typeof VIDEO_FONT_WEIGHTS)[number]) => `${id}-latin-${weight}-normal.woff2`;

/** CSS font-family value for a font; an unknown or missing id means the default font. */
export function fontStack(id: string | undefined | null): string {
  const font = getVideoFont(id);
  return `'${font.family}', ${font.fallback}`;
}

/**
 * Longest review (characters) a template can show in this font without trimming it. Text in a wider
 * font fills more lines, so the limit shrinks with it; Outfit (the default) keeps the template's number.
 */
export function maxCharsFor(templateMaxChars: number, id: string | undefined | null): number {
  return Math.floor(templateMaxChars * getVideoFont(id).maxCharsScale);
}
