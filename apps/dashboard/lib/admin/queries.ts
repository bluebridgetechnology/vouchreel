import { count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminAuditLog, plans, spaces, subscriptions, user } from "@/lib/db/schema";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  isPlatformAdmin: boolean;
  createdAt: Date;
  planName: string | null;
  subscriptionStatus: string | null;
  spaceCount: number;
}

/** Customers with their plan and space count. `q` matches name or email. */
export async function listAdminUsers(q?: string, limit = 100): Promise<AdminUserRow[]> {
  const term = q?.trim();
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(term ? or(ilike(user.email, `%${term}%`), ilike(user.name, `%${term}%`)) : undefined)
    .orderBy(desc(user.createdAt))
    .limit(limit);
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [subs, spaceCounts] = await Promise.all([
    db
      .select({ userId: subscriptions.userId, status: subscriptions.status, planName: plans.name })
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
  return rows.map((r) => ({
    ...r,
    planName: subByUser.get(r.id)?.planName ?? null,
    subscriptionStatus: subByUser.get(r.id)?.status ?? null,
    spaceCount: spacesByUser.get(r.id) ?? 0,
  }));
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
