/**
 * Entry point for the video worker (Remotion + Chromium). Bundled to dist/video-worker.mjs by
 * scripts/build-worker.mjs. It claims only review_video jobs; everything else stays with main.ts.
 */
import { hostname } from "node:os";
import { checkBrowser } from "@vouchreel/video/render";
import { registerVideoHandlers } from "@/lib/review-video/register";
import { JOB_TYPES } from "./handlers";
import { runWorker } from "./worker";
import { log } from "@/lib/log";
import { flushObservability, initObservability } from "@/lib/observability/sentry";

initObservability("video-worker");

const controller = new AbortController();
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    log.info(`[video-worker] ${sig} received, finishing in-flight renders`);
    controller.abort();
  });
}

registerVideoHandlers();
// Launch the browser once now, so a broken Chromium shows up in the admin area (and the log) at start-up
const browser = await checkBrowser();
if (!browser.ok) log.warn(`[video-worker] Chromium could not start, renders will fail: ${browser.error}`);
// One render at a time by default: each uses a browser and 1-2 GB of memory
await runWorker(controller.signal, {
  only: [JOB_TYPES.reviewVideo],
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? 1),
  workerId: `video-worker-${hostname()}-${process.pid}`,
  heartbeat: { kind: "video-worker", capabilities: { chromium: browser.ok ? "ok" : `error: ${browser.error}` } },
});
await flushObservability();
process.exit(0);
