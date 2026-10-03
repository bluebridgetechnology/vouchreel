import { beforeEach, describe, expect, it, vi } from "vitest";

const queue = vi.hoisted(() => ({
  claimJob: vi.fn(),
  completeJob: vi.fn(),
  failJob: vi.fn(),
  reclaimStaleJobs: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("../queue", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../queue")>()),
  ...queue,
}));
vi.mock("@/lib/social/pipeline", () => ({ renderSocialExport: vi.fn() }));

import { backoffMs, type Job } from "../queue";
import { registerJobHandler } from "../handlers";
import { drainQueue, processJob } from "../worker";

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    type: "test_job",
    payload: {},
    status: "running",
    attempts: 1,
    maxAttempts: 3,
    runAt: new Date(),
    lockedAt: new Date(),
    lockedBy: "w",
    lastError: null,
    createdAt: new Date(),
    completedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  queue.failJob.mockResolvedValue("retry");
});

describe("backoffMs", () => {
  it("grows 30s, 2m, 8m and caps at 30m", () => {
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(2)).toBe(120_000);
    expect(backoffMs(3)).toBe(480_000);
    expect(backoffMs(10)).toBe(30 * 60 * 1000);
  });
});

describe("processJob", () => {
  it("completes the job when the handler succeeds", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registerJobHandler("test_job", handler);
    const job = makeJob({ payload: { a: 1 } });

    expect(await processJob(job)).toBe("done");
    expect(handler).toHaveBeenCalledWith({ a: 1 });
    expect(queue.completeJob).toHaveBeenCalledWith("job-1");
    expect(queue.failJob).not.toHaveBeenCalled();
  });

  it("records the failure and lets the queue decide retry when the handler throws", async () => {
    registerJobHandler("test_job", vi.fn().mockRejectedValue(new Error("boom")));
    const job = makeJob();

    expect(await processJob(job)).toBe("retry");
    expect(queue.failJob).toHaveBeenCalledWith(job, expect.objectContaining({ message: "boom" }));
    expect(queue.completeJob).not.toHaveBeenCalled();
  });

  it("fails an unknown job type immediately without retries", async () => {
    queue.failJob.mockResolvedValue("failed");
    const job = makeJob({ type: "nope", attempts: 1, maxAttempts: 5 });

    expect(await processJob(job)).toBe("failed");
    expect(queue.failJob).toHaveBeenCalledWith(
      expect.objectContaining({ attempts: 5, maxAttempts: 5 }),
      expect.objectContaining({ message: expect.stringContaining("nope") })
    );
  });
});

describe("drainQueue", () => {
  it("processes jobs until the queue is empty", async () => {
    registerJobHandler("test_job", vi.fn().mockResolvedValue(undefined));
    queue.claimJob
      .mockResolvedValueOnce(makeJob({ id: "a" }))
      .mockResolvedValueOnce(makeJob({ id: "b" }))
      .mockResolvedValue(null);

    expect(await drainQueue({ concurrency: 2 })).toBe(2);
    expect(queue.completeJob).toHaveBeenCalledTimes(2);
  });

  it("never claims more than maxJobs", async () => {
    registerJobHandler("test_job", vi.fn().mockResolvedValue(undefined));
    queue.claimJob.mockImplementation(async () => makeJob());

    expect(await drainQueue({ concurrency: 4, maxJobs: 3 })).toBe(3);
    expect(queue.claimJob).toHaveBeenCalledTimes(3);
  });
});
