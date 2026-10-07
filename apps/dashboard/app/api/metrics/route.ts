import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { collectMetrics, renderPrometheus } from "@/lib/observability/metrics";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * GET /api/metrics
 * Job queue and worker numbers in the Prometheus text format. Off (404) unless METRICS_TOKEN is set;
 * the caller sends `Authorization: Bearer <METRICS_TOKEN>`. Counts and ages only, nothing about customers.
 */
export async function GET(request: Request) {
  const token = process.env.METRICS_TOKEN;
  if (!token) return new NextResponse("Not found", { status: 404 });
  if (!safeEqual(request.headers.get("authorization") ?? "", `Bearer ${token}`)) {
    return new NextResponse("Unauthorized", { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  }
  try {
    return new NextResponse(renderPrometheus(await collectMetrics()), {
      headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    log.error("[metrics] could not collect metrics", error);
    // Prometheus convention: the target is reachable but unhealthy
    return new NextResponse("# vouchreel_up 0\nvouchreel_up 0\n", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
