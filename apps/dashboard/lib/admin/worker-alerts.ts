import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminAlertState, user } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/transport";
import { renderEmail } from "@/lib/email/templates";
import { getWorkerHealth, type KindHealth } from "@/lib/admin/workers";
import { decideAlert, type AlertState, type Severity } from "@/lib/admin/alert-policy";

/** Email addresses of everyone who can open the Admin area and is not suspended. */
export async function platformAdminEmails(): Promise<string[]> {
  const rows = await db.select({ email: user.email }).from(user).where(and(eq(user.isPlatformAdmin, true), isNull(user.suspendedAt)));
  return rows.map((r) => r.email);
}

function message(kind: KindHealth, action: "problem" | "recovery") {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const cta = { label: "Open the System tab", url: `${appUrl}/admin?tab=system` };
  if (action === "recovery") {
    return { subject: `${kind.label} is back`, ...renderEmail({ title: `${kind.label} is back`, body: kind.message, cta, footer: "You get this because you are a platform admin on Vouchreel." }) };
  }
  return {
    subject: `${kind.label} needs attention`,
    ...renderEmail({ title: `${kind.label} needs attention`, body: kind.message, cta, footer: "You get this because you are a platform admin on Vouchreel. It repeats at most every six hours while the problem lasts." }),
  };
}

export interface AlertRun {
  checked: number;
  sent: { key: string; action: "problem" | "recovery"; to: number }[];
}

/**
 * Checks each kind of worker and emails the platform admins when one has a problem, and when it
 * recovers. Meant to be called by a cron, which keeps running when the workers do not.
 */
export async function runWorkerAlerts(now = new Date()): Promise<AlertRun> {
  const health = await getWorkerHealth(now);
  const sent: AlertRun["sent"] = [];

  for (const kind of health.kinds) {
    const key = `worker:${kind.kind}`;
    const [row] = await db.select().from(adminAlertState).where(eq(adminAlertState.key, key));
    const prev: AlertState | null = row ? { severity: row.severity as Severity, since: row.since, lastNotifiedAt: row.lastNotifiedAt, problemNotified: row.problemNotified } : null;
    const decision = decideAlert(prev, kind.severity, now);
    let next = decision.next;

    if (decision.action !== "none") {
      const to = await platformAdminEmails();
      const mail = message(kind, decision.action);
      let delivered = 0;
      for (const address of to) {
        const result = await sendEmail({ to: address, subject: mail.subject, text: mail.text, html: mail.html });
        // With no email provider configured the message is only logged, and retrying would not help
        if (result.sent || result.provider === "log") delivered++;
      }
      if (to.length > 0 && delivered === 0) {
        // Nothing went out: keep the old notification state so the next run tries again
        next = { ...decision.next, lastNotifiedAt: prev?.lastNotifiedAt ?? null, problemNotified: prev?.problemNotified ?? false };
      } else {
        sent.push({ key, action: decision.action, to: delivered });
      }
    }

    await db
      .insert(adminAlertState)
      .values({ key, severity: next.severity, since: next.since, lastNotifiedAt: next.lastNotifiedAt, problemNotified: next.problemNotified })
      .onConflictDoUpdate({ target: adminAlertState.key, set: { severity: next.severity, since: next.since, lastNotifiedAt: next.lastNotifiedAt, problemNotified: next.problemNotified } });
  }
  return { checked: health.kinds.length, sent };
}
