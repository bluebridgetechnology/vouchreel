interface RateLimitOptions {
  windowMs?: number;
  max?: number;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Clean up expired rate limit entries periodically
 */
function cleanupExpiredRecords(now: number) {
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Checks if an identifier exceeds the rate limit.
 * Returns { success: boolean, remaining: number, reset: number }
 */
export function rateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): { success: boolean; remaining: number; reset: number } {
  const windowMs = options.windowMs ?? 60 * 1000; // default 1 minute
  const max = options.max ?? 30; // default 30 requests per window
  const now = Date.now();

  // Periodic cleanup if store grows
  if (rateLimitStore.size > 1000) {
    cleanupExpiredRecords(now);
  }

  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    const newRecord: RateLimitRecord = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(identifier, newRecord);
    return {
      success: true,
      remaining: max - 1,
      reset: newRecord.resetTime,
    };
  }

  if (record.count >= max) {
    return {
      success: false,
      remaining: 0,
      reset: record.resetTime,
    };
  }

  record.count += 1;
  return {
    success: true,
    remaining: max - record.count,
    reset: record.resetTime,
  };
}
