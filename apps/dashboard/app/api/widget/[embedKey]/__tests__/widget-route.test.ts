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

    const createChainable = (val: any) => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          const promise = Promise.resolve(val);
          return Object.assign(promise, {
            orderBy: vi.fn().mockImplementation(() => {
              const orderPromise = Promise.resolve(val);
              return Object.assign(orderPromise, {
                limit: vi.fn().mockResolvedValue(val),
              });
            }),
            limit: vi.fn().mockResolvedValue(val),
          });
        }),
      }),
    });

    let queryCount = 0;
    (db.select as any).mockImplementation(() => {
      queryCount++;
      if (queryCount === 1) return createChainable([mockSpace]);
      if (queryCount === 2) return createChainable([mockConfig]);
      if (queryCount === 3) return createChainable(mockTestimonials);
      if (queryCount === 4) return createChainable([]); // Testimonial translations
      if (queryCount === 5) {
        // Approved reviews
        return createChainable([
          {
            id: "rev-1",
            provider: "google",
            authorName: "Alice M.",
            rating: 5,
            text: "Great experience!",
            reviewDate: new Date(),
          },
        ]);
      }
      if (queryCount === 6) return createChainable(mockGoals); // Conversion goals
      // Query 7: Active experiment lookup
      return createChainable([]);
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
    expect(json.reviews).toHaveLength(1);
    expect(json.reviews[0].authorName).toBe("Alice M.");
    expect(json.conversionGoals).toHaveLength(1);
    expect(json.conversionGoals[0].goalValue).toBe("/thank-you");
    expect(json.activeExperiment).toBeNull();
  });

  it("returns activeExperiment details when a running experiment exists", async () => {
    const mockSpace = {
      id: "space-uuid-1",
      name: "Acme Space",
      embedKey: "emb_valid_123",
    };

    const mockRunningExperiment = {
      id: "exp-1",
      name: "Test Trigger Delay vs Exit Intent",
      type: "trigger",
      variants: [
        { id: "var-control", name: "Delay 5s", config: { type: "delay", value: { seconds: 5 } } },
        { id: "var-b", name: "Exit Intent", config: { type: "exit-intent", value: {} } },
      ],
      trafficSplit: [50, 50],
    };

    let count = 0;
    (db.select as any).mockImplementation(() => {
      count++;
      if (count === 1) {
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([mockSpace]) }) };
      }
      if (count === 2) {
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
      }
      if (count === 3) {
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([]) }) }) };
      }
      if (count === 4) {
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([]) }) }) };
      }
      if (count === 5) {
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockRunningExperiment]),
            }),
          }),
        }),
      };
    });

    const res = await getWidgetData(new Request("http://localhost/api/widget/emb_valid_123"), {
      params: Promise.resolve({ embedKey: "emb_valid_123" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.activeExperiment).toBeDefined();
    expect(json.activeExperiment.id).toBe("exp-1");
    expect(json.activeExperiment.name).toBe("Test Trigger Delay vs Exit Intent");
    expect(json.activeExperiment.type).toBe("trigger");
    expect(json.activeExperiment.trafficSplit).toEqual([50, 50]);
    expect(json.activeExperiment.variants).toHaveLength(2);
  });

  it("includes cached translations for active testimonials", async () => {
    const mockSpace = {
      id: "space-uuid-trans",
      name: "Acme Translations Space",
      embedKey: "emb_trans_456",
    };

    const mockTestimonial = {
      id: "testi-trans-1",
      videoUrl: "https://example.com/video.mp4",
      platform: "mp4",
      quote: "Original quote",
      customerName: "Jane Doe",
      durationSeconds: 30,
    };

    const mockTranslation = {
      testimonialId: "testi-trans-1",
      language: "es",
      quote: "Cita traducida",
      transcript: [{ start: 0, end: 5, text: "Subtítulo" }],
    };

    let count = 0;
    (db.select as any).mockImplementation(() => {
      count++;
      if (count === 1) {
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([mockSpace]) }) };
      }
      if (count === 2) {
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
      }
      if (count === 3) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([mockTestimonial]),
            }),
          }),
        };
      }
      if (count === 4) {
        // Translation query
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockTranslation]),
          }),
        };
      }
      if (count === 5) {
        // Reviews
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        };
      }
      if (count === 6) {
        // Conversion goals
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
      }
      // Experiments
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };
    });

    const res = await getWidgetData(
      new Request("http://localhost/api/widget/emb_trans_456?lang=es"),
      { params: Promise.resolve({ embedKey: "emb_trans_456" }) }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.testimonials).toHaveLength(1);
    expect(json.testimonials[0].id).toBe("testi-trans-1");
    expect(json.testimonials[0].translations).toHaveLength(1);
    expect(json.testimonials[0].translations[0].language).toBe("es");
    expect(json.testimonials[0].translations[0].quote).toBe("Cita traducida");
  });
});
