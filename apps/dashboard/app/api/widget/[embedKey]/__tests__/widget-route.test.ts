import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getWidgetData, OPTIONS as optionsWidgetData } from "../route";
import { db } from "@/lib/db";
import { DEFAULT_WIDGET_THEME } from "@/lib/validations/widget-config";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

// The brand kit has its own lookup; mocking it keeps the numbered db.select sequence below stable
const brandKit = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock("@/lib/brand-kit/service", async () => {
  const theme = await import("@/lib/brand-kit/theme");
  return {
    applyBrandKitToTheme: theme.applyBrandKitToTheme,
    getBrandKit: vi.fn(async () => brandKit.current),
    toValues: (kit: Record<string, unknown>) => kit,
  };
});

// Made videos have their own lookup (and tests in lib/widget-videos); mocked for the same reason
const madeVideos = vi.hoisted(() => ({ current: [] as Record<string, unknown>[] }));
vi.mock("@/lib/widget-videos", () => ({ listWidgetVideos: vi.fn(async () => madeVideos.current) }));

// The widgets (rows of widget_configs) come from the widget service, so they are not one of the numbered selects below
const widgets = vi.hoisted(() => ({ current: [] as Record<string, unknown>[] }));
vi.mock("@/lib/widgets/service", () => ({
  getLiveWidgets: vi.fn(async () => widgets.current.filter((w) => w.isLive !== false)),
  listWidgets: vi.fn(async () => widgets.current),
}));

describe("Widget Data Public API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    widgets.current = [];
    brandKit.current = null;
    madeVideos.current = [];
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

    widgets.current = [mockConfig];
    let queryCount = 0;
    (db.select as any).mockImplementation(() => {
      queryCount++;
      if (queryCount === 1) return createChainable([mockSpace]);
      if (queryCount === 2) return createChainable(mockTestimonials);
      if (queryCount === 3) return createChainable([]); // Testimonial translations
      if (queryCount === 4) {
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
      if (queryCount === 5) return createChainable(mockGoals); // Conversion goals
      // Query 6: Active experiment lookup
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
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([]) }) }) };
      }
      if (count === 3) {
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([]) }) }) };
      }
      if (count === 4) {
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
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([mockTestimonial]),
            }),
          }),
        };
      }
      if (count === 3) {
        // Translation query
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockTranslation]),
          }),
        };
      }
      if (count === 4) {
        // Reviews
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        };
      }
      if (count === 5) {
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

  describe("brand kit", () => {
    const space = { id: "space-uuid-1", name: "Acme", embedKey: "emb_valid_123" };
    const config = {
      id: "cfg-1",
      spaceId: "space-uuid-1",
      position: "bottom-right",
      theme: { primaryColor: "#3b82f6", accentColor: "#ffffff", mode: "dark", borderRadius: 8 },
      triggerType: "delay",
      triggerValue: { seconds: 3 },
      pagesIncluded: [],
      pagesExcluded: [],
      autoplayPreview: false,
    };

    function mockQueries() {
      const chain = (val: unknown[]) => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() =>
            Object.assign(Promise.resolve(val), {
              orderBy: vi.fn().mockImplementation(() => Object.assign(Promise.resolve(val), { limit: vi.fn().mockResolvedValue(val) })),
              limit: vi.fn().mockResolvedValue(val),
            })
          ),
        }),
      });
      widgets.current = [config];
      let n = 0;
      (db.select as any).mockImplementation(() => {
        n++;
        if (n === 1) return chain([space]);
        return chain([]);
      });
    }

    const request = () =>
      getWidgetData(new Request("http://localhost/api/widget/emb_valid_123"), { params: Promise.resolve({ embedKey: "emb_valid_123" }) });

    it("leaves the owner's theme as it is when the space has no brand kit, with defaults for options never set", async () => {
      mockQueries();
      const json = await (await request()).json();
      // (a dark widget whose brand colour is too faint to read as text also gets a readable twin for text)
      const { primaryText, ...rest } = json.config.theme;
      expect(rest).toEqual({ ...DEFAULT_WIDGET_THEME, ...config.theme });
      expect(primaryText === undefined || /^#[0-9a-f]{6}$/.test(primaryText)).toBe(true);
      expect(json.config.theme).not.toHaveProperty("fontMode");
    });

    it("applies the kit's colours, radius and typography, keeping the widget's own light/dark mode", async () => {
      brandKit.current = { primaryColor: "#112233", accentColor: null, borderRadius: 4, fontMode: "custom", fontFamily: "Poppins", inheritTextColor: true };
      mockQueries();
      const json = await (await request()).json();
      expect(json.config.theme).toMatchObject({
        primaryColor: "#112233",
        accentColor: "#ffffff", // the kit has no accent, so the widget's stays
        mode: "dark", // mode is widget-specific
        borderRadius: 4,
        fontMode: "custom",
        fontFamily: "Poppins",
        inheritTextColor: true,
      });
    });

    it("does not send a font name unless the mode is custom", async () => {
      brandKit.current = { primaryColor: "#112233", accentColor: null, borderRadius: null, fontMode: "inherit", fontFamily: "Poppins", inheritTextColor: false };
      mockQueries();
      const json = await (await request()).json();
      expect(json.config.theme.fontMode).toBe("inherit");
      expect(json.config.theme).not.toHaveProperty("fontFamily");
      expect(json.config.theme.borderRadius).toBe(8); // kit radius unset, widget's stays
    });
  });

  describe("videos made from reviews or by AI", () => {
    const space = { id: "space-uuid-1", name: "Acme Space", ownerId: "owner-1", embedKey: "emb_valid_123" };
    const made = {
      id: "rv-1",
      videoUrl: "https://cdn.test/review-videos/space/rv-1.mp4",
      platform: "mp4",
      thumbnailUrl: null,
      title: null,
      quote: "Great experience!",
      customerName: "Alice M.",
      customerCompany: null,
      durationSeconds: 12,
      generated: "review",
      badge: "⭐ Review video",
    };

    function setup() {
      const chain = (val: unknown) => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            const promise = Promise.resolve(val);
            return Object.assign(promise, {
              orderBy: vi.fn().mockImplementation(() => Object.assign(Promise.resolve(val), { limit: vi.fn().mockResolvedValue(val) })),
              limit: vi.fn().mockResolvedValue(val),
            });
          }),
        }),
      });
      let n = 0;
      (db.select as any).mockImplementation(() => chain(++n === 1 ? [space] : []));
    }
    const get = () => getWidgetData(new Request("http://localhost/api/widget/emb_valid_123"), { params: Promise.resolve({ embedKey: "emb_valid_123" }) });

    it("adds them after the testimonials, in the shape the widget already plays, and caches that response for less at the CDN", async () => {
      setup();
      madeVideos.current = [made];
      const res = await get();
      const json = await res.json();
      expect(json.testimonials).toEqual([{ ...made, translations: [] }]);
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=60, s-maxage=60");
    });

    it("leaves the response and its five-minute cache as they were when there are none", async () => {
      setup();
      const res = await get();
      expect((await res.json()).testimonials).toEqual([]);
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=60, s-maxage=300");
    });
  });

  describe("several widgets per space", () => {
    const space = { id: "space-uuid-1", name: "Acme", ownerId: "owner-1", embedKey: "emb_valid_123" };
    const widget = (id: string, over: Record<string, unknown> = {}) => ({
      id,
      spaceId: "space-uuid-1",
      template: "floating-card",
      position: "bottom-right",
      theme: { primaryColor: "#3b82f6", accentColor: "#ffffff", mode: "light", borderRadius: 8 },
      triggerType: "delay",
      triggerValue: { seconds: 3 },
      pagesIncluded: ["*"],
      pagesExcluded: [],
      autoplayPreview: true,
      isLive: true,
      ...over,
    });
    const respond = async () => {
      const chain = (val: unknown) => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() =>
            Object.assign(Promise.resolve(val), {
              orderBy: vi.fn().mockImplementation(() => Object.assign(Promise.resolve(val), { limit: vi.fn().mockResolvedValue(val) })),
              limit: vi.fn().mockResolvedValue(val),
            })
          ),
        }),
      });
      let n = 0;
      (db.select as any).mockImplementation(() => chain(++n === 1 ? [space] : []));
      return getWidgetData(new Request("http://localhost/api/widget/emb_valid_123"), { params: Promise.resolve({ embedKey: "emb_valid_123" }) });
    };

    it("one live widget: the response is the one it always was, with no list added", async () => {
      widgets.current = [widget("w1", { template: "carousel" })];
      const json = await (await respond()).json();
      expect(json.config).toMatchObject({ id: "w1", template: "carousel" }); // the id lets the page place it by id
      expect(json).not.toHaveProperty("widgets");
    });

    it("several live widgets: `config` is still the first (older embed scripts read only that), and each is listed with its id", async () => {
      widgets.current = [widget("w1", { template: "floating-card" }), widget("w2", { template: "wall-of-love", pagesIncluded: ["/reviews"] })];
      const json = await (await respond()).json();
      expect(json.config).toMatchObject({ id: "w1", template: "floating-card" });
      expect(json.widgets.map((w: { id: string }) => w.id)).toEqual(["w1", "w2"]);
      expect(json.widgets[0]).toEqual({ id: "w1" }); // the first is `config`: only its id is repeated
      expect(json.widgets[1].config).toMatchObject({ template: "wall-of-love", pagesIncluded: ["/reviews"], trigger: { type: "delay", value: { seconds: 3 } } });
      expect(json.widgets[1].inline).toBe(true); // the wall sits in the page, so the script needs a spot for it
    });

    it("floating widgets are not flagged as inline", async () => {
      widgets.current = [widget("w1"), widget("w2", { template: "floating-bubble" })];
      const json = await (await respond()).json();
      expect(json.widgets[1]).not.toHaveProperty("inline");
    });

    it("widgets that are off are not sent: the first live one is `config`, and one live widget means no list", async () => {
      widgets.current = [widget("w1", { isLive: false, template: "masonry" }), widget("w2", { template: "spotlight" }), widget("w3", { isLive: false })];
      const json = await (await respond()).json();
      expect(json.config).toMatchObject({ id: "w2", template: "spotlight" });
      expect(json).not.toHaveProperty("widgets");
    });

    it("all widgets off: no widget, and none of the space's customers' words are sent", async () => {
      widgets.current = [widget("w1", { isLive: false }), widget("w2", { isLive: false })];
      const res = await respond();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.config).toBeNull();
      expect(json.testimonials).toEqual([]);
      expect(json.reviews).toEqual([]);
      expect(db.select).toHaveBeenCalledTimes(1); // only the space lookup
    });

    it("a space with no widget saved yet still gets the default one", async () => {
      widgets.current = [];
      const json = await (await respond()).json();
      expect(json.config.template).toBe("floating-card");
      expect(json.config.trigger.type).toBe("delay");
      expect(json.config).not.toHaveProperty("id"); // no saved widget, so nothing to place by id
    });

    it("every widget wears the brand kit", async () => {
      brandKit.current = { primaryColor: "#112233", accentColor: null, borderRadius: 4, fontMode: "inherit", fontFamily: null, inheritTextColor: false };
      widgets.current = [widget("w1"), widget("w2", { template: "marquee" })];
      const json = await (await respond()).json();
      expect(json.config.theme.primaryColor).toBe("#112233");
      expect(json.widgets[1].config.theme.primaryColor).toBe("#112233");
    });
  });
});
