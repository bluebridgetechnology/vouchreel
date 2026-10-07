import { beforeEach, describe, expect, it, vi } from "vitest";

const consentInsert = vi.fn();
const receipt = vi.fn();
let submissionRow: Record<string, unknown>;

vi.mock("@/lib/auth/session", () => ({ getSession: async () => ({ user: { id: "owner-1" } }) }));
vi.mock("@/lib/payments/enforce", () => ({ enforceTestimonialLimit: async () => null }));
vi.mock("@/lib/ai-video/consent-withdrawal", () => ({ sendConsentReceipt: (...a: unknown[]) => receipt(...a) }));
vi.mock("@/lib/webhooks/dispatch", () => ({ dispatchWebhookEvent: vi.fn(() => Promise.resolve()) }));

vi.mock("@/lib/db", () => {
  // Distinguishes the tables the route touches by the markers the schema mock below sets
  const select = (cols?: unknown) => ({
    from: (table: { __name: string }) => ({
      where: () => {
        if (table.__name === "spaces") return Promise.resolve([{ ownerId: "owner-1" }]);
        if (table.__name === "collectionForms") return Promise.resolve([{ id: "form-1", title: "Form" }]);
        return Promise.resolve([{ maxOrder: 0 }]); // testimonials max sort order
      },
    }),
    cols,
  });
  const tx = {
    update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([submissionRow]) }) }) }),
    select,
    insert: (table: { __name: string }) => ({
      values: (v: unknown) => {
        if (table.__name === "testimonialConsents") {
          consentInsert(v);
          return { returning: () => Promise.resolve([{ id: "consent-1" }]) };
        }
        return { returning: () => Promise.resolve([{ id: "t-1", ...(v as object) }]) };
      },
    }),
  };
  return { db: { select, transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } };
});

vi.mock("@/lib/db/schema", () => {
  const table = (name: string) => new Proxy({ __name: name }, { get: (t, k) => (k in t ? (t as never)[k] : { name: String(k) }) });
  return {
    spaces: table("spaces"),
    collectionForms: table("collectionForms"),
    submissions: table("submissions"),
    testimonials: table("testimonials"),
    testimonialConsents: table("testimonialConsents"),
  };
});
vi.mock("drizzle-orm", () => ({ and: () => ({}), eq: () => ({}), max: () => ({}) }));

import { PATCH } from "../route";

const ctx = { params: Promise.resolve({ id: "space-1", formId: "form-1", submissionId: "sub-1" }) };
const approve = () =>
  PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ status: "approved" }) }), ctx);

describe("approving a submission carries AI video consent to the testimonial", () => {
  beforeEach(() => {
    consentInsert.mockClear();
    receipt.mockClear();
  });

  it("creates a consent row with the wording version and timestamp the customer agreed to", async () => {
    const grantedAt = new Date("2026-10-01T10:00:00Z");
    submissionRow = { id: "sub-1", type: "text", text: "Great", customerName: "Ada", customerEmail: "ada@example.test", aiVideoConsentAt: grantedAt, aiVideoConsentVersion: "2026-10-v1" };
    expect((await approve()).status).toBe(200);
    expect(consentInsert).toHaveBeenCalledWith(
      expect.objectContaining({ testimonialId: "t-1", spaceId: "space-1", source: "collect_form", textVersion: "2026-10-v1", submissionId: "sub-1", grantedAt })
    );
  });

  it("emails the customer a receipt with the link to withdraw, only when they consented", async () => {
    submissionRow = { id: "sub-1", type: "text", text: "Great", customerName: "Ada", customerEmail: "ada@example.test", aiVideoConsentAt: new Date(), aiVideoConsentVersion: "2026-10-v1" };
    await approve();
    expect(receipt).toHaveBeenCalledTimes(1);
    expect(receipt).toHaveBeenCalledWith(expect.objectContaining({ consentId: "consent-1", to: "ada@example.test", name: "Ada" }));

    receipt.mockClear();
    submissionRow = { id: "sub-1", type: "text", text: "Great", customerName: "Ada", customerEmail: "ada@example.test", aiVideoConsentAt: null, aiVideoConsentVersion: null };
    await approve();
    expect(receipt).not.toHaveBeenCalled();
  });

  it("creates no consent row when the customer did not consent", async () => {
    submissionRow = { id: "sub-1", type: "text", text: "Great", customerName: "Ada", aiVideoConsentAt: null, aiVideoConsentVersion: null };
    await approve();
    expect(consentInsert).not.toHaveBeenCalled();
  });

  it("creates no consent row for a video submission even if the columns were set", async () => {
    submissionRow = { id: "sub-1", type: "video", videoUrl: "https://x/v.mp4", customerName: "Ada", aiVideoConsentAt: new Date(), aiVideoConsentVersion: "2026-10-v1" };
    await approve();
    expect(consentInsert).not.toHaveBeenCalled();
  });
});
