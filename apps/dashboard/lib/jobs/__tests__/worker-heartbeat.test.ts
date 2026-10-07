import { describe, expect, it, vi } from "vitest";

const hb = vi.hoisted(() => ({ recordProcessed: vi.fn(), stop: vi.fn(async () => {}), start: vi.fn() }));
const queue = vi.hoisted(() => ({ claimJob: vi.fn(), completeJob: vi.fn(), failJob: vi.fn(), reclaimStaleJobs: vi.fn(async () => 0) }));

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("../heartbeat", () => ({ startHeartbeat: (o: unknown) => (hb.start(o), hb) }));
vi.mock("../queue", async (importOriginal) => ({ ...(await importOriginal<typeof import("../queue")>()), ...queue }));
vi.mock("@/lib/social/pipeline", () => ({ renderSocialExport: vi.fn() }));

import { runWorker } from "../worker";

describe("runWorker heartbeat", () => {
  it("reports liveness only when asked, and says goodbye on shutdown", async () => {
    const controller = new AbortController();
    queue.claimJob.mockImplementation(async () => {
      controller.abort(); // one poll, then shut down
      return null;
    });
    await runWorker(controller.signal, { workerId: "w-test", concurrency: 2, heartbeat: { kind: "video-worker", capabilities: { chromium: "ok" } } });
    expect(hb.start).toHaveBeenCalledWith({ workerId: "w-test", concurrency: 2, kind: "video-worker", capabilities: { chromium: "ok" }, onRestartRequested: expect.any(Function) });
    expect(hb.stop).toHaveBeenCalledTimes(1);
  });

  it("does nothing about heartbeats for a plain run", async () => {
    hb.start.mockClear();
    hb.stop.mockClear();
    const controller = new AbortController();
    queue.claimJob.mockImplementation(async () => {
      controller.abort();
      return null;
    });
    await runWorker(controller.signal, { workerId: "w-plain", concurrency: 1 });
    expect(hb.start).not.toHaveBeenCalled();
    expect(hb.stop).not.toHaveBeenCalled();
  });

  it("finishes and returns, saying goodbye, when an admin asks it to restart", async () => {
    hb.stop.mockClear();
    hb.start.mockClear();
    const external = new AbortController(); // never aborted: the exit comes from the restart request
    let polls = 0;
    queue.claimJob.mockImplementation(async () => {
      polls++;
      if (polls === 2) (hb.start.mock.calls.at(-1)![0] as { onRestartRequested: () => void }).onRestartRequested();
      return null;
    });
    process.env.WORKER_POLL_MS = "5";
    await runWorker(external.signal, { workerId: "w-restart", concurrency: 1, heartbeat: { kind: "worker" } });
    expect(external.signal.aborted).toBe(false);
    expect(polls).toBeGreaterThanOrEqual(2);
    expect(hb.stop).toHaveBeenCalledTimes(1);
  });
});
