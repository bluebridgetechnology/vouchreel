import { and, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationPreferences, notifications, spaces, user } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/transport";
import { renderEmail } from "@/lib/email/templates";
import { NOTIFICATION_CATALOG, resolvePrefs, type NotificationType } from "./catalog";
import { log } from "@/lib/log";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  /** App-relative link, e.g. /spaces/123/collect */
  href?: string;
  metadata?: Record<string, unknown>;
  /** Collapse repeats: skip if an unread notification with this key exists inside the window. */
  dedupeKey?: string;
  dedupeWindowMs?: number;
}

export interface CreateNotificationResult {
  created: boolean;
  emailed: boolean;
}

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

/**
 * Records an in-app notification and/or emails it, according to the user's preferences.
 * Fire-and-forget safe: it never throws, because a failed notification must not fail the
 * action that triggered it.
 */
export async function createNotification(input: CreateNotificationInput): Promise<CreateNotificationResult> {
  const result: CreateNotificationResult = { created: false, emailed: false };
  try {
    const [override] = await db
      .select({ inApp: notificationPreferences.inApp, email: notificationPreferences.email })
      .from(notificationPreferences)
      .where(and(eq(notificationPreferences.userId, input.userId), eq(notificationPreferences.type, input.type)));
    const prefs = resolvePrefs(input.type, override);
    if (!prefs.inApp && !prefs.email) return result;

    if (input.dedupeKey) {
      const since = new Date(Date.now() - (input.dedupeWindowMs ?? 24 * 60 * 60 * 1000));
      const [existing] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, input.userId),
            eq(notifications.dedupeKey, input.dedupeKey),
            isNull(notifications.readAt),
            gte(notifications.createdAt, since)
          )
        );
      if (existing) return result;
    }

    if (prefs.inApp) {
      await db.insert(notifications).values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        dedupeKey: input.dedupeKey ?? null,
        metadata: input.metadata ?? {},
      });
      result.created = true;
    }

    if (prefs.email) {
      const [recipient] = await db.select({ email: user.email }).from(user).where(eq(user.id, input.userId));
      if (recipient?.email) {
        const { html, text } = renderEmail({
          title: input.title,
          body: input.body,
          cta: input.href ? { label: "Open in Vouchreel", url: `${appUrl()}${input.href}` } : null,
        });
        const sent = await sendEmail({
          to: recipient.email,
          subject: `${input.title} · ${NOTIFICATION_CATALOG[input.type].label}`,
          text,
          html,
        });
        result.emailed = sent.sent;
      }
    }
  } catch (error) {
    log.error(`[notifications] failed to create ${input.type}:`, error);
  }
  return result;
}

/** Notifies the owner of a space (the account that pays and manages it). */
export async function notifySpaceOwner(
  spaceId: string,
  input: Omit<CreateNotificationInput, "userId">
): Promise<CreateNotificationResult> {
  try {
    const [space] = await db.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId));
    if (!space) return { created: false, emailed: false };
    return createNotification({ ...input, userId: space.ownerId });
  } catch (error) {
    log.error("[notifications] owner lookup failed:", error);
    return { created: false, emailed: false };
  }
}
