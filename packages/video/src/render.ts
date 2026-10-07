import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, renderStill, selectComposition, type ChromiumOptions } from "@remotion/renderer";
import { compositionId, validateProps, type Aspect, type ReviewVideoProps } from "./registry";

/**
 * Node-only render service. Imported by the worker, never by the web app or the browser.
 * The Remotion project is bundled once per process and reused for every render.
 */

export interface RenderOptions {
  templateId: string;
  aspect: Aspect;
  props: ReviewVideoProps;
  outputPath: string;
  /** Parallel browser tabs for one render. Defaults to VIDEO_RENDER_CONCURRENCY or 2. */
  concurrency?: number;
  /** Give up after this long. Default 5 minutes. */
  timeoutMs?: number;
  onProgress?: (progress: number) => void;
}

export interface RenderResult {
  durationInFrames: number;
  fps: number;
  durationSeconds: number;
  width: number;
  height: number;
}

export class InvalidVideoPropsError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join(" "));
    this.name = "InvalidVideoPropsError";
  }
}

let bundlePromise: Promise<string> | null = null;

/** Bundles the compositions once. Set VIDEO_BUNDLE_DIR to reuse a pre-built bundle (Docker). */
export function getServeUrl(): Promise<string> {
  if (!bundlePromise) {
    const prebuilt = process.env.VIDEO_BUNDLE_DIR;
    bundlePromise = prebuilt
      ? Promise.resolve(prebuilt)
      : bundle({
          // VIDEO_ENTRY_POINT is needed when this file has been bundled away from src/
          entryPoint: process.env.VIDEO_ENTRY_POINT || fileURLToPath(new URL("./entry.tsx", import.meta.url)),
          outDir: path.join(os.tmpdir(), `vouchreel-video-bundle-${process.pid}`),
        });
    // A failed bundle must not poison later attempts
    bundlePromise.catch(() => {
      bundlePromise = null;
    });
  }
  return bundlePromise;
}

function browserOptions() {
  const chromiumOptions: ChromiumOptions = {
    // Containers usually run as root without a user namespace, where Chromium refuses to start sandboxed
    ...(process.env.VIDEO_CHROMIUM_NO_SANDBOX === "1" ? { disableWebSecurity: false, enableMultiProcessOnLinux: true } : {}),
  };
  return { browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE || null, chromiumOptions };
}

function assertValid(options: Pick<RenderOptions, "templateId" | "props">) {
  const problems = validateProps(options.templateId, options.props);
  if (problems.length) throw new InvalidVideoPropsError(problems);
}

async function resolveComposition(options: Pick<RenderOptions, "templateId" | "aspect" | "props">) {
  const serveUrl = await getServeUrl();
  const inputProps = options.props as unknown as Record<string, unknown>;
  const composition = await selectComposition({
    serveUrl,
    id: compositionId(options.templateId, options.aspect),
    inputProps,
    ...browserOptions(),
  });
  return { serveUrl, composition, inputProps };
}

/** Renders a silent H.264 MP4. */
export async function renderReviewVideo(options: RenderOptions): Promise<RenderResult> {
  assertValid(options);
  const { serveUrl, composition, inputProps } = await resolveComposition(options);

  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: "h264",
    outputLocation: options.outputPath,
    muted: true,
    crf: 23,
    pixelFormat: "yuv420p",
    concurrency: options.concurrency ?? Number(process.env.VIDEO_RENDER_CONCURRENCY ?? 2),
    timeoutInMilliseconds: options.timeoutMs ?? 5 * 60_000,
    onProgress: options.onProgress ? ({ progress }) => options.onProgress!(progress) : undefined,
    ...browserOptions(),
  });

  return {
    durationInFrames: composition.durationInFrames,
    fps: composition.fps,
    durationSeconds: composition.durationInFrames / composition.fps,
    width: composition.width,
    height: composition.height,
  };
}

/** Renders one frame as a PNG, used for previews and poster images. */
export async function renderReviewStill(options: Omit<RenderOptions, "onProgress"> & { frame: number }): Promise<void> {
  assertValid(options);
  const { serveUrl, composition, inputProps } = await resolveComposition(options);
  await renderStill({
    serveUrl,
    composition,
    inputProps,
    frame: Math.max(0, Math.min(options.frame, composition.durationInFrames - 1)),
    output: options.outputPath,
    imageFormat: "png",
    timeoutInMilliseconds: options.timeoutMs ?? 2 * 60_000,
    ...browserOptions(),
  });
}

/** Video length for the given content, without rendering (the same maths the composition uses). */
export { durationInFrames } from "./registry";

/**
 * Starts and closes the browser the renderer will use, so a worker can tell at start-up (and the
 * admin area can show) whether renders can work at all. Does not bundle or render anything.
 */
export async function checkBrowser(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const browser = await openBrowser("chrome", {
      ...browserOptions(),
      logLevel: "error",
    });
    await browser.close({ silent: true });
    return { ok: true };
  } catch (error) {
    // First line only: Remotion's launch errors are long and include troubleshooting links
    return { ok: false, error: (error instanceof Error ? error.message : String(error)).split("\n")[0].slice(0, 300) };
  }
}
