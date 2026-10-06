import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

/**
 * The platform-admin flag as it is in the database right now.
 *
 * The signed-in session is cached in a cookie for a few minutes, so the flag on `session.user` can
 * be out of date: someone who has just been made an admin would be refused, and, worse, someone who
 * has just had admin taken away would keep it. Everything that guards an admin action asks here.
 * Pass the session user; a missing or unknown user is not an admin.
 */
export async function isPlatformAdminFresh(sessionUser: { id?: string } | null | undefined): Promise<boolean> {
  if (!sessionUser?.id) return false;
  const [row] = await db.select({ isPlatformAdmin: user.isPlatformAdmin }).from(user).where(eq(user.id, sessionUser.id));
  return row?.isPlatformAdmin === true;
}
