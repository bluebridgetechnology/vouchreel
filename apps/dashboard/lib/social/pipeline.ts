import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  socialExports,
  socialExportSettings,
  testimonials,
  spaces,
} from "@/lib/db/schema";
import { getSubscriptionLimits } from "@/lib/payments/subscription";
import { getStorage } from "@/lib/storage";
import {
  ensureFfmpeg,
  escapeFilterPath,
  friendlyMediaError,
  resolveFontFile,
  runFfmpeg,
} from "@/lib/media/ffmpeg";
import {
  PLATFORM_PRESETS,
  type FramingMode,
  type SocialPlatform,
  type WatermarkPosition,
} from "./presets";
import { DEFAULT_BRAND_HEX } from "@/lib/brand";
import { notifySpaceOwner } from "@/lib/notifications/service";
import { safeFetch } from "@/lib/security/ssrf";

export interface FiltergraphOptions {
  framing: FramingMode;
  brandColor?: string;
  customerName?: string | null;
  customerCompany?: string | null;
  quote?: string | null;
  includeCaptions?: boolean;
  includeBranding?: boolean;
  showWatermark?: boolean;
  watermarkPosition?: WatermarkPosition;
  hasLogoInput?: boolean;
  /** Absolute path to a font for drawtext (see resolveFontFile). */
  fontFile?: string;
}

/**
 * Escapes text for FFmpeg drawtext filter
 */
export function escapeFfmpegText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/%/g, "\\%")
    .replace(/\n/g, " ");
}

/**
 * Calculates coordinates for watermark badge in 1080x1920 canvas
 */
export function getWatermarkCoordinates(position: WatermarkPosition = "bottom-right"): {
  x: string;
  y: string;
} {
  switch (position) {
    case "bottom-left":
      return { x: "40", y: "h-th-60" };
    case "top-right":
      return { x: "w-tw-40", y: "60" };
    case "top-left":
      return { x: "40", y: "60" };
    case "bottom-right":
    default:
      return { x: "w-tw-40", y: "h-th-60" };
  }
}

/**
 * Builds the FFmpeg filter complex string for 9:16 vertical layout
 */
export function buildFfmpegFiltergraph(options: FiltergraphOptions): string {
  const filters: string[] = [];
  // Without an explicit font, drawtext depends on fontconfig and fails on minimal images
  const font = options.fontFile ? `fontfile='${escapeFilterPath(options.fontFile)}':` : "";
  let currentLayer = "base";

  if (options.framing === "blur") {
    // 1. Background: scale to cover 1080x1920 and heavily blur
    filters.push(
      "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[bg]"
    );
    // 2. Foreground: scale to fit within 1080x1920 preserving aspect ratio
    filters.push(
      "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg]"
    );
    // 3. Overlay sharp foreground centered over blurred background
    filters.push("[bg][fg]overlay=(W-w)/2:(H-h)/2[base]");
  } else {
    // Letterbox mode: scale to fit with black padding to 1080x1920
    filters.push(
      "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(1080-iw)/2:(1920-ih)/2:color=black[base]"
    );
  }

  // 4. Logo overlay (if present as input 1)
  if (options.hasLogoInput && options.includeBranding !== false) {
    const nextLayer = "logo_layer";
    filters.push(
      `[1:v]scale=160:-1[logo];[${currentLayer}][logo]overlay=(W-w)/2:80[${nextLayer}]`
    );
    currentLayer = nextLayer;
  }

  // 5. Header Branding Overlay (Customer Name / Company)
  if (
    options.includeBranding !== false &&
    (options.customerName || options.customerCompany)
  ) {
    const nextLayer = "brand_layer";
    const headerTitle = [options.customerName, options.customerCompany]
      .filter(Boolean)
      .join(" • ");
    const safeHeader = escapeFfmpegText(headerTitle);

    filters.push(
      `[${currentLayer}]drawtext=${font}text='${safeHeader}':fontsize=32:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=12:x=(w-text_w)/2:y=240[${nextLayer}]`
    );
    currentLayer = nextLayer;
  }

  // 6. Burned-in Captions / Quote
  if (options.includeCaptions !== false && options.quote) {
    const nextLayer = "caption_layer";
    const safeQuote = escapeFfmpegText(options.quote);

    filters.push(
      `[${currentLayer}]drawtext=${font}text='\\"${safeQuote}\\"':fontsize=42:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=16:line_spacing=10:x=(w-text_w)/2:y=h-420[${nextLayer}]`
    );
    currentLayer = nextLayer;
  }

  // 7. Vouchreel Watermark (Growth loop)
  if (options.showWatermark !== false) {
    const nextLayer = "wm_layer";
    const { x, y } = getWatermarkCoordinates(options.watermarkPosition);
    const watermarkText = escapeFfmpegText("Made with Vouchreel • vouchreel.com");

    filters.push(
      `[${currentLayer}]drawtext=${font}text='${watermarkText}':fontsize=24:fontcolor=white@0.85:box=1:boxcolor=black@0.5:boxborderw=8:x=${x}:y=${y}[${nextLayer}]`
    );
    currentLayer = nextLayer;
  }

  return filters.join(";");
}

export interface BuildFfmpegArgsOptions extends FiltergraphOptions {
  sourcePath: string;
  outputPath: string;
  logoPath?: string | null;
  maxDurationSeconds?: number;
}

/**
 * Builds the exact array of CLI arguments to pass to FFmpeg
 */
export function buildFfmpegArgs(options: BuildFfmpegArgsOptions): string[] {
  const args: string[] = ["-i", options.sourcePath];

  if (options.logoPath) {
    args.push("-i", options.logoPath);
  }

  const filtergraph = buildFfmpegFiltergraph({
    ...options,
    hasLogoInput: Boolean(options.logoPath),
  });

  args.push("-filter_complex", filtergraph);

  // Determine final video output map name
  let outMap = "[base]";
  if (options.showWatermark !== false) {
    outMap = "[wm_layer]";
  } else if (options.includeCaptions !== false && options.quote) {
    outMap = "[caption_layer]";
  } else if (
    options.includeBranding !== false &&
    (options.customerName || options.customerCompany)
  ) {
    outMap = "[brand_layer]";
  } else if (options.logoPath && options.includeBranding !== false) {
    outMap = "[logo_layer]";
  }

  args.push(
    "-map",
    outMap,
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart"
  );

  if (options.maxDurationSeconds && options.maxDurationSeconds > 0) {
    args.push("-t", options.maxDurationSeconds.toString());
  }

  args.push(options.outputPath);
  return args;
}

/**
 * Renders a social export in the background and saves output to storage
 */
export async function renderSocialExport(exportId: string): Promise<void> {
  const [exportRecord] = await db
    .select()
    .from(socialExports)
    .where(eq(socialExports.id, exportId));

  if (!exportRecord || exportRecord.status !== "pending") return;

  // Claim the export job
  const claimed = await db
    .update(socialExports)
    .set({ status: "processing" })
    .where(
      and(
        eq(socialExports.id, exportId),
        eq(socialExports.status, "pending")
      )
    )
    .returning({ id: socialExports.id });

  if (!claimed.length) return;

  const [testimonial] = await db
    .select()
    .from(testimonials)
    .where(eq(testimonials.id, exportRecord.testimonialId));

  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.id, exportRecord.spaceId));

  const [settings] = await db
    .select()
    .from(socialExportSettings)
    .where(eq(socialExportSettings.spaceId, exportRecord.spaceId));

  if (!testimonial || !space) {
    await db
      .update(socialExports)
      .set({
        status: "failed",
        errorMessage: "Testimonial or Space not found",
        completedAt: new Date(),
      })
      .where(eq(socialExports.id, exportId));
    return;
  }

  const rawVideoUrl = testimonial.clipUrl || testimonial.videoUrl;
  if (!rawVideoUrl || (!rawVideoUrl.startsWith("http://") && !rawVideoUrl.startsWith("https://"))) {
    await db
      .update(socialExports)
      .set({
        status: "failed",
        errorMessage:
          "Testimonial does not have a downloadable direct video source.",
        completedAt: new Date(),
      })
      .where(eq(socialExports.id, exportId));
    return;
  }

  // Check subscription limits for watermark gating
  const limits = await getSubscriptionLimits(space.ownerId);
  const showWatermark = limits.removeWatermark
    ? (settings?.showWatermark ?? true)
    : true;

  const preset = PLATFORM_PRESETS[exportRecord.format as SocialPlatform] || PLATFORM_PRESETS.tiktok;
  const tempDir = await mkdtemp(path.join(tmpdir(), "vouchreel-social-export-"));
  const sourcePath = path.join(tempDir, "source.mp4");
  const outputPath = path.join(tempDir, "output.mp4");
  let logoPath: string | undefined;

  try {
    await ensureFfmpeg();

    // Download source video
    const videoResponse = await safeFetch(rawVideoUrl, { signal: AbortSignal.timeout(120_000) });
    if (!videoResponse.ok) {
      throw new Error(`Failed to download source video (${videoResponse.status})`);
    }
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    await writeFile(sourcePath, videoBuffer);

    // Download logo if configured
    if (settings?.logoUrl && settings.logoUrl.startsWith("http")) {
      try {
        const logoRes = await safeFetch(settings.logoUrl, { signal: AbortSignal.timeout(15_000) });
        if (logoRes.ok) {
          logoPath = path.join(tempDir, "logo.png");
          await writeFile(logoPath, Buffer.from(await logoRes.arrayBuffer()));
        }
      } catch {
        logoPath = undefined;
      }
    }

    const ffmpegArgs = buildFfmpegArgs({
      fontFile: resolveFontFile(),
      sourcePath,
      outputPath,
      logoPath,
      framing: settings?.defaultFraming || "blur",
      brandColor: settings?.brandColor || DEFAULT_BRAND_HEX,
      customerName: testimonial.customerName,
      customerCompany: testimonial.customerCompany,
      quote: testimonial.quote,
      showWatermark,
      watermarkPosition: settings?.watermarkPosition || "bottom-right",
      includeCaptions: true,
      includeBranding: true,
      maxDurationSeconds: preset.maxDurationSeconds,
    });

    await runFfmpeg(ffmpegArgs);

    // Upload rendered video to storage
    const storage = getStorage();
    const storageKey = `social-exports/${space.id}/${testimonial.id}/${exportRecord.format}-${randomUUID()}.mp4`;
    const outputBuffer = await readFile(outputPath);

    const outputUrl = await storage.upload(outputBuffer, storageKey, {
      contentType: "video/mp4",
      public: true,
      metadata: {
        format: exportRecord.format,
        testimonialId: testimonial.id,
      },
    });

    await db
      .update(socialExports)
      .set({
        status: "done",
        outputUrl,
        errorMessage: null,
        metadata: {
          width: preset.width,
          height: preset.height,
          aspectRatio: preset.aspectRatio,
          durationSeconds: preset.maxDurationSeconds,
          watermarkIncluded: showWatermark,
          framing: settings?.defaultFraming || "blur",
        },
        completedAt: new Date(),
      })
      .where(eq(socialExports.id, exportId));

    void notifySpaceOwner(exportRecord.spaceId, {
      type: "social_export.completed",
      title: `Your ${exportRecord.format} export is ready`,
      body: testimonial.customerName ? `Rendered from ${testimonial.customerName}'s testimonial.` : undefined,
      href: `/spaces/${exportRecord.spaceId}/social`,
      metadata: { exportId },
    });
  } catch (error) {
    const errorMsg = friendlyMediaError(error);
    console.error(`Social export rendering error for ${exportId}:`, error);

    await db
      .update(socialExports)
      .set({
        status: "failed",
        errorMessage: errorMsg,
        completedAt: new Date(),
      })
      .where(eq(socialExports.id, exportId));

    void notifySpaceOwner(exportRecord.spaceId, {
      type: "social_export.failed",
      title: "A social export failed",
      body: errorMsg,
      href: `/spaces/${exportRecord.spaceId}/social`,
      metadata: { exportId },
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Queue social export in background
 */
export function queueSocialExport(exportId: string): void {
  void renderSocialExport(exportId);
}
