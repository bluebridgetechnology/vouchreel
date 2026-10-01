/** Runs once when the server starts. Warns early about missing media tooling. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
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
