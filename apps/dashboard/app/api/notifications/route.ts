import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { internalError, unauthorized } from "@/lib/api/errors";
import { listNotifications } from "@/lib/notifications/queries";

export const dynamic = "force-dynamic";

/** GET /api/notifications?limit=20: latest notifications plus the unread count for the bell. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) return unauthorized("Unauthorized");

  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 20);
  try {
    const data = await listNotifications(session.user.id, Number.isFinite(limit) ? limit : 20);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Failed to list notifications:", err);
    return internalError("Failed to load notifications");
  }
}
