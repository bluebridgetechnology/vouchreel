import { describe, expect, it } from "vitest";
import { auditEntryLink } from "../audit-links";
import { toCsv } from "../csv";

describe("auditEntryLink", () => {
  it("opens a user searched by id, encoded", () => {
    expect(auditEntryLink({ entityType: "user", entityId: "u 1&x" })).toEqual({ href: "/admin?tab=users&q=u%201%26x", label: "Open user" });
    expect(auditEntryLink({ entityType: "user", entityId: null })).toBeNull();
  });

  it("opens the tab that holds the other kinds of thing", () => {
    expect(auditEntryLink({ entityType: "plan", entityId: "p" })?.href).toBe("/admin?tab=plans");
    expect(auditEntryLink({ entityType: "job", entityId: "j" })?.href).toBe("/admin?tab=videos");
    expect(auditEntryLink({ entityType: "worker", entityId: "w" })?.href).toBe("/admin?tab=system");
    expect(auditEntryLink({ entityType: "setting", entityId: "payment_provider" })?.href).toBe("/admin?tab=payments");
  });

  it("opens the right moderation list for a video, and only a known kind", () => {
    expect(auditEntryLink({ entityType: "video", entityId: "v", changes: { kind: "ai" } })?.href).toBe("/admin?tab=moderation&kind=ai");
    expect(auditEntryLink({ entityType: "video", entityId: "v", changes: { kind: "review" } })?.href).toBe("/admin?tab=moderation&kind=review");
    expect(auditEntryLink({ entityType: "video", entityId: "v", changes: { kind: "x&tab=users" } })?.href).toBe("/admin?tab=moderation");
  });

  it("has no link for kinds it does not know (exports, future kinds)", () => {
    expect(auditEntryLink({ entityType: "export", entityId: null })).toBeNull();
  });
});

describe("toCsv", () => {
  it("quotes, escapes and defangs formulas, with CRLF line ends and a trailing newline", () => {
    const csv = toCsv(["a", "b"], [["x,y", 'say "hi"'], ["=1+1", null], [new Date("2026-01-02T03:04:05Z"), 7]]);
    expect(csv).toBe('a,b\r\n"x,y","say ""hi"""\r\n\'=1+1,\r\n2026-01-02T03:04:05.000Z,7\r\n');
  });
});
