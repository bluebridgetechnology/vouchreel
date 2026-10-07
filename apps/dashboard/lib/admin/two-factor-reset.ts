import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { twoFactor, user } from "@/lib/db/schema";

export type ResetResult = { ok: true; email: string; wasEnabled: boolean } | { ok: false; reason: "not_found" | "self"; message: string };

/**
 * Switches two-factor sign-in off for an account whose owner lost their phone and backup codes.
 * An admin can never do it to their own account (another admin must), so one stolen admin session
 * cannot remove the second step from itself.
 */
export async function resetTwoFactor(actorId: string, targetId: string): Promise<ResetResult> {
  if (actorId === targetId) return { ok: false, reason: "self", message: "Ask another admin to reset your two-factor sign-in." };
  const [target] = await db.select({ email: user.email, twoFactorEnabled: user.twoFactorEnabled }).from(user).where(eq(user.id, targetId));
  if (!target) return { ok: false, reason: "not_found", message: "User not found" };
  await db.transaction(async (tx) => {
    await tx.delete(twoFactor).where(eq(twoFactor.userId, targetId));
    await tx.update(user).set({ twoFactorEnabled: false }).where(eq(user.id, targetId));
  });
  return { ok: true, email: target.email, wasEnabled: target.twoFactorEnabled === true };
}
