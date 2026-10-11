import { describe, expect, it } from "vitest";
import { limitHint, numbersLine, quotaLabel, widgetStatus } from "../list";

describe("widgets page wording", () => {
  it("says how many widgets there are, against the plan's allowance when it has one", () => {
    expect(quotaLabel({ current: 2, limit: 3, allowed: true })).toBe("2 of 3 widgets");
    expect(quotaLabel({ current: 1, limit: 1, allowed: false })).toBe("1 of 1 widget");
    expect(quotaLabel({ current: 5, limit: null, allowed: true })).toBe("5 widgets");
    expect(quotaLabel({ current: 1, limit: null, allowed: true })).toBe("1 widget");
  });

  it("explains the limit only once it is reached", () => {
    expect(limitHint({ current: 1, limit: 1, allowed: false })).toBe("Your plan allows 1 widget per space. Upgrade to add more.");
    expect(limitHint({ current: 3, limit: 3, allowed: false })).toBe("Your plan allows 3 widgets per space. Upgrade to add more.");
    expect(limitHint({ current: 1, limit: 3, allowed: true })).toBeNull();
    expect(limitHint({ current: 9, limit: null, allowed: true })).toBeNull();
    // After a downgrade a space can hold more than the plan allows; adding is refused, nothing is taken away
    expect(limitHint({ current: 3, limit: 1, allowed: false })).toContain("allows 1 widget");
  });

  it("a widget is Live, Off (switched off after being live), or Not live yet (never switched on)", () => {
    expect(widgetStatus({ isLive: true, publishedAt: "2026-10-01", hasDraft: false })).toEqual({ label: "Live", tone: "success", pendingChanges: false });
    expect(widgetStatus({ isLive: false, publishedAt: "2026-10-01", hasDraft: false })).toEqual({ label: "Off", tone: "neutral", pendingChanges: false });
    expect(widgetStatus({ isLive: false, publishedAt: null, hasDraft: true })).toEqual({ label: "Not live yet", tone: "info", pendingChanges: false });
  });

  it("a live widget with a saved draft has changes visitors do not see yet", () => {
    expect(widgetStatus({ isLive: true, publishedAt: null, hasDraft: true }).pendingChanges).toBe(true); // a widget from before drafts existed
    expect(widgetStatus({ isLive: false, publishedAt: "2026-10-01", hasDraft: true }).pendingChanges).toBe(false);
  });

  describe("the numbers line on a card", () => {
    it("says views, plays and the share of views that were played", () => {
      expect(numbersLine({ isLive: true }, { views: 1204, plays: 212 })).toBe("1,204 views · 212 plays · 18% played");
      expect(numbersLine({ isLive: true }, { views: 1, plays: 1 })).toBe("1 view · 1 play · 100% played");
    });

    it("never prints a share above 100% (a play can be counted from an older view) or a share of no views", () => {
      expect(numbersLine({ isLive: true }, { views: 3, plays: 5 })).toBe("3 views · 5 plays");
      expect(numbersLine({ isLive: true }, { views: 0, plays: 4 })).toBe("0 views · 4 plays");
    });

    it("a live widget that nobody saw says so; one that is off says nothing", () => {
      expect(numbersLine({ isLive: true }, undefined)).toBe("Not seen by anyone in the last 30 days");
      expect(numbersLine({ isLive: true }, { views: 0, plays: 0 })).toBe("Not seen by anyone in the last 30 days");
      expect(numbersLine({ isLive: false }, undefined)).toBeNull();
    });
  });
});
