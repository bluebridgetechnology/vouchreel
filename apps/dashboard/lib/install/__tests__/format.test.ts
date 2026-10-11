import { describe, expect, it } from "vitest";
import { seenHeadline, seenRow, suggestedUrl } from "../format";

const now = new Date("2026-10-09T12:00:00Z").getTime();
const entry = (host: string, minutesAgo: number, views = 10) => ({ host, lastSeen: new Date(now - minutesAgo * 60_000).toISOString(), views });

describe("install status wording", () => {
  it("says where and how long ago, for a space or one widget", () => {
    const seen = [entry("shop.acme.com", 3)];
    expect(seenHeadline(seen, "space", now)).toBe("Your widgets were last seen on shop.acme.com, 3 minutes ago.");
    expect(seenHeadline(seen, "widget", now)).toBe("This widget was last seen on shop.acme.com, 3 minutes ago.");
  });

  it("says plainly when nothing has been seen, and that it takes a minute", () => {
    expect(seenHeadline([], "widget")).toBe("This widget has not been seen on any site in the last 30 days. It can take a minute after you add the script.");
    expect(seenHeadline([], "space")).toContain("Your widgets have not been seen");
  });

  it("a row gives the site, when, and the count with the right plural", () => {
    expect(seenRow(entry("acme.com", 120, 1204), now)).toBe("acme.com · 2 hours ago · 1,204 views in 30 days");
    expect(seenRow(entry("acme.com", 5, 1), now)).toBe("acme.com · 5 minutes ago · 1 view in 30 days");
  });

  it("offers the most recent site's front page to check, or nothing", () => {
    expect(suggestedUrl([entry("shop.acme.com", 3), entry("acme.com", 90)])).toBe("https://shop.acme.com/");
    expect(suggestedUrl([])).toBe("");
  });
});
