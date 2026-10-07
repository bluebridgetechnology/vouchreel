import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { internalError, unauthorized, validationError } from "@/lib/api/errors";
import { NOTIFICATION_TYPES } from "@/lib/notifications/catalog";
import { getPreferences, setPreference } from "@/lib/notifications/queries";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

const updateSchema = z
  .object({
    type: z.enum(NOTIFICATION_TYPES as [string, ...string[]]),
    inApp: z.boolean().optional(),
    email: z.boolean().optional(),
  })
  .refine((v) => v.inApp !== undefined || v.email !== undefined, "Provide inApp and/or email");

/** GET /api/notifications/preferences: every notification type with the user's channel settings. */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) return unauthorized("Unauthorized");
  try {
    return NextResponse.json({ preferences: await getPreferences(session.user.id) });
  } catch (err) {
    log.error("Failed to load notification preferences:", err);
    return internalError("Failed to load preferences");
  }
}

/** PUT /api/notifications/preferences with { type, inApp?, email? }. */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) return unauthorized("Unauthorized");

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("Invalid preference update", parsed.error.flatten().fieldErrors);

  try {
    const current = (await getPreferences(session.user.id)).find((p) => p.type === parsed.data.type);
    await setPreference(session.user.id, parsed.data.type as (typeof NOTIFICATION_TYPES)[number], {
      inApp: parsed.data.inApp ?? current?.inApp,
      email: parsed.data.email ?? current?.email,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error("Failed to update notification preference:", err);
    return internalError("Failed to update preference");
  }
}
