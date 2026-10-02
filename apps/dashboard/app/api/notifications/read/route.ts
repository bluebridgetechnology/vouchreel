import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { internalError, unauthorized, validationError } from "@/lib/api/errors";
import { markNotificationsRead } from "@/lib/notifications/queries";

export const dynamic = "force-dynamic";

const bodySchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }),
]);

/** POST /api/notifications/read with { all: true } or { ids: [...] }. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) return unauthorized("Unauthorized");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("Provide { all: true } or { ids: [...] }", parsed.error.flatten().fieldErrors);

  try {
    await markNotificationsRead(session.user.id, "all" in parsed.data ? undefined : parsed.data.ids);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to mark notifications read:", err);
    return internalError("Failed to update notifications");
  }
}
