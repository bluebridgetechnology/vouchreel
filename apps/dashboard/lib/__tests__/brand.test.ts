import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND_HEX, readableOn, userAccentStyle } from "../brand";

describe("brand", () => {
  it("DEFAULT_BRAND_HEX mirrors the coral-600 token in globals.css", () => {
    const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
    expect(css).toContain("--palette-coral-600: oklch(0.57 0.19 36)");
    expect(DEFAULT_BRAND_HEX).toBe("#cf3d0b");
  });

  it("picks a readable foreground", () => {
    expect(readableOn("#ffffff")).toBe("#000000");
    expect(readableOn("#111111")).toBe("#ffffff");
  });

  it("falls back to the default brand", () => {
    expect(userAccentStyle(null)).toMatchObject({ "--user-accent": DEFAULT_BRAND_HEX });
  });
});
