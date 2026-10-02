import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Guard for /api/cron/* endpoints. Returns a response to send back when the request must
 * be rejected, or null when it is authorised.
 *
 * Production FAILS CLOSED: if CRON_SECRET is not configured the endpoints refuse to run
 * (previously a missing secret made them public). In development they stay open so a
 * local `curl` works without setup. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`
 * automatically when the CRON_SECRET env var is set.
 */
export function authorizeCron(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[cron] CRON_SECRET is not set; refusing to run scheduled jobs.");
      return NextResponse.json({ error: "Cron is not configured" }, { status: 503 });
    }
    return null;
  }

  const header = request.headers.get("authorization") ?? "";
  if (!safeEqual(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
