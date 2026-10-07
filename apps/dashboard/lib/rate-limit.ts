import { log } from "@/lib/log";
/**
 * Fixed-window rate limiter.
 *
 * Storage:
 *  - With UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN the counters live in Redis, so
 *    limits hold across serverless invocations and multiple instances.
 *  - Otherwise counters are in process memory. That is correct for a single long-lived
 *    server (the Docker/VPS deployment) but NOT on Vercel or with several replicas, where
 *    every instance keeps its own count.
 * If Redis is unreachable the limiter falls back to memory instead of failing requests.
 */

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** Epoch ms when the window resets. */
  reset: number;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const memory = new Map<string, RateLimitRecord>();

function memoryLimit(identifier: string, windowMs: number, max: number): RateLimitResult {
  const now = Date.now();

  if (memory.size > 1000) {
    for (const [key, record] of memory) {
      if (now > record.resetTime) memory.delete(key);
    }
  }

  const record = memory.get(identifier);
  if (!record || now > record.resetTime) {
    const fresh = { count: 1, resetTime: now + windowMs };
    memory.set(identifier, fresh);
    return { success: true, remaining: max - 1, reset: fresh.resetTime };
  }

  if (record.count >= max) {
    return { success: false, remaining: 0, reset: record.resetTime };
  }

  record.count += 1;
  return { success: true, remaining: max - record.count, reset: record.resetTime };
}

async function redisLimit(identifier: string, windowMs: number, max: number): Promise<RateLimitResult> {
  const base = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
  const key = `vr:rl:${identifier}`;
  const res = await fetch(`${base}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["PEXPIRE", key, String(windowMs), "NX"],
      ["PTTL", key],
    ]),
    signal: AbortSignal.timeout(1500),
  });
  if (!res.ok) throw new Error(`Redis rate limit responded ${res.status}`);
  const data = (await res.json()) as { result?: number; error?: string }[];
  if (data[0]?.error) throw new Error(data[0].error);
  const count = Number(data[0]?.result ?? 1);
  const ttl = Number(data[2]?.result ?? windowMs);
  return {
    success: count <= max,
    remaining: Math.max(0, max - count),
    reset: Date.now() + (ttl > 0 ? ttl : windowMs),
  };
}

/** Consumes one hit for `identifier`. Defaults: 30 requests per minute. */
export async function rateLimit(identifier: string, options: RateLimitOptions = {}): Promise<RateLimitResult> {
  const windowMs = options.windowMs ?? 60 * 1000;
  const max = options.max ?? 30;

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await redisLimit(identifier, windowMs, max);
    } catch (error) {
      log.error("[rate-limit] Redis unavailable, using in-memory counters:", error);
    }
  }
  return memoryLimit(identifier, windowMs, max);
}

/** Test helper: clears in-memory counters. */
export function resetRateLimits(): void {
  memory.clear();
}
