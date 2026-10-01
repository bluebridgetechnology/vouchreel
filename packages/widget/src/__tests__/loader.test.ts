import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  hashExperiment,
  assignVariant,
  getOrAssignVariant,
  applyVariantConfig,
  ActiveExperiment,
  WidgetApiResponse,
} from "../loader";

describe("Widget A/B Testing Loader Engine", () => {
  beforeEach(() => {
    // Clear mock sessionStorage before each test
    const store: Record<string, string> = {};
    const mockStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        for (const k of Object.keys(store)) delete store[k];
      }),
    };

    vi.stubGlobal("sessionStorage", mockStorage);
    vi.stubGlobal("window", {
      sessionStorage: mockStorage,
      location: {
        href: "https://example.com/",
        pathname: "/",
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("hashExperiment", () => {
    it("returns consistent 32-bit hash for identical input", () => {
      const h1 = hashExperiment("sess-123", "exp-456");
      const h2 = hashExperiment("sess-123", "exp-456");
      expect(h1).toBe(h2);
      expect(typeof h1).toBe("number");
      expect(h1).toBeGreaterThanOrEqual(0);
    });

    it("produces different hashes for different sessions", () => {
      const h1 = hashExperiment("sess-alpha", "exp-1");
      const h2 = hashExperiment("sess-beta", "exp-1");
      expect(h1).not.toBe(h2);
    });
  });

  describe("assignVariant", () => {
    it("deterministically maps to variant 0 or 1 for 50/50 split", () => {
      const split = [50, 50];
      const variant = assignVariant("session-abc", "exp-test", split, 2);
      expect([0, 1]).toContain(variant);

      // Same inputs must produce exact same assignment
      expect(assignVariant("session-abc", "exp-test", split, 2)).toBe(variant);
    });

    it("respects multi-variant traffic splits", () => {
      const split = [25, 25, 50];
      const results: Record<number, number> = { 0: 0, 1: 0, 2: 0 };

      // Distribute across 500 simulated sessions
      for (let i = 0; i < 500; i++) {
        const v = assignVariant(`session-${i}`, "exp-multivar", split, 3);
        results[v] = (results[v] || 0) + 1;
      }

      expect(results[0]).toBeGreaterThan(60);
      expect(results[1]).toBeGreaterThan(60);
      expect(results[2]).toBeGreaterThan(150);
    });
  });

  describe("getOrAssignVariant", () => {
    const experiment: ActiveExperiment = {
      id: "exp-session-test",
      name: "Position Test",
      type: "position",
      trafficSplit: [50, 50],
      variants: [
        { id: "v0", name: "Bottom Right", config: { position: "bottom-right" } },
        { id: "v1", name: "Bottom Left", config: { position: "bottom-left" } },
      ],
    };

    it("stores assignment in sessionStorage under vr_exp_{experimentId}", () => {
      const v = getOrAssignVariant("sess-fresh", experiment);
      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        `vr_exp_${experiment.id}`,
        String(v)
      );
    });

    it("reuses cached assignment from sessionStorage if available", () => {
      sessionStorage.setItem(`vr_exp_${experiment.id}`, "1");
      const v = getOrAssignVariant("different-session-id", experiment);
      expect(v).toBe(1);
    });
  });

  describe("applyVariantConfig", () => {
    it("overrides trigger configuration when experiment type is trigger", () => {
      const experiment: ActiveExperiment = {
        id: "exp-trig",
        name: "Trigger Test",
        type: "trigger",
        trafficSplit: [50, 50],
        variants: [
          { id: "v0", name: "Delay 3s", config: { type: "delay", value: { seconds: 3 } } },
          { id: "v1", name: "Exit Intent", config: { type: "exit-intent", value: {} } },
        ],
      };

      const baseConfig: WidgetApiResponse["config"] = {
        position: "bottom-right",
        theme: { primaryColor: "#000", accentColor: "#fff", mode: "light", borderRadius: 8 },
        trigger: { type: "delay", value: { seconds: 10 } },
        autoplayPreview: false,
      };

      applyVariantConfig(baseConfig, experiment, 1);
      expect(baseConfig.trigger?.type).toBe("exit-intent");
    });

    it("overrides position when experiment type is position", () => {
      const experiment: ActiveExperiment = {
        id: "exp-pos",
        name: "Position Test",
        type: "position",
        trafficSplit: [50, 50],
        variants: [
          { id: "v0", name: "Control", config: { position: "bottom-right" } },
          { id: "v1", name: "Variant B", config: { position: "bottom-left" } },
        ],
      };

      const baseConfig: WidgetApiResponse["config"] = {
        position: "bottom-right",
        theme: { primaryColor: "#000", accentColor: "#fff", mode: "light", borderRadius: 8 },
        autoplayPreview: false,
      };

      applyVariantConfig(baseConfig, experiment, 1);
      expect(baseConfig.position).toBe("bottom-left");
    });

    it("overrides template when experiment type is template", () => {
      const experiment: ActiveExperiment = {
        id: "exp-tmpl",
        name: "Template Test",
        type: "template",
        trafficSplit: [50, 50],
        variants: [
          { id: "v0", name: "Control", config: { template: "floating-card" } },
          { id: "v1", name: "Variant B", config: { template: "wall-of-love" } },
        ],
      };

      const baseConfig: WidgetApiResponse["config"] = {
        template: "floating-card",
        position: "bottom-right",
        theme: { primaryColor: "#000", accentColor: "#fff", mode: "light", borderRadius: 8 },
        autoplayPreview: false,
      };

      applyVariantConfig(baseConfig, experiment, 1);
      expect(baseConfig.template).toBe("wall-of-love");
    });
  });
});
