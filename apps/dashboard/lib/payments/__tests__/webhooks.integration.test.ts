import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Real Postgres. Skipped unless TEST_DATABASE_URL is set. Signature checks are stubbed; everything after is real. */
const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("payment webhooks against postgres", () => {
  let db: typeof import("@/lib/db").db;
  let eq: typeof import("drizzle-orm").eq;
  let s: typeof import("@/lib/db/schema");
  let StripeProvider: typeof import("../stripe").StripeProvider;
  let DodoProvider: typeof import("../dodo").DodoProvider;
  let users: typeof import("@/lib/admin/users");
  let subs: typeof import("../subscription");
  let pool: { end: () => Promise<void> } | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  const tag = `wh${Date.now()}`;
  const userId = `${tag}-u`;
  const adminId = `${tag}-a`;
  let proPlan = "";
  let agencyPlan = "";

  const stripeEvent = (id: string, type: string, created: number, object: Record<string, unknown>) => ({ id, type, created, data: { object } });
  const stripeProvider = (queue: () => unknown) =>
    new StripeProvider({ webhooks: { constructEvent: () => queue() } } as never);
  const post = () => new Request("http://x/webhook", { method: "POST", body: "{}", headers: { "stripe-signature": "sig", "webhook-id": "ignored" } });
  const getSub = async () => (await db.select().from(s.subscriptions).where(eq(s.subscriptions.userId, userId)))[0];

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.DODO_WEBHOOK_SECRET = "whsec_dodo";
    releaseLock = await (await import("@/lib/test/db-lock")).acquireTestDbLock(url!);
    ({ db } = await import("@/lib/db"));
    ({ eq } = await import("drizzle-orm"));
    s = await import("@/lib/db/schema");
    ({ StripeProvider } = await import("../stripe"));
    ({ DodoProvider } = await import("../dodo"));
    users = await import("@/lib/admin/users");
    subs = await import("../subscription");
    pool = (globalThis as unknown as { pool?: { end: () => Promise<void> } }).pool;
    await db.insert(s.user).values([
      { id: userId, name: "W", email: `${userId}@example.test` },
      { id: adminId, name: "A", email: `${adminId}@example.test`, isPlatformAdmin: true },
    ]);
    const limits = (maxSpaces: number) => ({ maxSpaces, maxTestimonialsPerSpace: 100 });
    const [a, b] = await db
      .insert(s.plans)
      .values([
        { name: `${tag}-pro`, price: 2900, interval: "month", limits: limits(7) },
        { name: `${tag}-agency`, price: 9900, interval: "month", limits: limits(42) },
      ])
      .returning();
    proPlan = a.id;
    agencyPlan = b.id;
  }, 600_000);

  afterAll(async () => {
    await db.delete(s.user).where(eq(s.user.id, userId));
    await db.delete(s.user).where(eq(s.user.id, adminId));
    await db.delete(s.plans).where(eq(s.plans.id, proPlan));
    await db.delete(s.plans).where(eq(s.plans.id, agencyPlan));
    await db.delete(s.webhookEvents);
    await pool?.end();
    await releaseLock?.();
  });

  it("a manual grant gives the plan's limits, then a real Stripe checkout replaces it", async () => {
    const granted = await users.updateAdminUser(adminId, userId, { planId: agencyPlan });
    expect(granted.ok).toBe(true);
    expect((await getSub()).provider).toBe("manual");
    expect((await subs.getSubscriptionLimits(userId)).maxSpaces).toBe(42);

    const checkout = stripeEvent("evt_1", "checkout.session.completed", 1_000, {
      metadata: { userId, planId: proPlan },
      customer: "cus_1",
      subscription: "sub_1",
    });
    const result = await stripeProvider(() => checkout).handleWebhook(post());
    expect(result.actionTaken).toBe("subscription_created");

    const row = await getSub();
    expect(row).toMatchObject({ provider: "stripe", planId: proPlan, providerSubscriptionId: "sub_1", providerCustomerId: "cus_1" });
    expect((await subs.getSubscriptionLimits(userId)).maxSpaces).toBe(7);
    // From now on the admin cannot hand out a plan on top of the one Stripe bills
    const refused = await users.updateAdminUser(adminId, userId, { planId: agencyPlan });
    expect(refused).toMatchObject({ ok: false, reason: "billed_by_provider" });
  });

  it("a redelivered event is acknowledged and not applied twice", async () => {
    const cancel = stripeEvent("evt_cancel", "customer.subscription.deleted", 2_000, { id: "sub_1" });
    const provider = stripeProvider(() => cancel);
    expect((await provider.handleWebhook(post())).actionTaken).toBe("subscription_canceled");
    expect((await getSub()).status).toBe("canceled");

    // Something else reactivates the row; the redelivery must not cancel it again
    await db.update(s.subscriptions).set({ status: "active" }).where(eq(s.subscriptions.userId, userId));
    expect(await provider.handleWebhook(post())).toMatchObject({ received: true, actionTaken: "duplicate_ignored" });
    expect((await getSub()).status).toBe("active");
  });

  it("an older event arriving late does not undo a newer one", async () => {
    const newer = stripeEvent("evt_new", "customer.subscription.updated", 5_000, { id: "sub_1", status: "past_due" });
    const older = stripeEvent("evt_old", "customer.subscription.updated", 4_000, { id: "sub_1", status: "active" });
    await stripeProvider(() => newer).handleWebhook(post());
    expect((await getSub()).status).toBe("past_due");
    await stripeProvider(() => older).handleWebhook(post());
    expect((await getSub()).status).toBe("past_due");
    expect((await getSub()).lastEventAt?.getTime()).toBe(5_000 * 1000);
  });

  it("a failed handling is retried instead of being dropped as a duplicate", async () => {
    const event = stripeEvent("evt_retry", "customer.subscription.updated", 6_000, { id: "sub_1", status: "active" });
    const provider = stripeProvider(() => event);
    const original = db.update;
    (db as { update: unknown }).update = () => {
      throw new Error("database went away");
    };
    await expect(provider.handleWebhook(post())).rejects.toThrow("database went away");
    (db as { update: unknown }).update = original;

    const retry = await provider.handleWebhook(post());
    expect(retry.actionTaken).toBe("subscription_updated");
    expect((await getSub()).status).toBe("active");
  });

  it("Dodo: duplicate by webhook-id, and out-of-order by event time", async () => {
    await db.update(s.subscriptions).set({ provider: "dodo", providerSubscriptionId: "dsub_1", lastEventAt: null, status: "active" }).where(eq(s.subscriptions.userId, userId));
    const make = (payload: unknown) => new DodoProvider({ webhooks: { unwrap: () => payload } } as never);
    const req = (id: string) => new Request("http://x/d", { method: "POST", body: "{}", headers: { "webhook-id": id, "webhook-timestamp": "1", "webhook-signature": "x" } });

    const newer = { type: "subscription.cancelled", timestamp: "2026-10-02T10:00:00Z", data: { subscription_id: "dsub_1" } };
    const older = { type: "subscription.updated", timestamp: "2026-10-01T10:00:00Z", data: { subscription_id: "dsub_1", status: "active" } };
    expect((await make(newer).handleWebhook(req("d1"))).actionTaken).toBe("subscription_canceled");
    expect((await getSub()).status).toBe("canceled");
    await make(older).handleWebhook(req("d0"));
    expect((await getSub()).status).toBe("canceled");
    expect(await make(newer).handleWebhook(req("d1"))).toMatchObject({ actionTaken: "duplicate_ignored" });
  });
});
