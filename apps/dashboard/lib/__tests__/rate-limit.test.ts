import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit, resetRateLimits } from "../rate-limit";

beforeEach(() => {
  resetRateLimits();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("rateLimit (in-memory)", () => {
  it("allows up to max hits then blocks until the window resets", async () => {
    vi.useFakeTimers();
    const opts = { windowMs: 1000, max: 3 };
    expect((await rateLimit("k", opts)).remaining).toBe(2);
    expect((await rateLimit("k", opts)).remaining).toBe(1);
    expect((await rateLimit("k", opts)).remaining).toBe(0);
    const blocked = await rateLimit("k", opts);
    expect(blocked.success).toBe(false);

    vi.advanceTimersByTime(1001);
    expect((await rateLimit("k", opts)).success).toBe(true);
  });

  it("keeps identifiers independent", async () => {
    await rateLimit("a", { max: 1 });
    expect((await rateLimit("a", { max: 1 })).success).toBe(false);
    expect((await rateLimit("b", { max: 1 })).success).toBe(true);
  });
});

describe("rateLimit (Redis via Upstash REST)", () => {
  const redisOn = () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
  };

  it("uses shared counters and reports the TTL as the reset time", async () => {
    redisOn();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ result: 2 }, { result: 0 }, { result: 45_000 }]), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const before = Date.now();
    const res = await rateLimit("user-1", { windowMs: 60_000, max: 5 });
    expect(res).toMatchObject({ success: true, remaining: 3 });
    expect(res.reset).toBeGreaterThanOrEqual(before + 44_000);
    expect(fetchMock.mock.calls[0][0]).toBe("https://redis.example.upstash.io/pipeline");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)[0]).toEqual(["INCR", "vr:rl:user-1"]);
  });

  it("blocks when the shared count exceeds the max", async () => {
    redisOn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify([{ result: 6 }, { result: 0 }, { result: 1000 }]), { status: 200 }))
    );
    expect(await rateLimit("user-2", { max: 5 })).toMatchObject({ success: false, remaining: 0 });
  });

  it("falls back to in-memory counting when Redis is down instead of failing requests", async () => {
    redisOn();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect((await rateLimit("user-3", { max: 1 })).success).toBe(true);
    expect((await rateLimit("user-3", { max: 1 })).success).toBe(false);
  });
});
