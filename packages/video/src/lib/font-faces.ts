import { VIDEO_FONTS, VIDEO_FONT_WEIGHTS, videoFontFile } from "./font-catalog";

const FONT_STYLE_ID = "vouchreel-video-fonts";

/**
 * Makes every catalogue font (and Minimal's quote font) available to the page, served from `fontBaseUrl`
 * (the dashboard uses "/video-fonts"). Safe to call from several components: it adds the styles once.
 * Browser only. The render bundles its own copies (see fonts.ts).
 */
export function ensureVideoFontFaces(fontBaseUrl: string) {
  if (typeof document === "undefined" || document.getElementById(FONT_STYLE_ID)) return;
  const base = fontBaseUrl.replace(/\/$/, "");
  const style = document.createElement("style");
  style.id = FONT_STYLE_ID;
  const faces = VIDEO_FONTS.flatMap((font) =>
    VIDEO_FONT_WEIGHTS.map((weight) => `@font-face{font-family:"${font.family}";font-weight:${weight};font-display:block;src:url(${base}/${videoFontFile(font.id, weight)}) format("woff2")}`)
  );
  faces.push(`@font-face{font-family:"Playfair Display";font-style:italic;font-weight:500;font-display:block;src:url(${base}/playfair-display-latin-500-italic.woff2) format("woff2")}`);
  style.textContent = faces.join("\n");
  document.head.appendChild(style);
}
