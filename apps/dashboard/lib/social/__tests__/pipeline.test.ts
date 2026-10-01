import { describe, it, expect, vi } from "vitest";
import {
  buildFfmpegArgs,
  buildFfmpegFiltergraph,
  escapeFfmpegText,
  getWatermarkCoordinates,
} from "../pipeline";
import { PLATFORM_PRESETS } from "../presets";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

describe("Social Repurposing Pipeline", () => {
  describe("escapeFfmpegText", () => {
    it("escapes special characters for drawtext", () => {
      const input = "This is a 'great' product: 100% recommended!\nNext line";
      const escaped = escapeFfmpegText(input);
      expect(escaped).toBe(
        "This is a \\'great\\' product\\: 100\\% recommended! Next line"
      );
    });
  });

  describe("getWatermarkCoordinates", () => {
    it("returns correct coordinates for all 4 positions", () => {
      expect(getWatermarkCoordinates("bottom-right")).toEqual({
        x: "w-tw-40",
        y: "h-th-60",
      });
      expect(getWatermarkCoordinates("bottom-left")).toEqual({
        x: "40",
        y: "h-th-60",
      });
      expect(getWatermarkCoordinates("top-right")).toEqual({
        x: "w-tw-40",
        y: "60",
      });
      expect(getWatermarkCoordinates("top-left")).toEqual({
        x: "40",
        y: "60",
      });
    });
  });

  describe("buildFfmpegFiltergraph", () => {
    it("builds 9:16 blurred background filter graph with captions, branding and watermark", () => {
      const filter = buildFfmpegFiltergraph({
        framing: "blur",
        customerName: "Jane Doe",
        customerCompany: "Acme Corp",
        quote: "Vouchreel doubled our conversion rates in just 2 weeks!",
        showWatermark: true,
        watermarkPosition: "bottom-right",
        includeCaptions: true,
        includeBranding: true,
      });

      expect(filter).toContain("scale=1080:1920:force_original_aspect_ratio=increase");
      expect(filter).toContain("boxblur=25:5");
      expect(filter).toContain("scale=1080:1920:force_original_aspect_ratio=decrease");
      expect(filter).toContain("overlay=(W-w)/2:(H-h)/2[base]");
      expect(filter).toContain("Jane Doe • Acme Corp");
      expect(filter).toContain("Vouchreel doubled our conversion rates");
      expect(filter).toContain("Made with Vouchreel • vouchreel.com");
      expect(filter).toContain("w-tw-40");
    });

    it("builds 9:16 letterbox filter graph", () => {
      const filter = buildFfmpegFiltergraph({
        framing: "letterbox",
        showWatermark: false,
      });

      expect(filter).toContain(
        "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(1080-iw)/2:(1920-ih)/2:color=black[base]"
      );
      expect(filter).not.toContain("Made with Vouchreel");
    });

    it("omits captions and branding when toggled off", () => {
      const filter = buildFfmpegFiltergraph({
        framing: "blur",
        customerName: "John",
        quote: "Sample quote",
        includeCaptions: false,
        includeBranding: false,
        showWatermark: true,
      });

      expect(filter).not.toContain("Sample quote");
      expect(filter).not.toContain("John");
      expect(filter).toContain("Made with Vouchreel");
    });

    it("includes logo overlay when logo input exists", () => {
      const filter = buildFfmpegFiltergraph({
        framing: "blur",
        hasLogoInput: true,
        includeBranding: true,
        showWatermark: false,
      });

      expect(filter).toContain("[1:v]scale=160:-1[logo]");
      expect(filter).toContain("overlay=(W-w)/2:80[logo_layer]");
    });
  });

  describe("buildFfmpegArgs", () => {
    it("generates correct CLI args for TikTok export", () => {
      const preset = PLATFORM_PRESETS.tiktok;
      const args = buildFfmpegArgs({
        sourcePath: "/tmp/in.mp4",
        outputPath: "/tmp/out.mp4",
        framing: "blur",
        customerName: "Sarah Connor",
        quote: "Awesome widget!",
        showWatermark: true,
        maxDurationSeconds: preset.maxDurationSeconds,
      });

      expect(args[0]).toBe("-i");
      expect(args[1]).toBe("/tmp/in.mp4");
      expect(args).toContain("-filter_complex");
      expect(args).toContain("libx264");
      expect(args).toContain("yuv420p");
      expect(args).toContain("+faststart");
      expect(args).toContain("-t");
      expect(args).toContain("60");
      expect(args[args.length - 1]).toBe("/tmp/out.mp4");
    });

    it("generates correct CLI args for Reels preset (up to 90s)", () => {
      const preset = PLATFORM_PRESETS.reels;
      const args = buildFfmpegArgs({
        sourcePath: "/tmp/in.mp4",
        outputPath: "/tmp/out.mp4",
        framing: "letterbox",
        showWatermark: false,
        maxDurationSeconds: preset.maxDurationSeconds,
      });

      expect(args).toContain("-t");
      expect(args).toContain("90");
    });
  });
});
