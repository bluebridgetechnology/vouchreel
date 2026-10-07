import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { session as sessions, user } from "@/lib/db/schema";

export type SuspensionResult =
  | { ok: true; email: string; changed: boolean }
  | { ok: false; reason: "not_found" | "self" | "admin" | "reason_required"; message: string };

/**
 * Suspends or restores an account. A suspended person cannot sign in and an open session stops
 * working on its next request; their data, spaces and public widgets are left as they are.
 * Never yourself, and never another platform admin (remove their admin access first, so two
 * admins cannot lock each other out by accident).
 */
export async function setSuspended(actorId: string, targetId: string, suspended: boolean, reason?: string | null): Promise<SuspensionResult> {
  return db.transaction(async (tx) => {
    const [target] = await tx.select().from(user).where(eq(user.id, targetId));
    if (!target) return { ok: false, reason: "not_found", message: "User not found." };
    if (suspended) {
      if (targetId === actorId) return { ok: false, reason: "self", message: "You cannot suspend your own account." };
      if (target.isPlatformAdmin) return { ok: false, reason: "admin", message: "Remove this person's admin access before suspending them." };
      if (!reason?.trim()) return { ok: false, reason: "reason_required", message: "Give a reason: the person sees it when they try to sign in." };
    }
    const already = !!target.suspendedAt === suspended;
    if (already) return { ok: true, email: target.email, changed: false };

    await tx
      .update(user)
      .set(suspended ? { suspendedAt: new Date(), suspendedReason: reason!.trim(), updatedAt: new Date() } : { suspendedAt: null, suspendedReason: null, updatedAt: new Date() })
      .where(eq(user.id, targetId));
    // Sign them out everywhere now, rather than waiting for the cookie cache to run out
    if (suspended) await tx.delete(sessions).where(eq(sessions.userId, targetId));
    return { ok: true, email: target.email, changed: true };
  });
}
