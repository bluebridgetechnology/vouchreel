import { and, count, desc, eq, gte, ilike, inArray, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { clampedPage } from "@/lib/admin/paging";
import { adminAuditLog, plans, spaces, subscriptions, user } from "@/lib/db/schema";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  isPlatformAdmin: boolean;
  /** When an admin suspended the account, if they did. */
  suspendedAt: Date | null;
  suspendedReason: string | null;
  /** Signs in with an authenticator app. */
  twoFactorEnabled: boolean;
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
export function listAdminUsers(q?: string, page = 1, pageSize = USERS_PAGE_SIZE): Promise<AdminUserPage> {
  return clampedPage((p) => listAdminUsersAt(q, p, pageSize), page, pageSize);
}

async function listAdminUsersAt(q: string | undefined, page: number, pageSize: number): Promise<AdminUserPage> {
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
      suspendedAt: user.suspendedAt,
      suspendedReason: user.suspendedReason,
      twoFactorEnabled: user.twoFactorEnabled,
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
        twoFactorEnabled: r.twoFactorEnabled === true,
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
  entityId: string | null;
  summary: string;
  changes: Record<string, unknown>;
  actorEmail: string | null;
  createdAt: Date;
}

export interface AuditFilter {
  /** Matches the summary, the action name or the actor's email (case-insensitive, literal text). */
  q?: string;
  /** Exact entity type, e.g. "plan", "user", "job", "setting". */
  entityType?: string;
  /** Inclusive UTC dates as YYYY-MM-DD. Anything else is ignored. */
  from?: string;
  to?: string;
}

export interface AuditPage {
  rows: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
}

export const AUDIT_PAGE_SIZE = 50;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Start of the given UTC day, or null when the text is not a real date. */
function utcDay(text: string | undefined, addDays = 0): Date | null {
  if (!text || !DATE.test(text)) return null;
  const d = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== text) return null;
  d.setUTCDate(d.getUTCDate() + addDays);
  return d;
}

/** Escapes LIKE wildcards so "100%" or "a_b" is searched literally. */
export function likeLiteral(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function auditWhere(filter: AuditFilter) {
  const term = filter.q?.trim();
  const from = utcDay(filter.from);
  const toExclusive = utcDay(filter.to, 1);
  return and(
    filter.entityType ? eq(adminAuditLog.entityType, filter.entityType) : undefined,
    term
      ? or(
          ilike(adminAuditLog.summary, `%${likeLiteral(term)}%`),
          ilike(adminAuditLog.action, `%${likeLiteral(term)}%`),
          ilike(user.email, `%${likeLiteral(term)}%`)
        )
      : undefined,
    from ? gte(adminAuditLog.createdAt, from) : undefined,
    toExclusive ? lt(adminAuditLog.createdAt, toExclusive) : undefined
  );
}

/** Newest first, filtered and paged. Page numbers below 1 or not numeric fall back to 1. */
export function listAuditLog(filter: AuditFilter = {}, page = 1, pageSize = AUDIT_PAGE_SIZE): Promise<AuditPage> {
  return clampedPage((p) => listAuditLogAt(filter, p, pageSize), page, pageSize);
}

async function listAuditLogAt(filter: AuditFilter, page: number, pageSize: number): Promise<AuditPage> {
  const where = auditWhere(filter);
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(adminAuditLog)
    .leftJoin(user, eq(adminAuditLog.actorId, user.id))
    .where(where);

  const rows = await db
    .select({
      id: adminAuditLog.id,
      action: adminAuditLog.action,
      entityType: adminAuditLog.entityType,
      entityId: adminAuditLog.entityId,
      summary: adminAuditLog.summary,
      changes: adminAuditLog.changes,
      actorEmail: user.email,
      createdAt: adminAuditLog.createdAt,
    })
    .from(adminAuditLog)
    .leftJoin(user, eq(adminAuditLog.actorId, user.id))
    .where(where)
    .orderBy(desc(adminAuditLog.createdAt), desc(adminAuditLog.id))
    .limit(pageSize)
    .offset((safePage - 1) * pageSize);

  return { rows, total, page: safePage, pageSize };
}

/** Entity types that appear in the log, for the filter menu. */
export async function listAuditEntityTypes(): Promise<string[]> {
  const rows = await db.selectDistinct({ type: adminAuditLog.entityType }).from(adminAuditLog).orderBy(adminAuditLog.entityType);
  return rows.map((r) => r.type);
}
