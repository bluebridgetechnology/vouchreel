import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getSubscriptionLimits } from "@/lib/payments/subscription";
import { clampedPage } from "@/lib/admin/paging";
import { startOfMonthUtc } from "@/lib/ai-video/credits";

/**
 * Platform-admin view of video credit use. The counting rules mirror the ones that gate creation
 * (lib/review-video/service.ts and lib/ai-video/credits.ts), so what is shown here is what a
 * customer's allowance is checked against:
 *  - credits are per account (space owner) and per UTC calendar month;
 *  - a review video counts from when it was created, an AI video from when its script was approved;
 *  - queued, rendering and done videos hold their credit, failed ones do not (the refund);
 *  - a video the owner deleted still counts, because its row stays.
 */

export const USAGE_PAGE_SIZE = 25;

export interface UsageTotals {
  reviewCredits: number;
  aiCredits: number;
  /** Provider spend on AI videos in the month, in cents, including failed attempts. */
  aiCostCents: number;
  /** Videos that failed (their credit was refunded). */
  failed: number;
  /** Videos created or approved in the month, any status. */
  videos: number;
  /** Accounts that used any credit. */
  accounts: number;
  /** Mean render time of finished review videos, in ms; null when there are none. */
  avgReviewRenderMs: number | null;
}

export interface UsageAccount {
  ownerId: string;
  name: string;
  email: string;
  planName: string | null;
  reviewCredits: number;
  /** Monthly allowance; Infinity is unlimited and 0 means the plan does not include it. */
  reviewLimit: number;
  aiCredits: number;
  aiLimit: number;
  aiCostCents: number;
  failed: number;
}

export interface UsageReport {
  /** First day of the month shown, YYYY-MM. */
  month: string;
  totals: UsageTotals;
  accounts: UsageAccount[];
  /** Accounts in the table: those that used credit or had a failed video. */
  totalAccounts: number;
  page: number;
  pageSize: number;
}

/** Accepts "YYYY-MM" for a real month; anything else means the current one. */
export function parseMonth(text: string | undefined, now = new Date()): { month: string; from: Date; to: Date } {
  const match = text ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(text) : null;
  const from = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)) : startOfMonthUtc(now);
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  return { month: from.toISOString().slice(0, 7), from, to };
}

/** One row per video that belongs to the month, with its credits split by kind. */
function usageRows(from: Date, to: Date) {
  const f = from.toISOString();
  const t = to.toISOString();
  return sql`
    SELECT s.owner_id,
      CASE WHEN rv.status IN ('queued', 'rendering', 'done') THEN rv.credits_used ELSE 0 END AS review_credits,
      0 AS ai_credits,
      0 AS cost_cents,
      CASE WHEN rv.status = 'failed' THEN 1 ELSE 0 END AS failed,
      CASE WHEN rv.status = 'done' THEN rv.render_ms END AS render_ms
    FROM review_videos rv JOIN spaces s ON s.id = rv.space_id
    WHERE rv.created_at >= ${f}::timestamptz AND rv.created_at < ${t}::timestamptz
    UNION ALL
    SELECT s.owner_id,
      0,
      CASE WHEN gv.status IN ('queued', 'rendering', 'done') THEN gv.credits_used ELSE 0 END,
      coalesce(gv.cost_cents, 0),
      CASE WHEN gv.status = 'failed' THEN 1 ELSE 0 END,
      NULL
    FROM generated_videos gv JOIN spaces s ON s.id = gv.space_id
    WHERE gv.trim_approved_at >= ${f}::timestamptz AND gv.trim_approved_at < ${t}::timestamptz`;
}

export async function getUsageReport(monthText?: string, page = 1, pageSize = USAGE_PAGE_SIZE, now = new Date()): Promise<UsageReport> {
  const report = await clampedPage(
    async (p) => {
      const r = await usageReportAt(monthText, p, pageSize, now);
      return Object.assign(r, { total: r.totalAccounts });
    },
    page,
    pageSize
  );
  return report;
}

async function usageReportAt(monthText: string | undefined, page: number, pageSize: number, now: Date): Promise<UsageReport> {
  const { month, from, to } = parseMonth(monthText, now);
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;

  const totalsResult = await db.execute(sql`
    WITH u AS (${usageRows(from, to)})
    SELECT coalesce(sum(review_credits), 0)::int AS "reviewCredits",
      coalesce(sum(ai_credits), 0)::int AS "aiCredits",
      coalesce(sum(cost_cents), 0)::int AS "aiCostCents",
      coalesce(sum(failed), 0)::int AS "failed",
      count(*)::int AS "videos",
      count(DISTINCT owner_id) FILTER (WHERE review_credits > 0 OR ai_credits > 0)::int AS "accounts",
      count(DISTINCT owner_id)::int AS "listedAccounts",
      round(avg(render_ms))::int AS "avgReviewRenderMs"
    FROM u`);
  const { listedAccounts, ...totals } = totalsResult.rows[0] as unknown as UsageTotals & { listedAccounts: number };

  // Accounts that used credit or had a failure, heaviest users first
  const rowsResult = await db.execute(sql`
    WITH u AS (${usageRows(from, to)}),
    per AS (
      SELECT owner_id, sum(review_credits)::int AS review_credits, sum(ai_credits)::int AS ai_credits,
        sum(cost_cents)::int AS cost_cents, sum(failed)::int AS failed
      FROM u GROUP BY owner_id
    )
    SELECT per.owner_id AS "ownerId", usr.name, usr.email, p.name AS "planName",
      per.review_credits AS "reviewCredits", per.ai_credits AS "aiCredits",
      per.cost_cents AS "aiCostCents", per.failed
    FROM per
    JOIN "user" usr ON usr.id = per.owner_id
    LEFT JOIN subscriptions sub ON sub.user_id = per.owner_id AND sub.status IN ('active', 'trialing')
    LEFT JOIN plans p ON p.id = sub.plan_id
    ORDER BY per.review_credits + per.ai_credits DESC, per.cost_cents DESC, usr.email
    LIMIT ${pageSize} OFFSET ${(safePage - 1) * pageSize}`);

  type Row = Omit<UsageAccount, "reviewLimit" | "aiLimit">;
  const rows = rowsResult.rows as unknown as Row[];
  // Limits come from the same resolver that gates creation, so free-tier and legacy plans match
  const accounts = await Promise.all(
    rows.map(async (r): Promise<UsageAccount> => {
      const limits = await getSubscriptionLimits(r.ownerId);
      return { ...r, reviewLimit: limits.reviewVideoCredits, aiLimit: limits.aiVideoCredits };
    })
  );

  return { month, totals, accounts, totalAccounts: listedAccounts, page: safePage, pageSize };
}

export type LimitState = "none" | "ok" | "at" | "over" | "unlimited" | "not_in_plan";

/** How an account's use compares with its allowance. */
export function limitState(used: number, limit: number): LimitState {
  if (limit === Infinity) return "unlimited";
  if (limit <= 0) return used > 0 ? "over" : "not_in_plan";
  if (used > limit) return "over";
  if (used === limit) return "at";
  return used === 0 ? "none" : "ok";
}

export function formatLimit(limit: number): string {
  return limit === Infinity ? "unlimited" : String(limit);
}

export const formatUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** Month before or after `month` (YYYY-MM). */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}
