// Builds the brand images the app serves from the two source files in docs/ (logo.png, icon.png):
//   public/brand/logo.png         the logo as supplied (dark wordmark, for light backgrounds)
//   public/brand/logo-dark.png    same logo with the wordmark made white (for dark backgrounds)
//   public/brand/icon.png         the mark on its own, cropped to its edges
//   app/icon.png, app/apple-icon.png   favicon and home-screen icons (square, mark centred)
// Run: node scripts/build-brand-assets.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dash = path.join(root, "apps/dashboard");
const logoSrc = path.join(root, "docs/logo.png");
const iconSrc = path.join(root, "docs/icon.png");
mkdirSync(path.join(dash, "public/brand"), { recursive: true });

// The wordmark is near-black; the mark is red. Turn the dark pixels white and keep their alpha.
async function whiteWordmark(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) {
      data[i] = data[i + 1] = data[i + 2] = 255;
    }
  }
  return sharp(data, { raw: info });
}

const logo = sharp(logoSrc).trim();
await logo.clone().png({ compressionLevel: 9 }).toFile(path.join(dash, "public/brand/logo.png"));
await (await whiteWordmark(await logo.clone().png().toBuffer())).png({ compressionLevel: 9 }).toFile(path.join(dash, "public/brand/logo-dark.png"));

const mark = await sharp(iconSrc).trim().png().toBuffer();
await sharp(mark).png({ compressionLevel: 9 }).toFile(path.join(dash, "public/brand/icon.png"));

async function square(size, pad, background) {
  const inner = size - pad * 2;
  return sharp(mark)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 });
}
await (await square(256, 12)).toFile(path.join(dash, "app/icon.png"));
await (await square(180, 22, { r: 255, g: 255, b: 255, alpha: 1 })).toFile(path.join(dash, "app/apple-icon.png"));
console.log("brand assets written");
