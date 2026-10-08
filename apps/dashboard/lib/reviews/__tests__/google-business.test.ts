import { describe, expect, it, vi } from "vitest";
import { GoogleApiError, fetchBusinessReviews, listBusinessLocations, reviewerOwnWords } from "../google-business";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const T = { GOOGLE_OAUTH_TEST_ORIGIN: "http://g.test" };

describe("reading the owner's business locations", () => {
  it("lists the locations of every account, building the path the reviews call needs", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith("/accounts")) return json({ accounts: [{ name: "accounts/1", accountName: "Acme" }, { name: "accounts/2" }] });
      if (url.includes("/accounts/1/locations")) return json({ locations: [{ name: "locations/10", title: "Acme Cafe", storefrontAddress: { addressLines: ["1 Main St"], locality: "Leeds", regionCode: "GB" } }] });
      return json({ locations: [{ name: "locations/20", title: "Acme Bar" }] });
    });
    const out = await listBusinessLocations("tok", fetchImpl as never, T);
    expect(out).toEqual([
      { id: "accounts/1/locations/10", title: "Acme Cafe", address: "1 Main St, Leeds, GB" },
      { id: "accounts/2/locations/20", title: "Acme Bar", address: null },
    ]);
    expect((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toMatchObject({ Authorization: "Bearer tok" });
  });

  it("follows the pages of a long list, and stops at a cap", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith("/accounts")) return json({ accounts: [{ name: "accounts/1" }] });
      n++;
      return json({ locations: [{ name: `locations/${n}`, title: `L${n}` }], nextPageToken: "more" }); // never ends
    });
    const out = await listBusinessLocations("tok", fetchImpl as never, T);
    expect(out).toHaveLength(10);
  });

  it("turns a Google error into one the owner can read", async () => {
    const fetchImpl = vi.fn(async () => json({ error: { message: "API not enabled" } }, 403));
    await expect(listBusinessLocations("tok", fetchImpl as never, T)).rejects.toThrow(GoogleApiError);
    await expect(listBusinessLocations("tok", fetchImpl as never, T)).rejects.toThrow(/API not enabled/);
  });
});

describe("reading a location's reviews", () => {
  const raw = (id: string, stars: string, comment: string) => ({
    reviewId: id,
    reviewer: { displayName: `Reviewer ${id}`, profilePhotoUrl: "https://p/x.jpg" },
    starRating: stars,
    comment,
    createTime: "2026-03-05T10:00:00Z",
  });

  it("returns every review with Google's own rating and count, across pages", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const next = new URL(url).searchParams.get("pageToken");
      return next
        ? json({ reviews: [raw("b", "FOUR", "Good.")], averageRating: 4.6, totalReviewCount: 212 })
        : json({ reviews: [raw("a", "FIVE", "Great!")], averageRating: 4.6, totalReviewCount: 212, nextPageToken: "p2" });
    });
    const out = await fetchBusinessReviews("accounts/1/locations/2", "tok", fetchImpl as never, T);
    expect(out.rating).toBe(4.6);
    expect(out.totalReviews).toBe(212);
    expect(out.reviews.map((r) => [r.providerReviewId, r.rating, r.text, r.authorName])).toEqual([
      ["google_bp_a", 5, "Great!", "Reviewer a"],
      ["google_bp_b", 4, "Good.", "Reviewer b"],
    ]);
    expect(out.reviews[0].reviewDate.toISOString()).toBe("2026-03-05T10:00:00.000Z");
    expect(String((fetchImpl.mock.calls[0] as unknown as [string])[0])).toContain("/accounts/1/locations/2/reviews");
  });

  it("keeps a rating-only review (no comment) with empty text, and skips entries it cannot use", async () => {
    const fetchImpl = vi.fn(async () =>
      json({ reviews: [{ reviewId: "x", starRating: "THREE", reviewer: { displayName: "Q" }, createTime: "2026-01-01T00:00:00Z" }, { reviewId: "y", starRating: "STAR_RATING_UNSPECIFIED" }, { starRating: "FIVE" }] })
    );
    const out = await fetchBusinessReviews("accounts/1/locations/2", "tok", fetchImpl as never, T);
    expect(out.reviews).toHaveLength(1);
    expect(out.reviews[0]).toMatchObject({ providerReviewId: "google_bp_x", rating: 3, text: "" });
  });

  it("does not use the name or photo of an anonymous reviewer", async () => {
    const fetchImpl = vi.fn(async () => json({ reviews: [{ ...raw("z", "FIVE", "Nice"), reviewer: { displayName: "Secret", profilePhotoUrl: "https://p/s.jpg", isAnonymous: true } }] }));
    const out = await fetchBusinessReviews("accounts/1/locations/2", "tok", fetchImpl as never, T);
    expect(out.reviews[0]).toMatchObject({ authorName: "A Google user", authorPhotoUrl: null });
  });

  it("stops after 20 pages if Google never stops sending a next page", async () => {
    const fetchImpl = vi.fn(async () => json({ reviews: [], nextPageToken: "again" }));
    await fetchBusinessReviews("accounts/1/locations/2", "tok", fetchImpl as never, T);
    expect(fetchImpl).toHaveBeenCalledTimes(20);
  });

  it("keeps the reviewer's own words when Google adds a translation", () => {
    expect(reviewerOwnWords("(Translated by Google) Very good service (Original) Très bon service")).toBe("Très bon service");
    expect(reviewerOwnWords("Plain review")).toBe("Plain review");
    expect(reviewerOwnWords("  spaced  ")).toBe("spaced");
    expect(reviewerOwnWords(undefined)).toBe("");
    // a review that merely mentions "(Original)" is left alone
    expect(reviewerOwnWords("The (Original) recipe is best")).toBe("The (Original) recipe is best");
  });
});
