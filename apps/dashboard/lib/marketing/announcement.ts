import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminSettings } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { announcementSchema, EMPTY_ANNOUNCEMENT, type Announcement } from "@/lib/validations/announcement";

/** The admin_settings row the announcement lives in. */
export const ANNOUNCEMENT_KEY = "announcement";

/** The saved announcement, whether or not it is on (for the admin form). Falls back to an empty one when nothing valid is saved. */
export async function readAnnouncement(): Promise<Announcement> {
  const row = await db.query.adminSettings.findFirst({ where: eq(adminSettings.key, ANNOUNCEMENT_KEY) });
  const parsed = announcementSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : EMPTY_ANNOUNCEMENT;
}

/**
 * What the bar shows: the announcement when it is on and has a message, otherwise null. A database that cannot be
 * read means no bar, never a broken page.
 */
export async function getActiveAnnouncement(): Promise<Announcement | null> {
  try {
    const announcement = await readAnnouncement();
    return announcement.enabled && announcement.message ? announcement : null;
  } catch (err) {
    log.warn("Could not read the announcement:", err);
    return null;
  }
}

/** A short fingerprint of what the bar says, so a visitor who closed one announcement sees the next one. */
export function announcementId(a: Announcement): string {
  const text = `${a.message}|${a.linkText}|${a.linkUrl}`;
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = (hash * 33) ^ text.charCodeAt(i);
  return (hash >>> 0).toString(36);
}
