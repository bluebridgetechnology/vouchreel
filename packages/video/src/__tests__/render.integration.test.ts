import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { renderReviewStill } from "../render";
import { SAMPLE_PROPS } from "../sample";
import { TEMPLATES, VIDEO_FONTS, durationInFrames, maxCharsFor, validateProps } from "../registry";
import type { BackgroundStyle } from "../types";

/**
 * Real Chromium render of the palette styles. Slow (bundles the compositions), so it only runs with
 * VIDEO_RENDER_TESTS=1: `npm run test:render -w @vouchreel/video`. Set REMOTION_BROWSER_EXECUTABLE
 * when Remotion cannot download its own browser, and VIDEO_CHROMIUM_NO_SANDBOX=1 when running as root.
 */
const enabled = process.env.VIDEO_RENDER_TESTS === "1";
const dir = enabled ? mkdtempSync(path.join(os.tmpdir(), "video-render-test-")) : "";
afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe.skipIf(!enabled)("render with a theme (real Chromium)", () => {
  const styles: BackgroundStyle[] = ["aurora", "dots", "light"];
  const outputs = new Map<BackgroundStyle, Buffer>();

  for (const style of styles) {
    it(`renders a valid PNG for the ${style} style`, async () => {
      const outputPath = path.join(dir, `${style}.png`);
      await renderReviewStill({
        templateId: "stack",
        aspect: "9:16",
        props: { ...SAMPLE_PROPS.stack, brand: "#0a7d5a", theme: { style } },
        outputPath,
        frame: 60,
      });
      expect(statSync(outputPath).size).toBeGreaterThan(10_000);
      const bytes = readFileSync(outputPath);
      expect(bytes.subarray(1, 4).toString()).toBe("PNG");
      outputs.set(style, bytes);
    }, 180_000);
  }

  it("produces a different image per style", () => {
    const unique = new Set([...outputs.values()].map((b) => b.toString("base64")));
    expect(unique.size).toBe(styles.length);
  });
});

describe.skipIf(!enabled)("every font on every template (real Chromium)", () => {
  /** The longest review the template allows in that font, cut at a word. */
  const longest = (text: string, limit: number) => {
    let out = text;
    while (out.length < limit) out += ` ${text}`;
    out = out.slice(0, limit);
    return out.slice(0, out.lastIndexOf(" ")).replace(/[,;:]$/, "") + ".";
  };

  for (const template of TEMPLATES) {
    const images = new Map<string, Buffer>();
    for (const font of VIDEO_FONTS) {
      it(`${template.id} renders in ${font.id} with the longest review it allows`, async () => {
        const sample = SAMPLE_PROPS[template.id];
        const text = longest(sample.reviews[0].text, maxCharsFor(template.maxChars, font.id));
        const props = { ...sample, reviews: sample.reviews.map((r) => ({ ...r, text })), theme: { font: font.id } };
        expect(validateProps(template.id, props)).toEqual([]);
        const outputPath = path.join(dir, `${template.id}-${font.id}.png`);
        await renderReviewStill({ templateId: template.id, aspect: "16:9", props, outputPath, frame: Math.round((durationInFrames(template.id, props) / 30 - 2) * 30) });
        const bytes = readFileSync(outputPath);
        expect(bytes.subarray(1, 4).toString()).toBe("PNG");
        expect(bytes.length).toBeGreaterThan(10_000);
        images.set(font.id, bytes);
      }, 180_000);
    }
    it(`${template.id} looks different in every font`, () => {
      expect(new Set([...images.values()].map((b) => b.toString("base64"))).size).toBe(VIDEO_FONTS.length);
    });
  }
});
