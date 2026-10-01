import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAgencyOverview } from "../queries";
import { getAccessibleSpacesWithCounts } from "@/lib/auth/permissions";
import { db } from "@/lib/db";

vi.mock("@/lib/auth/permissions", () => ({
  getAccessibleSpacesWithCounts: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

describe("Agency Cockpit Queries (Sprint 14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero summary when user has no accessible spaces", async () => {
    (getAccessibleSpacesWithCounts as any).mockResolvedValue([]);

    const result = await getAgencyOverview("user-empty");
    expect(result.summary.totalSpaces).toBe(0);
    expect(result.summary.totalImpressions).toBe(0);
    expect(result.summary.overallConversionRate).toBe(0);
    expect(result.spaces).toHaveLength(0);
  });

  it("aggregates impressions, plays, and conversions across spaces", async () => {
    const mockSpaces = [
      {
        id: "space-alpha",
        name: "Alpha Client",
        ownerId: "agency-user",
        embedKey: "emb_alpha",
        createdAt: "2026-01-01T00:00:00.000Z",
        testimonialCount: 10,
        role: "owner",
        isDirectOwner: true,
      },
      {
        id: "space-beta",
        name: "Beta Client",
        ownerId: "agency-user",
        embedKey: "emb_beta",
        createdAt: "2026-02-01T00:00:00.000Z",
        testimonialCount: 4,
        role: "owner",
        isDirectOwner: true,
      },
    ];

    (getAccessibleSpacesWithCounts as any).mockResolvedValue(mockSpaces);

    let spaceQueryCount = 0;
    (db.select as any).mockImplementation(() => {
      spaceQueryCount++;
      if (spaceQueryCount === 1) {
        // Events for space-alpha
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue([
                { eventType: "impression", count: 100 },
                { eventType: "play", count: 50 },
                { eventType: "convert", count: 10 },
              ]),
            }),
          }),
        };
      }
      // Events for space-beta
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([
              { eventType: "impression", count: 200 },
              { eventType: "play", count: 40 },
              { eventType: "convert", count: 20 },
            ]),
          }),
        }),
      };
    });

    const result = await getAgencyOverview("agency-user");

    expect(result.summary.totalSpaces).toBe(2);
    expect(result.summary.totalImpressions).toBe(300);
    expect(result.summary.totalPlays).toBe(90);
    expect(result.summary.totalConversions).toBe(30);
    // 30 / 300 * 100 = 10%
    expect(result.summary.overallConversionRate).toBe(10);

    expect(result.spaces).toHaveLength(2);
    const alpha = result.spaces.find((s) => s.id === "space-alpha");
    expect(alpha?.conversionRate).toBe(10); // 10/100 * 100
  });

  it("filters spaces by search term", async () => {
    const mockSpaces = [
      {
        id: "s-1",
        name: "Stripe Integrations",
        ownerId: "user-1",
        embedKey: "emb_1",
        createdAt: "2026-01-01T00:00:00.000Z",
        testimonialCount: 5,
        role: "owner",
        isDirectOwner: true,
      },
      {
        id: "s-2",
        name: "Acme Corp",
        ownerId: "user-1",
        embedKey: "emb_2",
        createdAt: "2026-01-02T00:00:00.000Z",
        testimonialCount: 3,
        role: "owner",
        isDirectOwner: true,
      },
    ];

    (getAccessibleSpacesWithCounts as any).mockResolvedValue(mockSpaces);
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await getAgencyOverview("user-1", { search: "acme" });
    expect(result.spaces).toHaveLength(1);
    expect(result.spaces[0].name).toBe("Acme Corp");
    // Global summary still accounts for all accessible spaces
    expect(result.summary.totalSpaces).toBe(2);
  });

  it("sorts spaces by performance (conversion rate)", async () => {
    const mockSpaces = [
      {
        id: "low-perf",
        name: "Low Perf Space",
        ownerId: "user-1",
        embedKey: "emb_l",
        createdAt: "2026-01-01T00:00:00.000Z",
        testimonialCount: 2,
        role: "owner",
        isDirectOwner: true,
      },
      {
        id: "high-perf",
        name: "High Perf Space",
        ownerId: "user-1",
        embedKey: "emb_h",
        createdAt: "2026-01-02T00:00:00.000Z",
        testimonialCount: 8,
        role: "owner",
        isDirectOwner: true,
      },
    ];

    (getAccessibleSpacesWithCounts as any).mockResolvedValue(mockSpaces);

    let countCall = 0;
    (db.select as any).mockImplementation(() => {
      countCall++;
      if (countCall === 1) {
        // low perf: 100 imp, 2 conv = 2%
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue([
                { eventType: "impression", count: 100 },
                { eventType: "convert", count: 2 },
              ]),
            }),
          }),
        };
      }
      // high perf: 100 imp, 25 conv = 25%
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([
              { eventType: "impression", count: 100 },
              { eventType: "convert", count: 25 },
            ]),
          }),
        }),
      };
    });

    const resultDesc = await getAgencyOverview("user-1", {
      sortBy: "performance",
      sortOrder: "desc",
    });
    expect(resultDesc.spaces[0].id).toBe("high-perf");
    expect(resultDesc.spaces[1].id).toBe("low-perf");

    const resultAsc = await getAgencyOverview("user-1", {
      sortBy: "performance",
      sortOrder: "asc",
    });
    expect(resultAsc.spaces[0].id).toBe("low-perf");
    expect(resultAsc.spaces[1].id).toBe("high-perf");
  });
});
