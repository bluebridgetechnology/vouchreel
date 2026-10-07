import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { creditAdjustments, user } from "@/lib/db/schema";

export type CreditKind = "review" | "ai";

/** "YYYY-MM" in UTC, the month credits are counted in. */
export function monthKey(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/** An unlimited plan stays unlimited; otherwise the plan's allowance plus this month's adjustments, never below zero. */
export function applyAdjustment(limit: number, adjustment: number): number {
  if (!Number.isFinite(limit)) return limit;
  return Math.max(0, limit + adjustment);
}

/** Net adjustment per owner for one kind in the month. Owners without any are absent from the map. */
export async function adjustmentsFor(ownerIds: string[], kind: CreditKind, now = new Date()): Promise<Map<string, number>> {
  if (ownerIds.length === 0) return new Map();
  const rows = await db
    .select({ userId: creditAdjustments.userId, total: sql<number>`sum(${creditAdjustments.amount})::int` })
    .from(creditAdjustments)
    .where(and(inArray(creditAdjustments.userId, ownerIds), eq(creditAdjustments.kind, kind), eq(creditAdjustments.month, monthKey(now))))
    .groupBy(creditAdjustments.userId);
  return new Map(rows.map((r) => [r.userId, r.total]));
}

export async function adjustmentFor(ownerId: string, kind: CreditKind, now = new Date()): Promise<number> {
  return (await adjustmentsFor([ownerId], kind, now)).get(ownerId) ?? 0;
}

export const MAX_ADJUSTMENT = 1000;

export type AdjustResult =
  | { ok: true; id: string; email: string }
  | { ok: false; reason: "not_found" | "invalid"; message: string };

/** Records an adjustment for the current month. */
export async function addAdjustment(actorId: string, targetId: string, input: { kind: CreditKind; amount: number; reason: string }, now = new Date()): Promise<AdjustResult> {
  const reason = input.reason?.trim();
  if (!Number.isInteger(input.amount) || input.amount === 0 || Math.abs(input.amount) > MAX_ADJUSTMENT) {
    return { ok: false, reason: "invalid", message: `The amount must be a whole number other than zero, up to ${MAX_ADJUSTMENT} either way.` };
  }
  if (!reason) return { ok: false, reason: "invalid", message: "Give a reason." };
  const [target] = await db.select({ email: user.email }).from(user).where(eq(user.id, targetId));
  if (!target) return { ok: false, reason: "not_found", message: "User not found." };
  const [row] = await db
    .insert(creditAdjustments)
    .values({ userId: targetId, kind: input.kind, amount: input.amount, month: monthKey(now), reason, actorId })
    .returning({ id: creditAdjustments.id });
  return { ok: true, id: row.id, email: target.email };
}

export interface AdjustmentRow {
  id: string;
  kind: CreditKind;
  amount: number;
  reason: string;
  month: string;
  createdAt: Date;
  actorEmail: string | null;
}

/** This month's adjustments for one account, newest first. */
export async function listAdjustments(targetId: string, now = new Date()): Promise<AdjustmentRow[]> {
  return db
    .select({
      id: creditAdjustments.id,
      kind: creditAdjustments.kind,
      amount: creditAdjustments.amount,
      reason: creditAdjustments.reason,
      month: creditAdjustments.month,
      createdAt: creditAdjustments.createdAt,
      actorEmail: user.email,
    })
    .from(creditAdjustments)
    .leftJoin(user, eq(creditAdjustments.actorId, user.id))
    .where(and(eq(creditAdjustments.userId, targetId), eq(creditAdjustments.month, monthKey(now))))
    .orderBy(desc(creditAdjustments.createdAt));
}
