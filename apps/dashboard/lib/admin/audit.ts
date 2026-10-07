import { db } from "@/lib/db";
import { adminAuditLog } from "@/lib/db/schema";
import { log } from "@/lib/log";

export interface AuditEntry {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  changes?: Record<string, unknown>;
}

/** Records a platform-admin action. Failures are logged, never thrown: auditing must not block the action. */
export async function logAdminAction(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(adminAuditLog).values({
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      changes: entry.changes ?? {},
    });
  } catch (error) {
    log.error("[audit] failed to record admin action:", error);
  }
}

/** Shallow diff of the fields that actually changed, for the audit trail. */
export function diffFields<T extends Record<string, unknown>>(before: T, after: Partial<T>): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const a = JSON.stringify(before[key]);
    const b = JSON.stringify(after[key as keyof T]);
    if (a !== b) out[key] = { from: before[key], to: after[key as keyof T] };
  }
  return out;
}
