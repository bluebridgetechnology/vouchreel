import { beforeEach, describe, expect, it, vi } from "vitest";
import { enforceTestimonialLimit, getTestimonialQuota } from "../enforce";
import { getSubscriptionLimits } from "../subscription";
import { createNotification } from "@/lib/notifications/service";

const selectResults: unknown[][] = [];
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => Promise.resolve(selectResults.shift() ?? []) }),
    }),
  },
}));
vi.mock("../subscription", () => ({ getSubscriptionLimits: vi.fn() }));
vi.mock("@/lib/notifications/service", () => ({ createNotification: vi.fn() }));

const limits = (max: number) => ({ maxTestimonialsPerSpace: max }) as never;

describe("testimonial plan limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
  });

  it("counts against the space owner's plan", async () => {
    selectResults.push([{ ownerId: "owner-1" }], [{ value: 2 }]);
    vi.mocked(getSubscriptionLimits).mockResolvedValue(limits(3));
    const quota = await getTestimonialQuota("space-1");
    expect(getSubscriptionLimits).toHaveBeenCalledWith("owner-1");
    expect(quota).toMatchObject({ allowed: true, current: 2, limit: 3 });
  });

  it("allows adding when under the limit and returns no response", async () => {
    selectResults.push([{ ownerId: "owner-1" }], [{ value: 2 }]);
    vi.mocked(getSubscriptionLimits).mockResolvedValue(limits(3));
    expect(await enforceTestimonialLimit("space-1")).toBeNull();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("blocks with 403 PLAN_LIMIT at the limit and notifies the owner", async () => {
    selectResults.push([{ ownerId: "owner-1" }], [{ value: 3 }]);
    vi.mocked(getSubscriptionLimits).mockResolvedValue(limits(3));
    const res = await enforceTestimonialLimit("space-1");
    expect(res?.status).toBe(403);
    const body = await res!.json();
    expect(body.error.code).toBe("PLAN_LIMIT");
    expect(body.error.details).toEqual({ current: 3, limit: 3 });
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "owner-1", type: "plan.limit_reached", dedupeKey: "plan-limit:testimonials:space-1" })
    );
  });

  it("never blocks unlimited plans", async () => {
    selectResults.push([{ ownerId: "owner-1" }], [{ value: 5000 }]);
    vi.mocked(getSubscriptionLimits).mockResolvedValue(limits(Infinity));
    expect(await enforceTestimonialLimit("space-1")).toBeNull();
  });

  it("returns null for unknown spaces so the route can 404 itself", async () => {
    selectResults.push([]);
    expect(await enforceTestimonialLimit("missing")).toBeNull();
  });
});
