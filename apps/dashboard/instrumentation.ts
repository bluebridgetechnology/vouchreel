/** Runs once when the server starts. Warns early about missing media tooling. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Error tracking: does nothing unless SENTRY_DSN is set
  const { initObservability } = await import("@/lib/observability/sentry");
  initObservability("web");
  const { getFfmpegStatus } = await import("@/lib/media/ffmpeg");
  const status = await getFfmpegStatus(true);
  if (!status.available) {
    console.warn(
      "[startup] FFmpeg not found: video transcoding and social exports will fail. " +
        "Install it (winget install Gyan.FFmpeg | brew install ffmpeg | apt install ffmpeg) or set FFMPEG_PATH."
    );
  } else if (!status.drawtext) {
    console.warn("[startup] FFmpeg has no drawtext filter: burned-in captions will fail.");
  }
}

/** Next calls this for every error thrown while serving a request. */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath?: string; routeType?: string; routerKind?: string }
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { captureRequestError } = await import("@/lib/observability/sentry");
  captureRequestError(error, request, context);
}
