import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans, subscriptions, user } from "@/lib/db/schema";
import { isBilledByProvider } from "@/lib/admin/queries";

/**
 * Platform-admin changes to a customer account: the platform-admin flag, and a manually granted
 * plan. A plan that a payment provider bills (Stripe / Dodo) is never changed here, because the
 * customer would keep paying the old price: change it with the provider.
 */

export interface UserUpdate {
  /** Grant or revoke platform-admin access. */
  isPlatformAdmin?: boolean;
  /** A plan id to grant by hand, or null to remove a manual grant (back to the free tier). */
  planId?: string | null;
}

export type UserUpdateResult =
  | { ok: true; changes: Record<string, { from: unknown; to: unknown }>; email: string }
  | { ok: false; reason: "not_found" | "plan_not_found" | "self" | "billed_by_provider" | "nothing_to_change"; message: string };

export function updateAdminUser(actorId: string, targetId: string, input: UserUpdate): Promise<UserUpdateResult> {
  // One transaction: a plan change and an admin-flag change either both apply or neither does
  return db.transaction((tx) => applyUserUpdate(tx, actorId, targetId, input));
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function applyUserUpdate(tx: Tx, actorId: string, targetId: string, input: UserUpdate): Promise<UserUpdateResult> {
  const [target] = await tx.select().from(user).where(eq(user.id, targetId));
  if (!target) return { ok: false, reason: "not_found", message: "User not found." };

  const changes: Record<string, { from: unknown; to: unknown }> = {};

  if (input.isPlatformAdmin !== undefined && input.isPlatformAdmin !== target.isPlatformAdmin) {
    if (targetId === actorId) {
      return { ok: false, reason: "self", message: "You cannot change your own admin access. Ask another admin." };
    }
    changes.isPlatformAdmin = { from: target.isPlatformAdmin, to: input.isPlatformAdmin };
  }

  if (input.planId !== undefined) {
    const [current] = await db
      .select({ sub: subscriptions, planName: plans.name })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.userId, targetId))
      .then((r) => r);
    if (isBilledByProvider(current?.sub)) {
      return {
        ok: false,
        reason: "billed_by_provider",
        message: `This customer's ${current.planName} plan is billed by ${current.sub.provider ?? "the payment provider"}. Change or cancel it there, otherwise they keep paying the old price.`,
      };
    }

    if (input.planId === null) {
      if (current) {
        await tx.delete(subscriptions).where(eq(subscriptions.id, current.sub.id));
        changes.plan = { from: current.planName, to: null };
      }
    } else {
      const [plan] = await tx.select().from(plans).where(eq(plans.id, input.planId));
      if (!plan) return { ok: false, reason: "plan_not_found", message: "Plan not found." };
      if (!current || current.sub.planId !== plan.id || current.sub.status !== "active") {
        const values = { planId: plan.id, status: "active" as const, provider: "manual", providerCustomerId: null, providerSubscriptionId: null, currentPeriodEnd: null };
        if (current) await tx.update(subscriptions).set(values).where(eq(subscriptions.id, current.sub.id));
        else await tx.insert(subscriptions).values({ userId: targetId, ...values });
        changes.plan = { from: current?.planName ?? null, to: plan.name };
      }
    }
  }

  if (Object.keys(changes).length === 0) {
    return { ok: false, reason: "nothing_to_change", message: "Nothing to change." };
  }
  if (changes.isPlatformAdmin) {
    await tx.update(user).set({ isPlatformAdmin: input.isPlatformAdmin, updatedAt: new Date() }).where(eq(user.id, targetId));
  }
  return { ok: true, changes, email: target.email };
}
