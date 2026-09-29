import { describe, it, expect } from "vitest";
import {
  widgetPositionSchema,
  widgetThemeSchema,
  triggerTypeSchema,
  triggerValueSchema,
  updateWidgetConfigSchema,
  DEFAULT_WIDGET_CONFIG,
} from "../widget-config";

describe("Widget Config Validations", () => {
  describe("widgetPositionSchema", () => {
    it("accepts valid positions", () => {
      expect(widgetPositionSchema.safeParse("bottom-right").success).toBe(true);
      expect(widgetPositionSchema.safeParse("bottom-left").success).toBe(true);
      expect(widgetPositionSchema.safeParse("bottom-bar").success).toBe(true);
      expect(widgetPositionSchema.safeParse("story-strip").success).toBe(true);
    });

    it("rejects invalid positions", () => {
      expect(widgetPositionSchema.safeParse("top-right").success).toBe(false);
      expect(widgetPositionSchema.safeParse("center").success).toBe(false);
      expect(widgetPositionSchema.safeParse("").success).toBe(false);
    });
  });

  describe("widgetThemeSchema", () => {
    it("accepts valid theme settings", () => {
      const result = widgetThemeSchema.safeParse({
        primaryColor: "#6366f1",
        accentColor: "#ffffff",
        mode: "light",
        borderRadius: 12,
      });
      expect(result.success).toBe(true);
    });

    it("accepts 3-digit hex codes and dark mode", () => {
      const result = widgetThemeSchema.safeParse({
        primaryColor: "#fff",
        accentColor: "#000",
        mode: "dark",
        borderRadius: 0,
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid hex colors", () => {
      const result = widgetThemeSchema.safeParse({
        primaryColor: "blue",
        accentColor: "#ffffff",
        mode: "light",
        borderRadius: 12,
      });
      expect(result.success).toBe(false);
    });

    it("rejects border radius outside 0-24 range", () => {
      expect(
        widgetThemeSchema.safeParse({
          primaryColor: "#6366f1",
          accentColor: "#ffffff",
          mode: "light",
          borderRadius: -1,
        }).success
      ).toBe(false);

      expect(
        widgetThemeSchema.safeParse({
          primaryColor: "#6366f1",
          accentColor: "#ffffff",
          mode: "light",
          borderRadius: 25,
        }).success
      ).toBe(false);
    });
  });

  describe("triggerTypeSchema", () => {
    it("accepts all 5 trigger types", () => {
      expect(triggerTypeSchema.safeParse("delay").success).toBe(true);
      expect(triggerTypeSchema.safeParse("exit-intent").success).toBe(true);
      expect(triggerTypeSchema.safeParse("scroll-depth").success).toBe(true);
      expect(triggerTypeSchema.safeParse("pageview-count").success).toBe(true);
      expect(triggerTypeSchema.safeParse("returning-visitor").success).toBe(true);
    });

    it("rejects invalid trigger type", () => {
      expect(triggerTypeSchema.safeParse("click").success).toBe(false);
    });
  });

  describe("triggerValueSchema", () => {
    it("validates delay seconds correctly", () => {
      expect(triggerValueSchema.safeParse({ seconds: 5 }).success).toBe(true);
      expect(triggerValueSchema.safeParse({ seconds: 0 }).success).toBe(false);
      expect(triggerValueSchema.safeParse({ seconds: -3 }).success).toBe(false);
    });

    it("validates scroll percentage correctly", () => {
      expect(triggerValueSchema.safeParse({ percentage: 50 }).success).toBe(true);
      expect(triggerValueSchema.safeParse({ percentage: 0 }).success).toBe(false);
      expect(triggerValueSchema.safeParse({ percentage: 101 }).success).toBe(false);
    });

    it("validates pageview count correctly", () => {
      expect(triggerValueSchema.safeParse({ count: 2 }).success).toBe(true);
      expect(triggerValueSchema.safeParse({ count: 0 }).success).toBe(false);
    });

    it("allows empty objects for parameterless triggers", () => {
      expect(triggerValueSchema.safeParse({}).success).toBe(true);
    });
  });

  describe("updateWidgetConfigSchema", () => {
    it("validates complete default widget config", () => {
      const result = updateWidgetConfigSchema.safeParse(DEFAULT_WIDGET_CONFIG);
      expect(result.success).toBe(true);
    });

    it("rejects invalid page targeting patterns", () => {
      const invalid = {
        ...DEFAULT_WIDGET_CONFIG,
        pagesIncluded: [""],
      };
      const result = updateWidgetConfigSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
