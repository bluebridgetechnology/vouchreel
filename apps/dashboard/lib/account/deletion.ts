import { createHmac, timingSafeEqual } from "node:crypto";
import { and, count, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { account, spaces, subscriptions, teamMembers, user } from "@/lib/db/schema";
import { collectSpaceUrls, queueFileCleanup } from "@/lib/storage/cleanup";
import { createPaymentProvider } from "@/lib/payments";
import { sendEmail } from "@/lib/email/transport";
import { renderEmail } from "@/lib/email/templates";
import { log } from "@/lib/log";

/**
 * Deleting your own account. The flow is: password (when the account has one), then a link emailed to
 * the address on file, then the deletion itself: the subscription is cancelled with the payment
 * provider, every file the account owns is queued for removal, and the account row is deleted (the
 * database cascades the rest). Immediate after confirmation, no grace period.
 */

export const DELETE_LINK_MINUTES = 60;

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET is required to sign account links");
  return value;
}

const sign = (userId: string, expires: number) => createHmac("sha256", secret()).update(`account-delete:${userId}:${expires}`).digest("hex");

/** A link token for this account that stops working after an hour. */
export function deletionToken(userId: string, now = Date.now()): string {
  const expires = now + DELETE_LINK_MINUTES * 60_000;
  return `${userId}.${expires}.${sign(userId, expires)}`;
}

/** The account id inside a valid, unexpired token, or null. */
export function userIdFromDeletionToken(token: string, now = Date.now()): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresRaw, signature] = parts;
  const expires = Number(expiresRaw);
  if (!userId || !Number.isFinite(expires) || expires < now) return null;
  const expected = Buffer.from(sign(userId, expires), "hex");
  const given = Buffer.from(signature, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return userId;
}

export interface DeletionBlocker {
  code: "team_members" | "last_admin";
  message: string;
}

/** Reasons this account cannot be deleted yet. Empty means it can. */
export async function deletionBlockers(userId: string): Promise<DeletionBlocker[]> {
  const blockers: DeletionBlocker[] = [];
  const [{ n: members }] = await db
    .select({ n: count() })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamOwnerId, userId), ne(teamMembers.userId, userId)));
  if (members > 0) {
    blockers.push({ code: "team_members", message: "Your account still has team members. Remove them first (Settings, Team Members), so nobody loses access by surprise." });
  }
  const [self] = await db.select({ isPlatformAdmin: user.isPlatformAdmin }).from(user).where(eq(user.id, userId));
  if (self?.isPlatformAdmin) {
    const [{ n: others }] = await db
      .select({ n: count() })
      .from(user)
      .where(and(eq(user.isPlatformAdmin, true), ne(user.id, userId)));
    if (others === 0) blockers.push({ code: "last_admin", message: "You are the only platform admin. Make someone else an admin first." });
  }
  return blockers;
}

/** True when the account signs in with a password (an account made only with Google has none). */
export async function hasPassword(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ password: account.password })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
  return !!row?.password;
}

export async function verifyPassword(userId: string, password: string): Promise<boolean> {
  const [row] = await db
    .select({ password: account.password })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
  if (!row?.password) return false;
  const { auth } = await import("@/lib/auth/auth");
  const ctx = await auth.$context;
  return ctx.password.verify({ hash: row.password, password });
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function sendDeletionEmail(userId: string): Promise<{ sent: boolean }> {
  const [row] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
  if (!row) return { sent: false };
  const url = `${appUrl()}/account/delete?token=${encodeURIComponent(deletionToken(userId))}`;
  const { html, text } = renderEmail({
    title: "Confirm deleting your Vouchreel account",
    body: `This permanently deletes your account, your spaces, testimonials, videos and settings. It cannot be undone. The link works for ${DELETE_LINK_MINUTES} minutes. If you did not ask for this, ignore this email and consider changing your password.`,
    cta: { label: "Review and delete my account", url },
    footer: "For your security, never forward this email.",
  });
  const result = await sendEmail({ to: row.email, subject: "Confirm deleting your Vouchreel account", text, html });
  return { sent: result.sent || result.provider === "log" };
}

export type DeleteResult = { ok: true; files: number; cancelledSubscription: boolean } | { ok: false; reason: "not_found" | "blocked"; blockers?: DeletionBlocker[] };

/** Cancels the subscription, queues the account's files, and deletes the account, in that order. */
export async function deleteAccount(userId: string): Promise<DeleteResult> {
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.id, userId));
  if (!row) return { ok: false, reason: "not_found" };
  const blockers = await deletionBlockers(userId);
  if (blockers.length) return { ok: false, reason: "blocked", blockers };

  // The provider first: if it refuses, nothing has been deleted and the person can try again
  let cancelledSubscription = false;
  const subs = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
  for (const sub of subs) {
    if (!sub.providerSubscriptionId || (sub.provider !== "stripe" && sub.provider !== "dodo")) continue; // granted by an admin: nothing to cancel
    if (sub.status === "canceled") continue;
    await createPaymentProvider(sub.provider).cancelSubscription(sub.providerSubscriptionId);
    cancelledSubscription = true;
  }

  const files = await db.transaction(async (tx) => {
    const owned = await tx.select({ id: spaces.id }).from(spaces).where(eq(spaces.ownerId, userId));
    let queued = 0;
    for (const space of owned) queued += await queueFileCleanup(await collectSpaceUrls(tx, space.id), tx);
    await tx.delete(user).where(inArray(user.id, [userId]));
    return queued;
  });
  log.info("[account] deleted", { userId, files, cancelledSubscription });
  return { ok: true, files, cancelledSubscription };
}
