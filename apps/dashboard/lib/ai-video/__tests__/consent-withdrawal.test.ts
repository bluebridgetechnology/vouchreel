import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/storage", () => ({ getStorage: vi.fn() }));
vi.mock("@/lib/storage/cleanup", () => ({ keysFromUrls: vi.fn(), queueFileCleanup: vi.fn() }));
vi.mock("@/lib/notifications/service", () => ({ notifySpaceOwner: vi.fn() }));
const sent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email/transport", () => ({ sendEmail: (...a: unknown[]) => sent(...a) }));

import { consentIdFromToken, consentToken, sendConsentReceipt, withdrawalUrl } from "../consent-withdrawal";

const ID = "0b9a1f0e-3c1d-4b0b-9f7e-2f6d4c1a8e55";
const original = process.env.BETTER_AUTH_SECRET;

describe("consent withdrawal links", () => {
  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = "a-test-secret-of-sufficient-length-0123456789";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test/";
    sent.mockReset();
  });
  afterEach(() => {
    process.env.BETTER_AUTH_SECRET = original;
  });

  it("a token round-trips to its consent id", () => {
    expect(consentIdFromToken(consentToken(ID))).toBe(ID);
  });

  it("rejects a token that was changed, forged, signed with another secret, or malformed", () => {
    const token = consentToken(ID);
    const [id, sig] = token.split(".");
    expect(consentIdFromToken(`${id}.${sig.replace(/.$/, sig.endsWith("0") ? "1" : "0")}`)).toBeNull(); // last character changed
    expect(consentIdFromToken(`${"1".repeat(8)}-1111-1111-1111-${"1".repeat(12)}.${sig}`)).toBeNull(); // another consent id, same signature
    expect(consentIdFromToken(`${ID}.`)).toBeNull();
    expect(consentIdFromToken(ID)).toBeNull();
    expect(consentIdFromToken(`${token}.extra`)).toBeNull();
    expect(consentIdFromToken("not-a-uuid.abcdef")).toBeNull();
    expect(consentIdFromToken("")).toBeNull();
    expect(consentIdFromToken(`${ID}.zz`)).toBeNull(); // not hex
    process.env.BETTER_AUTH_SECRET = "a-different-secret-entirely-0123456789abcdef";
    expect(consentIdFromToken(token)).toBeNull();
  });

  it("refuses to sign without a secret", () => {
    delete process.env.BETTER_AUTH_SECRET;
    expect(() => consentToken(ID)).toThrow("BETTER_AUTH_SECRET");
  });

  it("builds an absolute link on the app's address", () => {
    expect(withdrawalUrl(ID)).toBe(`https://app.example.test/consent/withdraw?token=${consentToken(ID)}`);
  });

  it("the receipt email carries the link, and a failure to send never throws", async () => {
    sent.mockResolvedValueOnce({ sent: true, provider: "resend" });
    await sendConsentReceipt({ consentId: ID, to: "ada@example.test", name: "Ada", spaceName: "Analytical Co" });
    expect(sent).toHaveBeenCalledWith(expect.objectContaining({ to: "ada@example.test", subject: expect.stringContaining("Analytical Co") }));
    const message = sent.mock.calls[0][0] as { text: string; html: string };
    expect(message.text).toContain(withdrawalUrl(ID));
    expect(message.html).toContain("Withdraw my agreement");

    sent.mockRejectedValueOnce(new Error("smtp down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(sendConsentReceipt({ consentId: ID, to: "a@b.test", name: "A", spaceName: "S" })).resolves.toBeUndefined();
    err.mockRestore();
  });
});
