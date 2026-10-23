import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminSettings } from "@/lib/db/schema";
import { internalError, validationError } from "@/lib/api/errors";
import { requirePlatformAdminApi } from "@/lib/admin/guard";
import { diffFields, logAdminAction } from "@/lib/admin/audit";
import { ANNOUNCEMENT_KEY, readAnnouncement } from "@/lib/marketing/announcement";
import { announcementSchema } from "@/lib/validations/announcement";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/** GET /api/admin/announcement: the saved announcement, on or off. */
export async function GET() {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json({ announcement: await readAnnouncement() });
  } catch (err) {
    log.error("Failed to read the announcement:", err);
    return internalError("Failed to load the announcement");
  }
}

/**
 * PUT /api/admin/announcement
 * Saves the bar shown across the top of the marketing pages: its text, an optional link and whether it is on. It
 * shows on the next page load; nothing is cached.
 */
export async function PUT(request: Request) {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;

  const parsed = announcementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return validationError("Validation failed", parsed.error.flatten().fieldErrors);
  }

  try {
    const before = await readAnnouncement();
    const existing = await db.query.adminSettings.findFirst({ where: eq(adminSettings.key, ANNOUNCEMENT_KEY) });
    if (existing) {
      await db.update(adminSettings).set({ value: parsed.data }).where(eq(adminSettings.key, ANNOUNCEMENT_KEY));
    } else {
      await db.insert(adminSettings).values({ key: ANNOUNCEMENT_KEY, value: parsed.data });
    }

    const changes = diffFields(before as unknown as Record<string, unknown>, parsed.data as unknown as Record<string, unknown>);
    await logAdminAction({
      actorId: guard.session.user.id,
      action: "settings.announcement",
      entityType: "setting",
      entityId: ANNOUNCEMENT_KEY,
      summary: parsed.data.enabled ? "Updated the announcement bar" : "Turned the announcement bar off",
      changes,
    });

    return NextResponse.json({ announcement: parsed.data });
  } catch (err) {
    log.error("Failed to save the announcement:", err);
    return internalError("Failed to save the announcement");
  }
}
