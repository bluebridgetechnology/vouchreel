/**
 * Entry point for the video worker (Remotion + Chromium). Bundled to dist/video-worker.mjs by
 * scripts/build-worker.mjs. It claims only review_video jobs; everything else stays with main.ts.
 */
import { registerVideoHandlers } from "@/lib/review-video/register";
import { JOB_TYPES } from "./handlers";
import { runWorker } from "./worker";

const controller = new AbortController();
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.log(`[video-worker] ${sig} received, finishing in-flight renders`);
    controller.abort();
  });
}

registerVideoHandlers();
// One render at a time by default: each uses a browser and 1-2 GB of memory
await runWorker(controller.signal, {
  only: [JOB_TYPES.reviewVideo],
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? 1),
  workerId: `video-worker-${process.pid}`,
});
process.exit(0);
