import { NextResponse } from "next/server";
import { apiError, internalError, unauthorized } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { latestExport, requestExport } from "@/lib/account/export";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/** GET /api/account/export: the state of your latest data export. */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) return unauthorized("Unauthorized");
  try {
    return NextResponse.json({ export: await latestExport(session.user.id) });
  } catch (error) {
    log.error("Failed to read data export:", error);
    return internalError("Could not read your data export");
  }
}

/** POST /api/account/export: asks for a copy of your data. One request a day. */
export async function POST() {
  const session = await getSession();
  if (!session?.user?.id) return unauthorized("Unauthorized");
  try {
    const result = await requestExport(session.user.id);
    if ("tooSoon" in result) return apiError(429, "RATE_LIMITED", "You asked for a copy of your data in the last 24 hours. Use that one, or try again tomorrow.");
    return NextResponse.json({ ok: true, id: result.id }, { status: 202 });
  } catch (error) {
    log.error("Failed to request data export:", error);
    return internalError("Could not start your data export");
  }
}
