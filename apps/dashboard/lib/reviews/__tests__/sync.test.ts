import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncReviewSource, MIN_SYNC_INTERVAL_MS } from "../sync";
import { db } from "@/lib/db";
import { fetchGoogleReviews } from "../google";
import { fetchTrustpilotReviews, fetchTrustpilotStats } from "../trustpilot";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../crypto", () => ({
  decryptCredentials: vi.fn((data) => data || {}),
}));

vi.mock("../google", () => ({
  fetchGoogleReviews: vi.fn(),
}));

vi.mock("../trustpilot", () => ({
  fetchTrustpilotReviews: vi.fn(),
  fetchTrustpilotStats: vi.fn(),
}));

describe("syncReviewSource Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws error if review source not found", async () => {
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    await expect(syncReviewSource("non-existent-id")).rejects.toThrow(
      "Review source non-existent-id not found."
    );
  });

  it("throws error if review source is inactive", async () => {
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            id: "src-inactive",
            spaceId: "space-1",
            provider: "google",
            isActive: false,
          },
        ]),
      }),
    });

    await expect(syncReviewSource("src-inactive")).rejects.toThrow(
      "Review source src-inactive is inactive."
    );
  });

  it("enforces 5-minute rate limit cooldown unless force is true", async () => {
    const recentSync = new Date(Date.now() - 60 * 1000); // 1 minute ago
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            id: "src-1",
            spaceId: "space-1",
            provider: "google",
            providerBusinessId: "place-123",
            isActive: true,
            lastSyncAt: recentSync,
            credentials: { apiKey: "key-123" },
          },
        ]),
      }),
    });

    await expect(syncReviewSource("src-1")).rejects.toThrow("Rate limit cooldown");
  });

  it("successfully syncs Google reviews with upsert behavior", async () => {
    const mockSource = {
      id: "src-google",
      spaceId: "space-1",
      provider: "google",
      providerBusinessId: "ChIJ_test_place",
      isActive: true,
      lastSyncAt: null,
      credentials: { apiKey: "google-key" },
    };

    // First select: fetch review source
    // Subsequent selects: check if reviews exist (review 1 exists, review 2 is new)
    let selectCallCount = 0;
    (db.select as any).mockImplementation((fields?: any) => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(async () => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return [mockSource];
          } else if (selectCallCount === 2) {
            // Check review 1 -> exists
            return [{ id: "existing-rev-1" }];
          } else {
            // Check review 2 -> new
            return [];
          }
        }),
      }),
    }));

    (fetchGoogleReviews as any).mockResolvedValue({
      reviews: [
        {
          providerReviewId: "google-rev-1",
          authorName: "John Doe",
          authorPhotoUrl: "https://photo1.jpg",
          rating: 5,
          text: "Updated text",
          reviewDate: new Date("2026-01-01"),
        },
        {
          providerReviewId: "google-rev-2",
          authorName: "Jane Smith",
          authorPhotoUrl: "https://photo2.jpg",
          rating: 4,
          text: "Great experience",
          reviewDate: new Date("2026-01-02"),
        },
      ],
    });

    const updateWhereMock = vi.fn().mockResolvedValue({});
    const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock });
    (db.update as any).mockReturnValue({ set: updateSetMock });

    const insertValuesMock = vi.fn().mockResolvedValue({});
    (db.insert as any).mockReturnValue({ values: insertValuesMock });

    const result = await syncReviewSource("src-google");

    expect(result.sourceId).toBe("src-google");
    expect(result.provider).toBe("google");
    expect(result.totalFetched).toBe(2);
    expect(result.updatedCount).toBe(1);
    expect(result.importedCount).toBe(1);

    expect(fetchGoogleReviews).toHaveBeenCalledWith({
      placeId: "ChIJ_test_place",
      apiKey: "google-key",
    });
    expect(insertValuesMock).toHaveBeenCalledTimes(1);
    // update is called for the existing review + for lastSyncAt on reviewSources
    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it("successfully syncs Trustpilot reviews", async () => {
    const mockSource = {
      id: "src-tp",
      spaceId: "space-1",
      provider: "trustpilot",
      providerBusinessId: "tp-unit-123",
      isActive: true,
      lastSyncAt: null,
      credentials: { apiKey: "tp-key" },
    };

    let selectCallCount = 0;
    (db.select as any).mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(async () => {
          selectCallCount++;
          if (selectCallCount === 1) return [mockSource];
          return []; // none existing
        }),
      }),
    }));

    (fetchTrustpilotReviews as any).mockResolvedValue({
      reviews: [
        {
          providerReviewId: "tp-rev-1",
          authorName: "Alice",
          rating: 5,
          text: "Trustpilot review text",
          reviewDate: new Date("2026-02-01"),
        },
      ],
    });

    (db.insert as any).mockReturnValue({
      values: vi.fn().mockResolvedValue({}),
    });
    (db.update as any).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }),
    });

    const result = await syncReviewSource("src-tp");

    expect(result.provider).toBe("trustpilot");
    expect(result.importedCount).toBe(1);
    expect(result.updatedCount).toBe(0);
    expect(fetchTrustpilotReviews).toHaveBeenCalledWith({
      businessUnitId: "tp-unit-123",
      apiKey: "tp-key",
      perPage: 50,
    });
  });

  describe("provider rating totals", () => {
    function setup(provider: "google" | "trustpilot") {
      const source = {
        id: "src-x",
        spaceId: "space-1",
        provider,
        providerBusinessId: "biz-1",
        isActive: true,
        lastSyncAt: null,
        credentials: { apiKey: "k" },
      };
      let n = 0;
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockImplementation(async () => (++n === 1 ? [source] : [])) }),
      }));
      (db.insert as any).mockReturnValue({ values: vi.fn().mockResolvedValue({}) });
      const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) });
      (db.update as any).mockReturnValue({ set });
      return set;
    }

    it("stores the Google place rating and total on the source", async () => {
      const set = setup("google");
      (fetchGoogleReviews as any).mockResolvedValue({ rating: 4.8, totalReviews: 213, reviews: [] });
      await syncReviewSource("src-x");
      expect(set).toHaveBeenCalledWith(expect.objectContaining({ ratingAverage: 4.8, ratingTotal: 213 }));
    });

    it("stores Trustpilot stats when the extra call returns them", async () => {
      const set = setup("trustpilot");
      (fetchTrustpilotReviews as any).mockResolvedValue({ reviews: [] });
      (fetchTrustpilotStats as any).mockResolvedValue({ rating: 4.6, total: 1200 });
      await syncReviewSource("src-x");
      expect(set).toHaveBeenCalledWith(expect.objectContaining({ ratingAverage: 4.6, ratingTotal: 1200 }));
    });

    it("never fails the sync, or overwrites stored stats, when stats are unavailable", async () => {
      const set = setup("trustpilot");
      (fetchTrustpilotReviews as any).mockResolvedValue({ reviews: [] });
      (fetchTrustpilotStats as any).mockRejectedValue(new Error("boom"));
      await expect(syncReviewSource("src-x")).resolves.toMatchObject({ provider: "trustpilot" });
      const lastSetArg = set.mock.calls.at(-1)![0];
      expect(lastSetArg).not.toHaveProperty("ratingAverage");
      expect(lastSetArg).not.toHaveProperty("ratingTotal");
    });

    it("ignores a Google response without a usable total", async () => {
      const set = setup("google");
      (fetchGoogleReviews as any).mockResolvedValue({ rating: 4.8, totalReviews: 0, reviews: [] });
      await syncReviewSource("src-x");
      expect(set.mock.calls.at(-1)![0]).not.toHaveProperty("ratingAverage");
    });
  });
});
