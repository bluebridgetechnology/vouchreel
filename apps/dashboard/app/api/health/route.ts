import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getFfmpegStatus } from "@/lib/media/ffmpeg";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/health
 * Liveness/readiness for orchestrators and uptime monitors. Public, so it only
 * returns booleans (no versions, paths or error text). Returns 503 when the
 * database is down; a missing FFmpeg is reported as "degraded" (200) because the
 * dashboard and widget still work, but video processing does not.
 */
export async function GET() {
  const [database, ffmpeg] = await Promise.all([
    db.execute(sql`select 1`).then(
      () => true,
      () => false
    ),
    getFfmpegStatus(),
  ]);

  const status = !database ? "down" : ffmpeg.available ? "ok" : "degraded";
  return NextResponse.json(
    { status, checks: { database, ffmpeg: ffmpeg.available, captions: ffmpeg.drawtext ?? false } },
    { status: database ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
