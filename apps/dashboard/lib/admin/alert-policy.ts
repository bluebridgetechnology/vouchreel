export type Severity = "ok" | "warning" | "critical";

export interface AlertState {
  severity: Severity;
  since: Date;
  lastNotifiedAt: Date | null;
  problemNotified: boolean;
}

/** A warning (for example a queue nobody is draining) must last this long before anyone is emailed. */
export const WARNING_GRACE_MS = 15 * 60 * 1000;
/** While a problem lasts, remind at most this often. */
export const REMINDER_MS = 6 * 60 * 60 * 1000;

export type AlertDecision = { action: "none" | "problem" | "recovery"; next: AlertState };

/**
 * Pure: given what was known at the last check and what is true now, whether to email, and the
 * state to store. A critical problem is reported at once; a warning only after it has lasted;
 * either repeats every six hours; a recovery email follows only if a problem email went out.
 */
export function decideAlert(prev: AlertState | null, current: Severity, now: Date): AlertDecision {
  const since = prev && prev.severity === current ? prev.since : now;
  const base: AlertState = { severity: current, since, lastNotifiedAt: prev?.lastNotifiedAt ?? null, problemNotified: prev?.problemNotified ?? false };

  if (current === "ok") {
    if (prev?.problemNotified) return { action: "recovery", next: { ...base, lastNotifiedAt: now, problemNotified: false } };
    return { action: "none", next: { ...base, problemNotified: false } };
  }

  const lasted = now.getTime() - since.getTime();
  const due = current === "critical" || lasted >= WARNING_GRACE_MS;
  const reminderDue = !base.lastNotifiedAt || now.getTime() - base.lastNotifiedAt.getTime() >= REMINDER_MS;
  if (due && reminderDue) return { action: "problem", next: { ...base, lastNotifiedAt: now, problemNotified: true } };
  return { action: "none", next: base };
}
