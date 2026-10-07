import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

/**
 * Whether the account is suspended right now. Read from the database, not the session cookie
 * (cached for minutes), so a suspension takes effect on the person's next request.
 */
export async function getSuspension(userId: string | null | undefined): Promise<{ suspended: boolean; reason: string | null }> {
  if (!userId) return { suspended: false, reason: null };
  const [row] = await db.select({ at: user.suspendedAt, reason: user.suspendedReason }).from(user).where(eq(user.id, userId));
  return { suspended: !!row?.at, reason: row?.reason ?? null };
}

export const SUSPENDED_MESSAGE = "This account has been suspended. Contact support if you think this is a mistake.";
