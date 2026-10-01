import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setupTrigger,
  isDismissed,
  markDismissed,
} from "../triggers";

describe("Widget Trigger System", () => {
  let mockSessionStorage: Record<string, string> = {};
  let mockLocalStorage: Record<string, string> = {};

  beforeEach(() => {
    vi.useFakeTimers();
    mockSessionStorage = {};
    mockLocalStorage = {};

    // Mock window storage
    vi.stubGlobal("sessionStorage", {
      getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
      setItem: vi.fn((key: string, val: string) => {
        mockSessionStorage[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockSessionStorage[key];
      }),
    });

    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
      setItem: vi.fn((key: string, val: string) => {
        mockLocalStorage[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockLocalStorage[key];
      }),
    });

    // Mock document
    vi.stubGlobal("document", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
      createElement: vi.fn().mockReturnValue({
        style: {},
        parentNode: {
          removeChild: vi.fn(),
        },
      }),
      documentElement: {
        scrollTop: 0,
        scrollHeight: 1000,
        clientHeight: 800,
      },
    });

    // Mock window
    vi.stubGlobal("window", {
      sessionStorage: globalThis.sessionStorage,
      localStorage: globalThis.localStorage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      scrollY: 0,
      innerHeight: 800,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("Dismissed state", () => {
    it("marks widget as dismissed and checks correctly", () => {
      expect(isDismissed("test_key")).toBe(false);
      markDismissed("test_key");
      expect(isDismissed("test_key")).toBe(true);
      expect(isDismissed("other_key")).toBe(false);
    });

    it("does not trigger when already dismissed in this session", () => {
      markDismissed("key_dismissed");
      const onTrigger = vi.fn();

      setupTrigger({
        type: "delay",
        value: { seconds: 1 },
        embedKey: "key_dismissed",
        onTrigger,
      });

      vi.advanceTimersByTime(2000);
      expect(onTrigger).not.toHaveBeenCalled();
    });
  });

  describe("Delay Trigger", () => {
    it("fires callback after configured seconds", () => {
      const onTrigger = vi.fn();

      setupTrigger({
        type: "delay",
        value: { seconds: 4 },
        embedKey: "key_1",
        onTrigger,
      });

      expect(onTrigger).not.toHaveBeenCalled();
      vi.advanceTimersByTime(3999);
      expect(onTrigger).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onTrigger).toHaveBeenCalledTimes(1);
    });

    it("can be cancelled before timer fires", () => {
      const onTrigger = vi.fn();

      const controller = setupTrigger({
        type: "delay",
        value: { seconds: 5 },
        embedKey: "key_2",
        onTrigger,
      });

      vi.advanceTimersByTime(2000);
      controller.cancel();
      vi.advanceTimersByTime(5000);
      expect(onTrigger).not.toHaveBeenCalled();
    });
  });

  describe("Pageview Count Trigger", () => {
    it("increments pageview count and triggers on reaching threshold", () => {
      const onTrigger = vi.fn();

      // First visit (target = 2) -> does not trigger
      setupTrigger({
        type: "pageview-count",
        value: { count: 2 },
        embedKey: "key_pv",
        onTrigger,
      });

      vi.advanceTimersByTime(1000);
      expect(onTrigger).not.toHaveBeenCalled();
      expect(mockSessionStorage["vouchreel_pv_count"]).toBe("1");

      // Second visit -> triggers
      setupTrigger({
        type: "pageview-count",
        value: { count: 2 },
        embedKey: "key_pv",
        onTrigger,
      });

      vi.advanceTimersByTime(1000);
      expect(onTrigger).toHaveBeenCalledTimes(1);
      expect(mockSessionStorage["vouchreel_pv_count"]).toBe("2");
    });
  });

  describe("Returning Visitor Trigger", () => {
    it("sets flag on first visit without triggering, and triggers on second visit", () => {
      const onTrigger = vi.fn();

      // Visit 1: first time
      setupTrigger({
        type: "returning-visitor",
        value: {},
        embedKey: "key_ret",
        onTrigger,
      });

      vi.advanceTimersByTime(2000);
      expect(onTrigger).not.toHaveBeenCalled();
      expect(mockLocalStorage["vouchreel_visited"]).toBe("true");

      // Visit 2: returning visitor
      setupTrigger({
        type: "returning-visitor",
        value: {},
        embedKey: "key_ret",
        onTrigger,
      });

      vi.advanceTimersByTime(1500);
      expect(onTrigger).toHaveBeenCalledTimes(1);
    });
  });
});
