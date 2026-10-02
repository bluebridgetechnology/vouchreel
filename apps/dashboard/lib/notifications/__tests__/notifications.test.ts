import { describe, expect, it } from "vitest";
import { NOTIFICATION_CATALOG, NOTIFICATION_TYPES, isNotificationType, resolvePrefs } from "../catalog";
import { renderEmail } from "@/lib/email/templates";
import { timeAgo } from "@/lib/time-ago";

describe("notification catalog", () => {
  it("every type has a label, description and at least one default channel", () => {
    for (const type of NOTIFICATION_TYPES) {
      const entry = NOTIFICATION_CATALOG[type];
      expect(entry.label.length).toBeGreaterThan(3);
      expect(entry.description.length).toBeGreaterThan(10);
      expect(entry.defaults.inApp || entry.defaults.email).toBe(true);
    }
  });

  it("resolves overrides on top of defaults", () => {
    expect(resolvePrefs("submission.received")).toEqual({ inApp: true, email: true });
    expect(resolvePrefs("submission.received", { email: false })).toEqual({ inApp: true, email: false });
    expect(resolvePrefs("social_export.completed", { email: true })).toEqual({ inApp: true, email: true });
  });

  it("validates type names", () => {
    expect(isNotificationType("webhook.failing")).toBe(true);
    expect(isNotificationType("nope")).toBe(false);
  });
});

describe("email rendering", () => {
  it("escapes user content in html and keeps a plain-text alternative", () => {
    const { html, text } = renderEmail({
      title: "New testimonial from <script>alert(1)</script>",
      body: "A & B",
      cta: { label: "Open", url: "https://app.test/spaces/1" },
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
    expect(html).toContain('href="https://app.test/spaces/1"');
    expect(text).toContain("Open: https://app.test/spaces/1");
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-10-02T12:00:00Z").getTime();
  it("formats relative times", () => {
    expect(timeAgo(new Date(now - 20_000), now)).toBe("just now");
    expect(timeAgo(new Date(now - 5 * 60_000), now)).toBe("5 minutes ago");
    expect(timeAgo(new Date(now - 3 * 3600_000), now)).toBe("3 hours ago");
    expect(timeAgo(new Date(now - 2 * 86400_000), now)).toBe("2 days ago");
  });
});
