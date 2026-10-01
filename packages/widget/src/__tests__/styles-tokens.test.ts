import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

/** Remove the two token blocks, the only places colour literals may live. */
function withoutTokenBlocks(source: string): string {
  return source.replace(/\.vr-theme-root(?:\.vr-dark)? \{[^}]*\}/g, "");
}

describe("widget design tokens", () => {
  it("keeps colour literals inside the token blocks", () => {
    const rest = withoutTokenBlocks(css);
    const literals = rest.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? [];
    expect(literals).toEqual([]);
  });

  it("default primary mirrors the dashboard brand colour", () => {
    const brand = readFileSync(new URL("../../../../apps/dashboard/lib/brand.ts", import.meta.url), "utf8");
    const hex = /DEFAULT_BRAND_HEX = "(#[0-9a-fA-F]{6})"/.exec(brand)?.[1];
    expect(hex).toBeTruthy();
    expect(css).toContain(`--vr-primary: ${hex};`);
  });
});
