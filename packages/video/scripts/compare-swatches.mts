/**
 * How close the style swatches in the brand-kit picker are to the real renders.
 *
 *   1. npm run preview -w @vouchreel/video -- --template=stack --aspect=9:16 --times=0.1 --style=all
 *      (set REMOTION_BROWSER_EXECUTABLE to a chrome-headless-shell if Remotion cannot download its own)
 *   2. npm run swatches:compare -w @vouchreel/video
 *
 * It draws each swatch and takes the real frame at the same size, and prints the average colour
 * distance (0 to 441) over the cells along the edge of the picture. The middle is skipped because the
 * cards sit there, so even a plain solid background reads about 12. Last measured 2026-10-07: 8 to 17
 * for every style (under 4%).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { derivePalette } from "../src/lib/palette";
import { swatchFor } from "../src/lib/swatch";
import { SAMPLE_PROPS } from "../src/sample";

const styles = ["solid", "gradient", "light", "dark", "aurora", "dots"] as const;
const brand = SAMPLE_PROPS.stack.brand;
const W = 270, H = 480, GX = 6, GY = 10;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
// Mean colour of each cell of a GXxGY grid, for an image or a div
async function grid(html: string): Promise<number[][]> {
  await page.setContent(`<body style="margin:0">${html}</body>`);
  await page.waitForTimeout(150);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } });
  await page.setContent(`<body style="margin:0"><canvas id=c width=${W} height=${H}></canvas></body>`);
  return page.evaluate(async ({ b64, W, H, GX, GY }) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.getElementById("c") as HTMLCanvasElement;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, W, H);
    const out: number[][] = [];
    for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
      const d = ctx.getImageData((gx * W) / GX, (gy * H) / GY, W / GX, H / GY).data;
      let r = 0, g = 0, bl = 0, n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; bl += d[i + 2]; }
      out.push([r / n, g / n, bl / n]);
    }
    return out;
  }, { b64: png.toString("base64"), W, H, GX, GY });
}
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
for (const style of styles) {
  const palette = derivePalette(brand, { style });
  const sw = swatchFor(palette, false);
  const swGrid = await grid(`<div style="width:${W}px;height:${H}px;background:${sw.background};${sw.backgroundSize ? `background-size:${sw.backgroundSize};` : ""}"></div>`);
  const frame = readFileSync(path.resolve(import.meta.dirname, `../out/stack-9x16-${style}-t0.1.png`)).toString("base64");
  const frGrid = await grid(`<img src="data:image/png;base64,${frame}" style="width:${W}px;height:${H}px;display:block">`);
  // Outer ring only: the cards cover the middle of the frame
  const ring = swGrid.map((_, i) => i).filter((i) => { const gx = i % GX, gy = Math.floor(i / GX); return gx === 0 || gx === GX - 1 || gy === 0 || gy === GY - 1; });
  const ds = ring.map((i) => dist(swGrid[i], frGrid[i]));
  const mean = ds.reduce((a, b) => a + b, 0) / ds.length;
  console.log(style.padEnd(9), "mean RGB distance", mean.toFixed(1), "max", Math.max(...ds).toFixed(1));
}
await browser.close();
