import { and, eq, isNull, lte, or, type SQL } from "drizzle-orm";
import { db } from "../db";
import { subscriptions, webhookEvents } from "../db/schema";

/**
 * Providers deliver webhooks at least once and not always in order. Two protections:
 *  - a ledger of event ids, so a redelivered event is acknowledged without being applied twice;
 *  - `subscriptions.last_event_at`, so an older event cannot overwrite what a newer one already wrote.
 */

/** Records the event. Returns false when it was already recorded (a redelivery). */
export async function claimWebhookEvent(provider: string, eventId: string | null | undefined): Promise<boolean> {
  if (!eventId) return true;
  const inserted = await db
    .insert(webhookEvents)
    .values({ provider, eventId })
    .onConflictDoNothing()
    .returning({ eventId: webhookEvents.eventId });
  return inserted.length > 0;
}

/** Forgets the event so the provider's retry is processed, used when handling it failed. */
export async function releaseWebhookEvent(provider: string, eventId: string | null | undefined): Promise<void> {
  if (!eventId) return;
  await db.delete(webhookEvents).where(and(eq(webhookEvents.provider, provider), eq(webhookEvents.eventId, eventId)));
}

/** Matches a subscription row only if no newer event has been applied to it. */
export function notNewerThan(eventTime: Date): SQL | undefined {
  return or(isNull(subscriptions.lastEventAt), lte(subscriptions.lastEventAt, eventTime));
}

/** Reads a timestamp that may be seconds, milliseconds or an ISO string; falls back to now. */
export function eventTimeOf(value: unknown): Date {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value < 1e12 ? value * 1000 : value);
  if (typeof value === "string") {
    const parsed = new Date(/^\d+$/.test(value) ? Number(value) * 1000 : value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}
