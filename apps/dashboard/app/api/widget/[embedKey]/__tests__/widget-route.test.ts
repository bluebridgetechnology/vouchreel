import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getWidgetData, OPTIONS as optionsWidgetData } from "../route";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

describe("Widget Data Public API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles OPTIONS preflight with CORS headers", async () => {
    const res = await optionsWidgetData();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });

  it("returns 404 when embed key is not found", async () => {
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const res = await getWidgetData(new Request("http://localhost/api/widget/unknown-key"), {
      params: Promise.resolve({ embedKey: "unknown-key" }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.message).toBe("Widget not found");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns widget config, active testimonials, and conversion goals with caching headers", async () => {
    const mockSpace = {
      id: "space-uuid-1",
      name: "Acme Space",
      embedKey: "emb_valid_123",
    };

    const mockConfig = {
      id: "cfg-1",
      spaceId: "space-uuid-1",
      position: "bottom-left",
      theme: {
        primaryColor: "#3b82f6",
        accentColor: "#ffffff",
        mode: "dark",
        borderRadius: 8,
      },
      triggerType: "exit-intent",
      triggerValue: {},
      pagesIncluded: ["/products/*"],
      pagesExcluded: ["/admin"],
      autoplayPreview: false,
    };

    const mockTestimonials = [
      {
        id: "testi-1",
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        platform: "youtube",
        thumbnailUrl: "https://example.com/thumb1.jpg",
        title: "Best tool ever",
        quote: "Saved us 10 hours a week!",
        customerName: "Jane Doe",
        customerCompany: "Tech Corp",
        durationSeconds: 120,
        matchRules: { mode: "all" },
      },
      {
        id: "testi-2",
        videoUrl: "https://vimeo.com/76979871",
        platform: "vimeo",
        thumbnailUrl: "https://example.com/thumb2.jpg",
        title: "Amazing experience",
        quote: "Super easy to set up.",
        customerName: "John Smith",
        customerCompany: "Startup Inc",
        durationSeconds: 45,
        matchRules: { mode: "specific", urlPatterns: ["/pricing"] },
      },
    ];

    const mockGoals = [
      {
        id: "goal-1",
        goalType: "url-match",
        goalValue: "/thank-you",
      },
    ];

    let queryCount = 0;
    (db.select as any).mockImplementation(() => {
      queryCount++;
      if (queryCount === 1) {
        // Space lookup
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockSpace]),
          }),
        };
      }
      if (queryCount === 2) {
        // Widget config lookup
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockConfig]),
          }),
        };
      }
      if (queryCount === 3) {
        // Active testimonials lookup
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockTestimonials),
            }),
          }),
        };
      }
      // Conversion goals lookup
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockGoals),
        }),
      };
    });

    const res = await getWidgetData(new Request("http://localhost/api/widget/emb_valid_123"), {
      params: Promise.resolve({ embedKey: "emb_valid_123" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Cache-Control")).toContain("public, max-age=60");

    const json = await res.json();
    expect(json.spaceId).toBe("space-uuid-1");
    expect(json.config.position).toBe("bottom-left");
    expect(json.config.theme.primaryColor).toBe("#3b82f6");
    expect(json.config.trigger.type).toBe("exit-intent");
    expect(json.config.autoplayPreview).toBe(false);
    expect(json.testimonials).toHaveLength(2);
    expect(json.testimonials[0].id).toBe("testi-1");
    expect(json.testimonials[0].customerName).toBe("Jane Doe");
    expect(json.conversionGoals).toHaveLength(1);
    expect(json.conversionGoals[0].goalValue).toBe("/thank-you");
  });
});
