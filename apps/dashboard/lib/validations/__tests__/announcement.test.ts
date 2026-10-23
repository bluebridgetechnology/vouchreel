import { describe, expect, it, vi } from "vitest";
import { announcementSchema, isInternalLink, isSafeAnnouncementLink } from "../announcement";
import { announcementId } from "@/lib/marketing/announcement";

// announcementId lives next to the database code; nothing here needs a connection
vi.mock("@/lib/db", () => ({ db: {} }));

const base = { enabled: true, message: "Now in beta", linkText: "Join", linkUrl: "/signup" };

describe("isSafeAnnouncementLink", () => {
  it("allows paths on this site and http(s) addresses", () => {
    for (const ok of ["/pricing", "/#faq", "/signup?plan=pro", "https://example.com/post", "http://example.com"]) {
      expect(isSafeAnnouncementLink(ok), ok).toBe(true);
    }
  });

  it("refuses script, protocol-relative, relative and malformed links", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,hi", "//evil.example", "/\\evil.example", "pricing", "mailto:a@b.co", "ftp://x.test", "https://"]) {
      expect(isSafeAnnouncementLink(bad), bad).toBe(false);
    }
  });

  it("treats only paths as internal", () => {
    expect(isInternalLink("/pricing")).toBe(true);
    expect(isInternalLink("https://example.com")).toBe(false);
  });
});

describe("announcementSchema", () => {
  it("accepts an announcement with a link and trims the text", () => {
    const parsed = announcementSchema.parse({ ...base, message: "  Now in beta  " });
    expect(parsed.message).toBe("Now in beta");
  });

  it("allows a saved but switched-off announcement with no message", () => {
    expect(announcementSchema.safeParse({ enabled: false, message: "", linkText: "", linkUrl: "" }).success).toBe(true);
  });

  it("will not switch on an empty message", () => {
    const result = announcementSchema.safeParse({ ...base, message: "   " });
    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((i) => i.path[0])).toContain("message");
  });

  it("will not accept an unsafe link, even when switched off", () => {
    const result = announcementSchema.safeParse({ ...base, enabled: false, linkUrl: "javascript:alert(1)" });
    expect(result.success).toBe(false);
  });

  it("limits the message to one line's worth", () => {
    expect(announcementSchema.safeParse({ ...base, message: "x".repeat(161) }).success).toBe(false);
    expect(announcementSchema.safeParse({ ...base, message: "x".repeat(160) }).success).toBe(true);
  });
});

describe("announcementId", () => {
  it("changes when the announcement does, so a closed one does not hide the next", () => {
    const a = announcementId(base);
    expect(announcementId({ ...base })).toBe(a);
    expect(announcementId({ ...base, message: "Something else" })).not.toBe(a);
    expect(announcementId({ ...base, linkUrl: "/pricing" })).not.toBe(a);
  });
});
