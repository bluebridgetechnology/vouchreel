import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOOGLE_ASPECT, TRUSTPILOT_ASPECT, markLayout } from "../components/SourceMark";

const asset = (name: string) => readFileSync(new URL(`../assets/${name}`, import.meta.url), "utf8");

/** Line endings differ between checkouts (Windows CRLF); the artwork must not. */
const fingerprint = (name: string) => createHash("sha256").update(asset(name).replace(/\r\n/g, "\n")).digest("hex");

describe("source logos", () => {
  it("are used exactly as supplied: any edit (recolouring, redrawing) fails this test", () => {
    // If a logo is replaced on purpose (for example with an official white variant), update the hash
    // together with the licence/brand-guideline check, not before.
    expect(fingerprint("google-icon.svg")).toBe("4b16f5c6b68908d895f187ff4d13a6877b779b75f77482fee1b937adac334062");
    expect(fingerprint("trustpilot-logo.svg")).toBe("4575807373c64ff217ba18c68f73d6cdc73d5d8f1b952353f9f43799eee07da0");
  });

  it("keeps each file's own proportions, so the logos are never stretched", () => {
    const viewBox = (svg: string) => svg.match(/viewBox="([\d.\s-]+)"/)![1].split(/\s+/).map(Number);
    const [, , gw, gh] = viewBox(asset("google-icon.svg"));
    const [, , tw, th] = viewBox(asset("trustpilot-logo.svg"));
    expect(GOOGLE_ASPECT).toBeCloseTo(gw / gh, 4);
    expect(TRUSTPILOT_ASPECT).toBeCloseTo(tw / th, 4);
  });

  it("are plain vector files with no scripts or external references", () => {
    for (const name of ["google-icon.svg", "trustpilot-logo.svg"]) {
      const svg = asset(name);
      expect(svg, name).not.toMatch(/<script|onload=|javascript:/i);
      expect(svg, name).not.toMatch(/href="https?:/i);
    }
  });
});

describe("markLayout", () => {
  it("puts the logo on a white chip over coloured or dark backgrounds, and directly on light ones", () => {
    expect(markLayout("google", true).chip).toBe(true);
    expect(markLayout("trustpilot", true).chip).toBe(true);
    expect(markLayout("google", false).chip).toBe(false);
    expect(markLayout("trustpilot", false).chip).toBe(false);
  });

  it("adds the source name next to the Google icon, but not next to the Trustpilot logo (it contains the name)", () => {
    expect(markLayout("google", false).label).toBe("Google Maps");
    expect(markLayout("trustpilot", false).label).toBeNull();
  });
});
