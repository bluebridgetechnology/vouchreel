import { describe, expect, it } from "vitest";
import { linkDomain, ownReviewSchema } from "../own";

const ok = { name: "Priya N.", text: "They fixed our books in a week." };

describe("owner-supplied review input", () => {
  it("accepts a name and a review, trims them, and the link is optional", () => {
    const r = ownReviewSchema.parse({ name: "  Priya N. ", text: "  They fixed our books in a week.  " });
    expect(r).toEqual({ name: "Priya N.", text: "They fixed our books in a week.", link: undefined });
    expect(ownReviewSchema.parse({ ...ok, link: "" }).link).toBeUndefined();
  });

  it("rejects an empty name, a too-short or too-long review", () => {
    expect(ownReviewSchema.safeParse({ ...ok, name: " " }).success).toBe(false);
    expect(ownReviewSchema.safeParse({ ...ok, text: "Great!" }).success).toBe(false);
    expect(ownReviewSchema.safeParse({ ...ok, text: "x".repeat(1001) }).success).toBe(false);
    expect(ownReviewSchema.safeParse({ ...ok, name: "n".repeat(81) }).success).toBe(false);
  });

  it("keeps only https links with a real host", () => {
    expect(ownReviewSchema.safeParse({ ...ok, link: "https://example.com/reviews" }).success).toBe(true);
    for (const bad of ["http://example.com", "javascript:alert(1)", "example.com", "https://localhost", "ftp://example.com/x", "data:text/html,hi"]) {
      expect(ownReviewSchema.safeParse({ ...ok, link: bad }).success, bad).toBe(false);
    }
  });

  it("shows a link as its bare domain", () => {
    expect(linkDomain("https://www.priyas-bakery.example/testimonials/42?x=1")).toBe("priyas-bakery.example");
    expect(linkDomain("https://sub.example.com/a")).toBe("sub.example.com");
    expect(linkDomain(null)).toBeUndefined();
    expect(linkDomain("not a url")).toBeUndefined();
  });
});
