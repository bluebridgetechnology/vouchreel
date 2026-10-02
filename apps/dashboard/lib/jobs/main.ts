/** Entry point for the standalone worker process (bundled by scripts/build-worker.mjs). */
import { getFfmpegStatus } from "@/lib/media/ffmpeg";
import { runWorker } from "./worker";

const controller = new AbortController();
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.log(`[worker] ${sig} received, finishing in-flight jobs`);
    controller.abort();
  });
}

const ffmpeg = await getFfmpegStatus(true);
if (!ffmpeg.available) console.warn("[worker] FFmpeg not found: media jobs will fail.");

await runWorker(controller.signal);
process.exit(0);
