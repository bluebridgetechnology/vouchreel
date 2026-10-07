/**
 * Measures how wide each catalogue font runs compared with Outfit, using the real font files in a real
 * browser, and prints the numbers for lib/font-catalog.ts (widthFactor, sizeScale, maxCharsScale).
 *   npm run fonts:measure -w @vouchreel/video            prints the table
 *   npm run fonts:measure -w @vouchreel/video -- --check  exits 1 if the committed numbers are out of date
 * Needs a Chromium for Playwright (PLAYWRIGHT_BROWSERS_PATH is set in CI and the dev container).
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { SAMPLE_PROPS } from "../src/sample";
import { VIDEO_FONTS } from "../src/lib/font-catalog";

const require = createRequire(import.meta.url);
const WEIGHT = 600; // what the templates use for the large review text

/** Real English review text: the sample reviews plus a spread of ordinary sentences. */
const TEXT = [
  ...Object.values(SAMPLE_PROPS).flatMap((p) => p.reviews.map((r) => r.text)),
  "Friendly staff, fair prices and the job was done a day early. I would happily recommend them to anyone.",
  "We have used them three times now and every visit has been excellent. Communication was clear throughout.",
  "Quick to respond, turned up when they said they would, and left everything spotless afterwards.",
].join(" ");

const fileFor = (pkg: string) => path.join(path.dirname(require.resolve(`@fontsource/${pkg}/package.json`)), "files", `${pkg}-latin-${WEIGHT}-normal.woff2`);

const dir = mkdtempSync(path.join(os.tmpdir(), "measure-fonts-"));
const css = VIDEO_FONTS.map((f) => `@font-face{font-family:"${f.family}";font-weight:${WEIGHT};src:url("file://${fileFor(f.package)}") format("woff2")}`).join("\n");
writeFileSync(path.join(dir, "index.html"), `<!doctype html><style>${css}</style><body></body>`);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${path.join(dir, "index.html")}`);
const widths: Record<string, number> = await page.evaluate(
  async ({ families, weight, text }) => {
    const out: Record<string, number> = {};
    for (const family of families) {
      await document.fonts.load(`${weight} 100px "${family}"`, text);
      const ctx = document.createElement("canvas").getContext("2d")!;
      ctx.font = `${weight} 100px "${family}"`;
      out[family] = ctx.measureText(text).width;
    }
    return out;
  },
  { families: VIDEO_FONTS.map((f) => f.family), weight: WEIGHT, text: TEXT }
);
await browser.close();

const base = widths["Outfit"];
const round = (n: number, step: number) => Math.round(n / step) * step;
const rows = VIDEO_FONTS.map((f) => {
  const widthFactor = Math.round((widths[f.family] / base) * 100) / 100;
  // Wider fonts get smaller type and narrower ones bigger, within limits, so a review takes about the same room
  const sizeScale = Math.round(Math.min(1.3, Math.max(0.85, 1 / widthFactor)) * 100) / 100;
  // If the limits stopped the size from fully compensating, shrink the character limit by what is left
  const left = 1 / (widthFactor * sizeScale);
  const maxCharsScale = left >= 0.97 ? 1 : Math.floor(left * 20) / 20;
  return { id: f.id, widthFactor, sizeScale, maxCharsScale: Math.round(round(maxCharsScale, 0.05) * 100) / 100 };
});

const check = process.argv.includes("--check");
let stale = false;
for (const r of rows) {
  const f = VIDEO_FONTS.find((x) => x.id === r.id)!;
  const same = f.widthFactor === r.widthFactor && f.sizeScale === r.sizeScale && f.maxCharsScale === r.maxCharsScale;
  if (!same) stale = true;
  console.log(`${r.id.padEnd(18)} widthFactor: ${r.widthFactor}, sizeScale: ${r.sizeScale}, maxCharsScale: ${r.maxCharsScale}${check ? (same ? "  ok" : "  OUT OF DATE") : ""}`);
}
if (check && stale) process.exit(1);
