import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { generatedVideos, spaces } from "@/lib/db/schema";
import { getSubscriptionLimits } from "@/lib/payments/subscription";

export interface AiVideoCredits {
  /** Monthly allowance (Infinity = unlimited, 0 = feature not in the plan). */
  limit: number;
  used: number;
  remaining: number;
}

export function startOfMonthUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Statuses that hold a credit. A failed render is excluded, which is the refund. */
const CREDIT_HOLDING = ["queued", "rendering", "done"] as const;

type Executor = Pick<typeof db, "select">;

/** Credits are per account (space owner), counted from when the owner approved the script. */
export async function getAiVideoCredits(ownerId: string, executor: Executor = db, now = new Date()): Promise<AiVideoCredits> {
  const limits = await getSubscriptionLimits(ownerId);
  const [row] = await executor
    .select({ used: sql<number>`coalesce(sum(${generatedVideos.creditsUsed}), 0)::int` })
    .from(generatedVideos)
    .innerJoin(spaces, eq(spaces.id, generatedVideos.spaceId))
    .where(
      and(
        eq(spaces.ownerId, ownerId),
        inArray(generatedVideos.status, [...CREDIT_HOLDING]),
        gte(generatedVideos.trimApprovedAt, startOfMonthUtc(now))
      )
    );
  const used = row?.used ?? 0;
  const limit = limits.aiVideoCredits;
  return { limit, used, remaining: Math.max(0, limit - used) };
}
