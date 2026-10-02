import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationPreferences, notifications } from "@/lib/db/schema";
import { NOTIFICATION_CATALOG, NOTIFICATION_TYPES, resolvePrefs, type ChannelPrefs, type NotificationType } from "./catalog";

export async function listNotifications(userId: string, limit = 20) {
  const [items, [unread]] = await Promise.all([
    db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        href: notifications.href,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100)),
    db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);
  return { items, unreadCount: unread?.value ?? 0 };
}

/** Marks specific notifications (or all) as read. Scoped to the user, so ids cannot leak across accounts. */
export async function markNotificationsRead(userId: string, ids?: string[]) {
  const conditions = [eq(notifications.userId, userId), isNull(notifications.readAt)];
  if (ids) {
    if (ids.length === 0) return;
    conditions.push(inArray(notifications.id, ids));
  }
  await db.update(notifications).set({ readAt: new Date() }).where(and(...conditions));
}

export interface PreferenceRow extends ChannelPrefs {
  type: NotificationType;
  label: string;
  description: string;
}

export async function getPreferences(userId: string): Promise<PreferenceRow[]> {
  const rows = await db
    .select({ type: notificationPreferences.type, inApp: notificationPreferences.inApp, email: notificationPreferences.email })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));
  const byType = new Map(rows.map((r) => [r.type, r]));
  return NOTIFICATION_TYPES.map((type) => ({
    type,
    label: NOTIFICATION_CATALOG[type].label,
    description: NOTIFICATION_CATALOG[type].description,
    ...resolvePrefs(type, byType.get(type)),
  }));
}

export async function setPreference(userId: string, type: NotificationType, prefs: Partial<ChannelPrefs>) {
  const next = resolvePrefs(type, prefs);
  await db
    .insert(notificationPreferences)
    .values({ userId, type, ...next })
    .onConflictDoUpdate({
      target: [notificationPreferences.userId, notificationPreferences.type],
      set: { ...next, updatedAt: new Date() },
    });
}
