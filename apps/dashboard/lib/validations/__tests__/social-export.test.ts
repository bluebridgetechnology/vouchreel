import { describe, it, expect } from "vitest";
import {
  createSocialExportSchema,
  updateSocialExportSettingsSchema,
} from "../social-export";

describe("Social Export Validation Schemas", () => {
  describe("updateSocialExportSettingsSchema", () => {
    it("accepts valid settings", () => {
      const valid = {
        logoUrl: "https://example.com/logo.png",
        brandColor: "#7c3aed",
        watermarkPosition: "bottom-left",
        showWatermark: false,
        defaultFraming: "letterbox",
      };
      const result = updateSocialExportSettingsSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("accepts empty string logoUrl or null", () => {
      expect(
        updateSocialExportSettingsSchema.safeParse({ logoUrl: "" }).success
      ).toBe(true);
      expect(
        updateSocialExportSettingsSchema.safeParse({ logoUrl: null }).success
      ).toBe(true);
    });

    it("rejects invalid hex brand color", () => {
      const result = updateSocialExportSettingsSchema.safeParse({
        brandColor: "not-a-color",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid watermark position", () => {
      const result = updateSocialExportSettingsSchema.safeParse({
        watermarkPosition: "middle-center",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createSocialExportSchema", () => {
    it("accepts valid platforms: tiktok, reels, shorts", () => {
      expect(
        createSocialExportSchema.safeParse({ format: "tiktok" }).success
      ).toBe(true);
      expect(
        createSocialExportSchema.safeParse({ format: "reels" }).success
      ).toBe(true);
      expect(
        createSocialExportSchema.safeParse({ format: "shorts" }).success
      ).toBe(true);
    });

    it("rejects invalid format", () => {
      const result = createSocialExportSchema.safeParse({
        format: "twitter",
      });
      expect(result.success).toBe(false);
    });

    it("defaults includeCaptions and includeBranding to true", () => {
      const parsed = createSocialExportSchema.parse({
        format: "tiktok",
      });
      expect(parsed.includeCaptions).toBe(true);
      expect(parsed.includeBranding).toBe(true);
    });
  });
});
