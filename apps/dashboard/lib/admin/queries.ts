import { count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminAuditLog, plans, spaces, subscriptions, user } from "@/lib/db/schema";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  isPlatformAdmin: boolean;
  createdAt: Date;
  planId: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  /** Billing provider of the subscription: "stripe", "dodo", or "manual" for an admin-granted plan. */
  subscriptionProvider: string | null;
  /** True when a payment provider bills this subscription, so its plan must be changed there. */
  billedByProvider: boolean;
  spaceCount: number;
}

export interface AdminUserPage {
  rows: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
}

export const USERS_PAGE_SIZE = 25;

/** Customers with their plan and space count, newest first. `q` matches name or email. */
export async function listAdminUsers(q?: string, page = 1, pageSize = USERS_PAGE_SIZE): Promise<AdminUserPage> {
  const term = q?.trim();
  const where = term ? or(ilike(user.email, `%${term}%`), ilike(user.name, `%${term}%`)) : undefined;
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;

  const [{ value: total }] = await db.select({ value: count() }).from(user).where(where);
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(where)
    .orderBy(desc(user.createdAt), user.id)
    .limit(pageSize)
    .offset((safePage - 1) * pageSize);
  if (rows.length === 0) return { rows: [], total, page: safePage, pageSize };

  const ids = rows.map((r) => r.id);
  const [subs, spaceCounts] = await Promise.all([
    db
      .select({
        userId: subscriptions.userId,
        status: subscriptions.status,
        provider: subscriptions.provider,
        providerSubscriptionId: subscriptions.providerSubscriptionId,
        planId: plans.id,
        planName: plans.name,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(inArray(subscriptions.userId, ids)),
    db
      .select({ ownerId: spaces.ownerId, value: count() })
      .from(spaces)
      .where(inArray(spaces.ownerId, ids))
      .groupBy(spaces.ownerId),
  ]);

  const subByUser = new Map(subs.map((s) => [s.userId, s]));
  const spacesByUser = new Map(spaceCounts.map((s) => [s.ownerId, s.value]));
  return {
    rows: rows.map((r) => {
      const sub = subByUser.get(r.id);
      return {
        ...r,
        planId: sub?.planId ?? null,
        planName: sub?.planName ?? null,
        subscriptionStatus: sub?.status ?? null,
        subscriptionProvider: sub?.provider ?? null,
        billedByProvider: isBilledByProvider(sub),
        spaceCount: spacesByUser.get(r.id) ?? 0,
      };
    }),
    total,
    page: safePage,
    pageSize,
  };
}

/** A live subscription that a payment provider bills: changing it here would not change what the customer pays. */
export function isBilledByProvider(sub: { providerSubscriptionId: string | null; status: string } | null | undefined): boolean {
  return !!sub?.providerSubscriptionId && sub.status !== "canceled";
}

export interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  summary: string;
  actorEmail: string | null;
  createdAt: Date;
}

export async function listAuditLog(limit = 100): Promise<AuditRow[]> {
  return db
    .select({
      id: adminAuditLog.id,
      action: adminAuditLog.action,
      entityType: adminAuditLog.entityType,
      summary: adminAuditLog.summary,
      actorEmail: user.email,
      createdAt: adminAuditLog.createdAt,
    })
    .from(adminAuditLog)
    .leftJoin(user, eq(adminAuditLog.actorId, user.id))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit);
}
