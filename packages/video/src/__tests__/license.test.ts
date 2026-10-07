import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

/**
 * Remotion is free only for individuals and for-profit organisations of up to 3 employees; everyone
 * else needs a paid Company License (docs/licensing.md). Its licence says the terms change in 5.0.
 * This fails when the installed licence no longer says what we last read, so an upgrade cannot change
 * our obligations unnoticed.
 */
describe("Remotion licence", () => {
  const require = createRequire(import.meta.url);
  // "remotion/LICENSE.md" is not an exported subpath, so find the package folder through its main file
  const dir = path.resolve(path.dirname(require.resolve("remotion/version")), "../..");
  const text = readFileSync(path.join(dir, "LICENSE.md"), "utf8");

  it("still has the terms docs/licensing.md describes", () => {
    expect(text).toMatch(/a for-profit organization with up to 3 employees/);
    expect(text).toMatch(/Company License/);
    expect(text).toMatch(/remotion\.pro\/license/);
  });

  it("is still the 4.x licence this project was reviewed against", () => {
    const { version } = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as { version: string };
    expect(version.startsWith("4.")).toBe(true);
  });
});
