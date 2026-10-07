import { describe, expect, it, vi } from "vitest";

// workers.ts imports the database module; these tests never touch it
vi.mock("@/lib/db", () => ({ db: {} }));
import { assessKind, capabilityProblem, SLOW_QUEUE_MS, workerStatus } from "../workers";
import { ONLINE_WITHIN_MS } from "@/lib/jobs/heartbeat";

const NOW = Date.parse("2026-10-06T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms);
const worker = (kind: "worker" | "video-worker", status: "online" | "not_responding" | "stopped", capabilities: Record<string, string> = {}) => ({ kind, status, capabilities });

describe("worker status", () => {
  it("is online until three beats are missed, then not responding, and stopped after a clean shutdown", () => {
    expect(workerStatus({ lastSeenAt: ago(5_000), stoppedAt: null }, NOW)).toBe("online");
    expect(workerStatus({ lastSeenAt: ago(ONLINE_WITHIN_MS), stoppedAt: null }, NOW)).toBe("online");
    expect(workerStatus({ lastSeenAt: ago(ONLINE_WITHIN_MS + 1), stoppedAt: null }, NOW)).toBe("not_responding");
    expect(workerStatus({ lastSeenAt: ago(1_000), stoppedAt: ago(500) }, NOW)).toBe("stopped");
  });

  it("reports a broken Chromium or missing FFmpeg, and nothing for healthy or unknown capabilities", () => {
    expect(capabilityProblem(worker("video-worker", "online", { chromium: "ok" }))).toBeNull();
    expect(capabilityProblem(worker("video-worker", "online", {}))).toBeNull();
    expect(capabilityProblem(worker("video-worker", "online", { chromium: "error: Failed to launch the browser process!" }))).toBe(
      "Chromium could not start (Failed to launch the browser process!)"
    );
    expect(capabilityProblem(worker("worker", "online", { ffmpeg: "missing" }))).toBe("FFmpeg is not installed");
    expect(capabilityProblem(worker("worker", "online", { ffmpeg: "7.1" }))).toBeNull();
  });
});

describe("assessKind", () => {
  const base = { now: NOW, oldestQueuedAt: null as Date | null, queued: 0 };

  it("is critical when review videos wait and no video worker is alive", () => {
    const h = assessKind({ ...base, kind: "video-worker", workers: [worker("video-worker", "not_responding")], queued: 3, oldestQueuedAt: ago(20 * 60_000) });
    expect(h).toMatchObject({ severity: "critical", online: 0, queued: 3 });
    expect(h.message).toContain("No video worker is running");
    expect(h.message).toContain("3 review videos waiting for 20 minutes");
  });

  it("is only a warning for the general worker, which has the cron fallback", () => {
    const h = assessKind({ ...base, kind: "worker", workers: [], queued: 1, oldestQueuedAt: ago(30_000) });
    expect(h.severity).toBe("warning");
    expect(h.message).toContain("1 job waiting for under a minute");
    expect(h.message).toContain("/api/cron/process-jobs");
  });

  it("does not raise an alarm when nothing is running and nothing is waiting", () => {
    expect(assessKind({ ...base, kind: "video-worker", workers: [] })).toMatchObject({ severity: "ok", online: 0 });
    expect(assessKind({ ...base, kind: "video-worker", workers: [worker("video-worker", "stopped")] }).message).toContain("Nothing is waiting");
  });

  it("is critical when every video worker is alive but its Chromium cannot start", () => {
    const h = assessKind({ ...base, kind: "video-worker", workers: [worker("video-worker", "online", { chromium: "error: no sandbox" })], queued: 2, oldestQueuedAt: ago(1000) });
    expect(h.severity).toBe("critical");
    expect(h.message).toContain("Chromium could not start (no sandbox)");
    expect(h.message).toContain("2 review videos waiting");
  });

  it("stays healthy when one of two video workers works", () => {
    const h = assessKind({
      ...base,
      kind: "video-worker",
      workers: [worker("video-worker", "online", { chromium: "error: x" }), worker("video-worker", "online", { chromium: "ok" })],
    });
    expect(h).toMatchObject({ severity: "ok", online: 2 });
  });

  it("warns when workers are online but the oldest job has waited too long", () => {
    const stuck = assessKind({ ...base, kind: "worker", workers: [worker("worker", "online", { ffmpeg: "7" })], queued: 4, oldestQueuedAt: ago(SLOW_QUEUE_MS + 60_000) });
    expect(stuck.severity).toBe("warning");
    expect(stuck.message).toContain("may be busy or stuck");
    const fine = assessKind({ ...base, kind: "worker", workers: [worker("worker", "online", { ffmpeg: "7" })], queued: 4, oldestQueuedAt: ago(SLOW_QUEUE_MS - 60_000) });
    expect(fine).toMatchObject({ severity: "ok", online: 1 });
  });
});
