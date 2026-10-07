import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ inserted: [] as Record<string, unknown>[], updated: [] as Record<string, unknown>[], fail: false, deleted: 0, restartAt: null as Date | null }));

vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({
      values: (v: Record<string, unknown>) => ({
        onConflictDoUpdate: async ({ set }: { set: Record<string, unknown> }) => {
          if (calls.fail) throw new Error("db down");
          calls.inserted.push(v);
          calls.updated.push(set);
        },
      }),
    }),
    select: () => ({ from: () => ({ where: async () => [{ at: calls.restartAt }] }) }),
    delete: () => ({
      where: () => {
        calls.deleted++;
        return Promise.resolve();
      },
    }),
  },
}));

import { HEARTBEAT_INTERVAL_MS, ONLINE_WITHIN_MS, startHeartbeat } from "../heartbeat";

beforeEach(() => {
  vi.useFakeTimers();
  calls.inserted.length = 0;
  calls.updated.length = 0;
  calls.fail = false;
  calls.deleted = 0;
  calls.restartAt = null;
});
afterEach(() => vi.useRealTimers());

describe("startHeartbeat", () => {
  it("beats at once, then every interval, counting claimed jobs", async () => {
    const hb = startHeartbeat({ workerId: "w1", kind: "video-worker", concurrency: 2, capabilities: { chromium: "ok" } });
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.inserted).toHaveLength(1);
    expect(calls.inserted[0]).toMatchObject({ workerId: "w1", kind: "video-worker", concurrency: 2, jobsProcessed: 0, capabilities: { chromium: "ok" }, stoppedAt: null });

    hb.recordProcessed(2);
    hb.recordProcessed(1);
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    expect(calls.inserted).toHaveLength(2);
    expect(calls.inserted[1]).toMatchObject({ jobsProcessed: 3 });
    // An update never rewrites the primary key
    expect(calls.updated[1]).not.toHaveProperty("workerId");
    await hb.stop();
  });

  it("marks a clean stop and then stops beating", async () => {
    const hb = startHeartbeat({ workerId: "w2", kind: "worker", concurrency: 1 });
    await vi.advanceTimersByTimeAsync(0);
    await hb.stop();
    const last = calls.inserted.at(-1)!;
    expect(last.stoppedAt).toBeInstanceOf(Date);
    const count = calls.inserted.length;
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 3);
    expect(calls.inserted).toHaveLength(count);
  });

  it("prunes old rows once at start", async () => {
    const hb = startHeartbeat({ workerId: "w3", kind: "worker", concurrency: 1 });
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 4);
    expect(calls.deleted).toBe(1);
    await hb.stop();
  });

  it("never throws when the database is down, and logs the failure once", async () => {
    calls.fail = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const hb = startHeartbeat({ workerId: "w4", kind: "worker", concurrency: 1 });
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 3);
    expect(warn).toHaveBeenCalledTimes(1);

    calls.fail = false;
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    expect(calls.inserted.length).toBeGreaterThan(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("recovered"));
    await expect(hb.stop()).resolves.toBeUndefined();
    warn.mockRestore();
    log.mockRestore();
  });

  it("reports online for longer than one missed beat", () => {
    expect(ONLINE_WITHIN_MS).toBeGreaterThan(HEARTBEAT_INTERVAL_MS * 2);
  });

  it("asks its worker to restart once, when a request newer than this process appears", async () => {
    const onRestartRequested = vi.fn();
    const hb = startHeartbeat({ workerId: "w-r", kind: "worker", concurrency: 1, onRestartRequested });
    await vi.advanceTimersByTimeAsync(0);
    // A request from before this process started is for an earlier run of the same id
    calls.restartAt = new Date(Date.now() - 60_000);
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    expect(onRestartRequested).not.toHaveBeenCalled();
    calls.restartAt = new Date(Date.now() + 1000);
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    expect(onRestartRequested).toHaveBeenCalledTimes(1);
    await hb.stop();
  });
});
