import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { renderReviewStill } from "../render";
import { SAMPLE_PROPS } from "../sample";
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
