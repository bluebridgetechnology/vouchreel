import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildAnalyticsFilterConditions,
  computePercentageDelta,
  generateEventsCsv,
  getComparativeAnalytics,
  getConversionFunnel,
  getEventsForExport,
  getFilterOptions,
  getOverviewStats,
  getPerTestimonialStats,
  getSegmentComparison,
  getTimeSeries,
  AnalyticsFilter,
  DateRange,
} from "../queries";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

describe("Analytics Queries & Segmentation", () => {
  const mockSpaceId = "space-123";
  const mockDateRange: DateRange = {
    start: new Date("2026-01-01T00:00:00.000Z"),
    end: new Date("2026-01-31T23:59:59.999Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildAnalyticsFilterConditions", () => {
    it("returns empty array for empty or undefined filter", () => {
      expect(buildAnalyticsFilterConditions()).toEqual([]);
      expect(buildAnalyticsFilterConditions({})).toEqual([]);
    });

    it("creates conditions for all supported filter dimensions", () => {
      const filter: AnalyticsFilter = {
        testimonialId: "t-1",
        pageUrl: "https://example.com/checkout",
        deviceType: "mobile",
        trafficSource: "google.com",
        experimentId: "exp-42",
        variantIndex: 1,
      };

      const conditions = buildAnalyticsFilterConditions(filter);
      expect(conditions.length).toBe(6);
    });

    it("handles variantIndex 0 properly", () => {
      const filter: AnalyticsFilter = {
        variantIndex: 0,
      };

      const conditions = buildAnalyticsFilterConditions(filter);
      expect(conditions.length).toBe(1);
    });
  });

  describe("computePercentageDelta", () => {
    it("computes standard percentage increases and decreases", () => {
      expect(computePercentageDelta(150, 100)).toBe(50);
      expect(computePercentageDelta(80, 100)).toBe(-20);
      expect(computePercentageDelta(100, 100)).toBe(0);
    });

    it("handles zero baseline gracefully", () => {
      expect(computePercentageDelta(10, 0)).toBe(100);
      expect(computePercentageDelta(0, 0)).toBe(0);
    });
  });

  describe("generateEventsCsv", () => {
    it("formats raw events into CSV with headers and escaping", () => {
      const raw = [
        {
          timestamp: new Date("2026-01-15T12:00:00.000Z"),
          eventType: "play",
          pageUrl: "https://example.com/item,1",
          sessionId: "sess-abc",
          metadata: {
            deviceType: "mobile",
            referrer: "twitter.com",
            experimentId: "exp-1",
            variantIndex: 0,
          },
          testimonialTitle: 'Amazing, "Super" Product!',
          customerName: "Alice & Bob",
        },
      ];

      const csv = generateEventsCsv(raw);
      const lines = csv.split("\n");

      expect(lines[0]).toBe(
        "Timestamp,EventType,TestimonialTitle,CustomerName,PageURL,DeviceType,TrafficSource,SessionID,ExperimentID,VariantIndex"
      );

      // Verify escaping of quotes and commas
      expect(lines[1]).toContain('"Amazing, ""Super"" Product!"');
      expect(lines[1]).toContain('"https://example.com/item,1"');
      expect(lines[1]).toContain("mobile");
      expect(lines[1]).toContain("twitter.com");
      expect(lines[1]).toContain("exp-1");
      expect(lines[1]).toContain("0");
    });
  });

  describe("getOverviewStats", () => {
    it("fetches overview stats with default zeroes when no events found", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const res = await getOverviewStats(mockSpaceId, mockDateRange);
      expect(res).toEqual({
        impressions: 0,
        plays: 0,
        clicks: 0,
        conversions: 0,
      });
    });

    it("passes filter conditions to database query", async () => {
      const mockResult = {
        impressions: 120,
        plays: 60,
        clicks: 30,
        conversions: 10,
      };

      const whereMock = vi.fn().mockResolvedValue([mockResult]);
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: whereMock,
        }),
      });

      const filter: AnalyticsFilter = {
        deviceType: "desktop",
        trafficSource: "direct",
      };

      const res = await getOverviewStats(mockSpaceId, mockDateRange, filter);
      expect(res).toEqual(mockResult);
      expect(whereMock).toHaveBeenCalled();
    });
  });

  describe("getPerTestimonialStats", () => {
    it("returns testimonial metrics grouped by testimonial", async () => {
      const mockRows = [
        {
          testimonialId: "t-1",
          title: "Testimonial 1",
          customerName: "Jane",
          thumbnailUrl: "https://thumb.jpg",
          isActive: true,
          impressions: 50,
          plays: 25,
          clicks: 10,
          conversions: 5,
        },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockRows),
              }),
            }),
          }),
        }),
      });

      const res = await getPerTestimonialStats(mockSpaceId, mockDateRange, {
        deviceType: "mobile",
      });

      expect(res).toEqual(mockRows);
    });
  });

  describe("getTimeSeries", () => {
    it("returns time series buckets", async () => {
      const mockPoints = [
        { date: "2026-01-01", impressions: 10, plays: 5 },
        { date: "2026-01-02", impressions: 15, plays: 8 },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockPoints),
            }),
          }),
        }),
      });

      const res = await getTimeSeries(mockSpaceId, mockDateRange, "day");
      expect(res).toEqual(mockPoints);
    });
  });

  describe("getConversionFunnel", () => {
    it("computes funnel steps with conversion and drop-off percentages", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              impressions: 1000,
              plays: 500,
              clicks: 100,
              conversions: 20,
            },
          ]),
        }),
      });

      const funnel = await getConversionFunnel(mockSpaceId, mockDateRange);
      expect(funnel.length).toBe(4);

      expect(funnel[0]).toEqual({
        step: "impression",
        count: 1000,
        dropOffPercent: null,
        conversionFromPrevious: null,
      });

      expect(funnel[1]).toEqual({
        step: "play",
        count: 500,
        dropOffPercent: 50,
        conversionFromPrevious: 50,
      });

      expect(funnel[2]).toEqual({
        step: "click",
        count: 100,
        dropOffPercent: 80,
        conversionFromPrevious: 20,
      });

      expect(funnel[3]).toEqual({
        step: "convert",
        count: 20,
        dropOffPercent: 80,
        conversionFromPrevious: 20,
      });
    });
  });

  describe("getComparativeAnalytics", () => {
    it("compares two date ranges and calculates deltas", async () => {
      let callCount = 0;
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount % 2 === 1) {
              // Current range: 200 imp, 100 plays, 50 clicks, 25 conv
              return Promise.resolve([
                { impressions: 200, plays: 100, clicks: 50, conversions: 25 },
              ]);
            } else {
              // Previous range: 100 imp, 50 plays, 25 clicks, 10 conv
              return Promise.resolve([
                { impressions: 100, plays: 50, clicks: 25, conversions: 10 },
              ]);
            }
          }),
        }),
      }));

      const prevRange: DateRange = {
        start: new Date("2025-12-01T00:00:00.000Z"),
        end: new Date("2025-12-31T23:59:59.999Z"),
      };

      const result = await getComparativeAnalytics(
        mockSpaceId,
        mockDateRange,
        prevRange
      );

      expect(result.current.stats.impressions).toBe(200);
      expect(result.previous.stats.impressions).toBe(100);
      expect(result.deltas.impressions).toBe(100); // +100%
      expect(result.deltas.plays).toBe(100); // +100%
      expect(result.deltas.clicks).toBe(100); // +100%
      expect(result.deltas.conversions).toBe(150); // +150%
      expect(result.current.playRate).toBe(50);
      expect(result.previous.playRate).toBe(50);
      expect(result.deltas.playRate).toBe(0);
    });
  });

  describe("getSegmentComparison", () => {
    it("compares two segments for the same date range", async () => {
      let callCount = 0;
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount % 2 === 1) {
              // Mobile: 300 imp, 150 plays, 60 clicks, 30 conv
              return Promise.resolve([
                { impressions: 300, plays: 150, clicks: 60, conversions: 30 },
              ]);
            } else {
              // Desktop: 150 imp, 100 plays, 40 clicks, 20 conv
              return Promise.resolve([
                { impressions: 150, plays: 100, clicks: 40, conversions: 20 },
              ]);
            }
          }),
        }),
      }));

      const seg1: AnalyticsFilter = { deviceType: "mobile" };
      const seg2: AnalyticsFilter = { deviceType: "desktop" };

      const result = await getSegmentComparison(
        mockSpaceId,
        mockDateRange,
        seg1,
        seg2
      );

      expect(result.segment1.stats.impressions).toBe(300);
      expect(result.segment2.stats.impressions).toBe(150);
      expect(result.deltas.impressions).toBe(100); // Mobile had +100% impressions vs Desktop
      expect(result.segment1.playRate).toBe(50);
      expect(result.segment2.playRate).toBe(67);
    });
  });

  describe("getFilterOptions", () => {
    it("extracts unique devices, traffic sources, and URLs", async () => {
      const mockRows = [
        { deviceType: "mobile", referrer: "google.com", pageUrl: "/home" },
        { deviceType: "desktop", referrer: "direct", pageUrl: "/pricing" },
        { deviceType: "mobile", referrer: "google.com", pageUrl: "/home" },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockRows),
            }),
          }),
        }),
      });

      const options = await getFilterOptions(mockSpaceId, mockDateRange);
      expect(options.devices).toContain("mobile");
      expect(options.devices).toContain("desktop");
      expect(options.trafficSources).toContain("google.com");
      expect(options.trafficSources).toContain("direct");
      expect(options.pageUrls).toContain("/home");
      expect(options.pageUrls).toContain("/pricing");
    });
  });

  describe("getEventsForExport", () => {
    it("fetches raw events joined with testimonial metadata", async () => {
      const mockRaw = [
        {
          timestamp: new Date("2026-01-10T10:00:00Z"),
          eventType: "impression",
          pageUrl: "https://example.com",
          sessionId: "sess-1",
          metadata: { deviceType: "mobile", referrer: "direct" },
          testimonialTitle: "Great widget",
          customerName: "Sarah",
        },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockRaw),
            }),
          }),
        }),
      });

      const events = await getEventsForExport(mockSpaceId, mockDateRange, {
        deviceType: "mobile",
      });

      expect(events).toEqual(mockRaw);
    });
  });
});
