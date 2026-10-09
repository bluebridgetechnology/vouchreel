import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateSessionId,
  getOrCreateSessionId,
  AnalyticsTracker,
} from "../analytics";

describe("Analytics Module", () => {
  let mockSessionStorage: Record<string, string> = {};

  beforeEach(() => {
    mockSessionStorage = {};

    vi.stubGlobal("sessionStorage", {
      getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
      setItem: vi.fn((key: string, val: string) => {
        mockSessionStorage[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockSessionStorage[key];
      }),
    });

    vi.stubGlobal("window", {
      sessionStorage: globalThis.sessionStorage,
      location: {
        href: "https://example.com/checkout/success",
        pathname: "/checkout/success",
      },
      addEventListener: vi.fn(),
    });

    vi.stubGlobal("document", {
      visibilityState: "visible",
      addEventListener: vi.fn(),
    });

    vi.stubGlobal("navigator", {
      sendBeacon: vi.fn().mockReturnValue(true),
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("Session ID Management", () => {
    it("generates a 36-character UUID compliant session ID", () => {
      const sid = generateSessionId();
      expect(sid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it("persists and reuses session ID in sessionStorage", () => {
      const sid1 = getOrCreateSessionId();
      expect(sid1).toBeDefined();

      const sid2 = getOrCreateSessionId();
      expect(sid2).toBe(sid1);
    });
  });

  describe("AnalyticsTracker", () => {
    it("queues and flushes events with sendBeacon", () => {
      const tracker = new AnalyticsTracker({
        spaceId: "space-123",
        apiBase: "https://api.vouchreel.com",
        flushIntervalMs: 5000,
      });

      tracker.track("impression", "testi-1");
      tracker.track("play", "testi-1");

      tracker.flush();

      expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
      const callArgs = (navigator.sendBeacon as any).mock.calls[0];
      expect(callArgs[0]).toBe("https://api.vouchreel.com/api/events");

      // Verify engaged session flag was set
      expect(mockSessionStorage["vouchreel_engaged"]).toBe("true");
    });

    /** The events one flush sent. */
    const sentEvents = async () => JSON.parse(await ((navigator.sendBeacon as any).mock.calls[0][1] as Blob).text()).events as Record<string, any>[];

    it("puts the widget's id on the event, not among its free-form details", async () => {
      const tracker = new AnalyticsTracker({ spaceId: "space-123", apiBase: "https://api.vouchreel.com" });
      tracker.track("play", "testi-1", { widgetId: "widget-9", goalId: "g1" });
      tracker.flush();
      const [event] = await sentEvents();
      expect(event.widgetId).toBe("widget-9");
      expect(event.metadata).toMatchObject({ goalId: "g1", deviceType: "desktop" });
      expect(event.metadata).not.toHaveProperty("widgetId");
    });

    it("has no widget id for an event that is not one widget's (or from a widget with no id), and ignores a bad one", async () => {
      const tracker = new AnalyticsTracker({ spaceId: "space-123", apiBase: "https://api.vouchreel.com" });
      tracker.track("impression", "testi-1");
      tracker.track("click", "testi-1", { widgetId: 42 });
      tracker.track("convert", null, { goalId: "g1" });
      tracker.flush();
      expect((await sentEvents()).map((e) => e.widgetId)).toEqual([null, null, null]);
    });

    it("evaluates conversion goals and tracks convert event", () => {
      const tracker = new AnalyticsTracker({
        spaceId: "space-123",
        apiBase: "https://api.vouchreel.com",
        conversionGoals: [
          {
            id: "goal-1",
            goalType: "url-match",
            goalValue: "/checkout/**",
          },
        ],
      });

      // Flushes queued convert event
      tracker.flush();

      expect(navigator.sendBeacon).toHaveBeenCalled();
      expect(mockSessionStorage["vouchreel_converted_goal-1"]).toBe("true");
    });
  });
});
