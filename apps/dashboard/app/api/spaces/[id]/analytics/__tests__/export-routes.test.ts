import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getExport } from "../export/route";
import { GET as getReport } from "../report/route";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

describe("Analytics Export & Report API Routes", () => {
  const mockUserId = "user-123";
  const mockSpaceId = "space-456";
  const mockSpace = {
    id: mockSpaceId,
    name: "Acme Product Testimonials",
    ownerId: mockUserId,
    embedKey: "emb_abc123",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/spaces/[id]/analytics/export", () => {
    it("returns 401 when unauthenticated", async () => {
      (getSession as any).mockResolvedValue(null);

      const req = new Request("http://localhost/api/spaces/space-456/analytics/export");
      const res = await getExport(req, {
        params: Promise.resolve({ id: mockSpaceId }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 404 when space does not exist", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: mockUserId, email: "test@example.com" },
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const req = new Request("http://localhost/api/spaces/space-456/analytics/export");
      const res = await getExport(req, {
        params: Promise.resolve({ id: mockSpaceId }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 403 when user is not space owner", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "other-user", email: "other@example.com" },
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockSpace]),
        }),
      });

      const req = new Request("http://localhost/api/spaces/space-456/analytics/export");
      const res = await getExport(req, {
        params: Promise.resolve({ id: mockSpaceId }),
      });

      expect(res.status).toBe(403);
    });

    it("returns 400 when invalid query params are provided", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: mockUserId, email: "test@example.com" },
      });

      const req = new Request(
        "http://localhost/api/spaces/space-456/analytics/export?startDate=not-a-date"
      );
      const res = await getExport(req, {
        params: Promise.resolve({ id: mockSpaceId }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("generates CSV export with correct headers and formatted data", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: mockUserId, email: "test@example.com" },
      });

      const mockEvents = [
        {
          timestamp: new Date("2026-01-15T10:30:00.000Z"),
          eventType: "play",
          pageUrl: "https://example.com/pricing",
          sessionId: "sess_99",
          metadata: {
            deviceType: "desktop",
            referrer: "google.com",
            experimentId: "exp_10",
            variantIndex: 1,
          },
          testimonialTitle: "Amazing software!",
          customerName: "John Doe",
        },
      ];

      let selectCalls = 0;
      (db.select as any).mockImplementation(() => {
        selectCalls++;
        if (selectCalls === 1) {
          // Space query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([mockSpace]),
            }),
          };
        }
        // Events query
        return {
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockEvents),
              }),
            }),
          }),
        };
      });

      const req = new Request(
        "http://localhost/api/spaces/space-456/analytics/export?format=csv&deviceType=desktop"
      );
      const res = await getExport(req, {
        params: Promise.resolve({ id: mockSpaceId }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/csv");
      expect(res.headers.get("Content-Disposition")).toBe(
        `attachment; filename="vouchreel-analytics-${mockSpaceId}.csv"`
      );

      const csvText = await res.text();
      const lines = csvText.split("\n");

      expect(lines[0]).toBe(
        "Timestamp,EventType,TestimonialTitle,CustomerName,PageURL,DeviceType,TrafficSource,SessionID,ExperimentID,VariantIndex"
      );
      expect(lines[1]).toContain("2026-01-15T10:30:00.000Z");
      expect(lines[1]).toContain("play");
      expect(lines[1]).toContain("Amazing software!");
      expect(lines[1]).toContain("John Doe");
      expect(lines[1]).toContain("https://example.com/pricing");
      expect(lines[1]).toContain("desktop");
      expect(lines[1]).toContain("google.com");
      expect(lines[1]).toContain("sess_99");
      expect(lines[1]).toContain("exp_10");
      expect(lines[1]).toContain("1");
    });
  });

  describe("GET /api/spaces/[id]/analytics/report", () => {
    it("returns 401 when unauthenticated", async () => {
      (getSession as any).mockResolvedValue(null);

      const req = new Request("http://localhost/api/spaces/space-456/analytics/report");
      const res = await getReport(req, {
        params: Promise.resolve({ id: mockSpaceId }),
      });

      expect(res.status).toBe(401);
    });

    it("generates executive PDF report", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: mockUserId, email: "test@example.com" },
      });

      let selectCalls = 0;
      (db.select as any).mockImplementation(() => {
        selectCalls++;
        if (selectCalls === 1) {
          // Space query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([mockSpace]),
            }),
          };
        }
        if (selectCalls === 2) {
          // socialExportSettings
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          };
        }
        if (selectCalls === 3) {
          // collectionForms
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          };
        }
        if (selectCalls === 4) {
          // overview stats query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { impressions: 500, plays: 250, clicks: 100, conversions: 20 },
              ]),
            }),
          };
        }
        if (selectCalls === 5) {
          // conversion funnel query (which calls getOverviewStats)
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { impressions: 500, plays: 250, clicks: 100, conversions: 20 },
              ]),
            }),
          };
        }
        // testimonials stats query
        return {
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                groupBy: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        };
      });

      const req = new Request(
        "http://localhost/api/spaces/space-456/analytics/report?format=pdf"
      );
      const res = await getReport(req, {
        params: Promise.resolve({ id: mockSpaceId }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/pdf");
      expect(res.headers.get("Content-Disposition")).toContain(".pdf");

      const arrayBuf = await res.arrayBuffer();
      expect(arrayBuf.byteLength).toBeGreaterThan(100);

      // Verify PDF magic bytes '%PDF'
      const magic = new Uint8Array(arrayBuf.slice(0, 4));
      const magicStr = String.fromCharCode(...magic);
      expect(magicStr).toBe("%PDF");
    });

    it("generates executive HTML report when format=html", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: mockUserId, email: "test@example.com" },
      });

      let selectCalls = 0;
      (db.select as any).mockImplementation(() => {
        selectCalls++;
        if (selectCalls === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([mockSpace]),
            }),
          };
        }
        if (selectCalls === 2) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { logoUrl: "https://agency.com/logo.png", brandColor: "#10b981" },
              ]),
            }),
          };
        }
        if (selectCalls === 3) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          };
        }
        if (selectCalls === 4 || selectCalls === 5) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { impressions: 100, plays: 50, clicks: 20, conversions: 5 },
              ]),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                groupBy: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        };
      });

      const req = new Request(
        "http://localhost/api/spaces/space-456/analytics/report?format=html&brandName=AgencyPro"
      );
      const res = await getReport(req, {
        params: Promise.resolve({ id: mockSpaceId }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/html");

      const html = await res.text();
      expect(html).toContain("AgencyPro");
      expect(html).toContain("Key Performance Indicators");
      // White labeling guarantee: VouchReel branding should NOT appear in white-labeled report
      expect(html).not.toContain("Generated by VouchReel");
    });
  });
});
