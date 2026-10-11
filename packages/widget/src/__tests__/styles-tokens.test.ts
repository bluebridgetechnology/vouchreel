import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const layoutsDir = new URL("../layouts/", import.meta.url);
const layoutCss = readdirSync(layoutsDir)
  .filter((f) => f.endsWith(".css"))
  .map((f) => [f, readFileSync(new URL(f, layoutsDir), "utf8")] as const);

const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;

/** Remove the two token blocks, the only places colour literals may live. */
function withoutTokenBlocks(source: string): string {
  return source.replace(/\.vr-theme-root(?:\.vr-dark)? \{[^}]*\}/g, "");
}

describe("widget design tokens", () => {
  it("keeps colour literals inside the token blocks", () => {
    const rest = withoutTokenBlocks(css);
    expect(rest.match(COLOUR_LITERAL) ?? []).toEqual([]);
  });

  it.each(layoutCss)("layout %s uses tokens only, never colour literals", (_name, source) => {
    expect(source.match(COLOUR_LITERAL) ?? []).toEqual([]);
  });

  it("default primary mirrors the dashboard brand colour", () => {
    const brand = readFileSync(new URL("../../../../apps/dashboard/lib/brand.ts", import.meta.url), "utf8");
    const hex = /DEFAULT_BRAND_HEX = "(#[0-9a-fA-F]{6})"/.exec(brand)?.[1];
    expect(hex).toBeTruthy();
    expect(css).toContain(`--vr-primary: ${hex};`);
  });
});
