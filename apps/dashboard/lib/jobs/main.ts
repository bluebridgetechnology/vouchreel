/** Entry point for the standalone worker process (bundled by scripts/build-worker.mjs). */
import { getFfmpegStatus } from "@/lib/media/ffmpeg";
import { JOB_TYPES } from "./handlers";
import { runWorker } from "./worker";
import { log } from "@/lib/log";
import { flushObservability, initObservability } from "@/lib/observability/sentry";

initObservability("worker");

const controller = new AbortController();
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    log.info(`[worker] ${sig} received, finishing in-flight jobs`);
    controller.abort();
  });
}

const ffmpeg = await getFfmpegStatus(true);
if (!ffmpeg.available) log.warn("[worker] FFmpeg not found: media jobs will fail.");

// Video jobs need Chromium, which this worker does not have; the video worker takes those
await runWorker(controller.signal, {
  except: [JOB_TYPES.reviewVideo],
  heartbeat: { kind: "worker", capabilities: { ffmpeg: ffmpeg.available ? (ffmpeg.version ?? "installed") : "missing" } },
});
await flushObservability();
process.exit(0);
