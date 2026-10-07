import { describe, expect, it } from "vitest";
import { REMINDER_MS, WARNING_GRACE_MS, decideAlert, type AlertState } from "../alert-policy";

const t0 = new Date("2026-10-07T10:00:00Z");
const after = (ms: number) => new Date(t0.getTime() + ms);
const state = (over: Partial<AlertState>): AlertState => ({ severity: "ok", since: t0, lastNotifiedAt: null, problemNotified: false, ...over });

describe("decideAlert", () => {
  it("says nothing while all is well", () => {
    expect(decideAlert(null, "ok", t0).action).toBe("none");
    expect(decideAlert(state({}), "ok", after(60_000)).action).toBe("none");
  });

  it("reports a critical problem at once, once", () => {
    const first = decideAlert(state({}), "critical", t0);
    expect(first.action).toBe("problem");
    expect(first.next).toMatchObject({ severity: "critical", problemNotified: true, lastNotifiedAt: t0 });
    // The next check, five minutes later, stays quiet
    expect(decideAlert(first.next, "critical", after(5 * 60_000)).action).toBe("none");
  });

  it("repeats a lasting problem after the reminder interval, not before", () => {
    const first = decideAlert(null, "critical", t0).next;
    expect(decideAlert(first, "critical", after(REMINDER_MS - 1)).action).toBe("none");
    expect(decideAlert(first, "critical", after(REMINDER_MS)).action).toBe("problem");
  });

  it("holds back a warning until it has lasted, then reports it", () => {
    const start = decideAlert(null, "warning", t0);
    expect(start.action).toBe("none");
    expect(start.next.since).toEqual(t0);
    expect(decideAlert(start.next, "warning", after(WARNING_GRACE_MS - 1)).action).toBe("none");
    expect(decideAlert(start.next, "warning", after(WARNING_GRACE_MS)).action).toBe("problem");
  });

  it("a warning that clears before the grace period never produces an email, not even a recovery", () => {
    const warn = decideAlert(null, "warning", t0).next;
    const cleared = decideAlert(warn, "ok", after(60_000));
    expect(cleared.action).toBe("none");
  });

  it("sends one recovery email after a reported problem, then nothing", () => {
    const problem = decideAlert(null, "critical", t0).next;
    const recovered = decideAlert(problem, "ok", after(60_000));
    expect(recovered.action).toBe("recovery");
    expect(recovered.next.problemNotified).toBe(false);
    expect(decideAlert(recovered.next, "ok", after(120_000)).action).toBe("none");
  });

  it("a change of severity restarts the clock for the warning grace period", () => {
    const crit = decideAlert(null, "critical", t0).next;
    const toWarning = decideAlert(crit, "warning", after(60_000));
    expect(toWarning.next.since).toEqual(after(60_000));
  });
});
