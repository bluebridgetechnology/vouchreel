import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createPaymentProvider,
  getActivePaymentProviderName,
  getPaymentProvider,
  StripeProvider,
  DodoProvider,
} from "../index";
import { db } from "../../db";

vi.mock("../../db", () => ({
  db: {
    query: {
      adminSettings: {
        findFirst: vi.fn(),
      },
    },
  },
}));

describe("Payment Provider Factory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPaymentProvider", () => {
    it("returns StripeProvider by default when name is omitted", () => {
      const provider = createPaymentProvider();
      expect(provider).toBeInstanceOf(StripeProvider);
      expect(provider.name).toBe("stripe");
    });

    it("returns StripeProvider when name is 'stripe'", () => {
      const provider = createPaymentProvider("stripe");
      expect(provider).toBeInstanceOf(StripeProvider);
      expect(provider.name).toBe("stripe");
    });

    it("returns DodoProvider when name is 'dodo'", () => {
      const provider = createPaymentProvider("dodo");
      expect(provider).toBeInstanceOf(DodoProvider);
      expect(provider.name).toBe("dodo");
    });

    it("returns StripeProvider as fallback for unknown provider name", () => {
      const provider = createPaymentProvider("unknown_provider" as any);
      expect(provider).toBeInstanceOf(StripeProvider);
      expect(provider.name).toBe("stripe");
    });

    it("handles case-insensitive names and trimming", () => {
      expect(createPaymentProvider("  DODO  ")).toBeInstanceOf(DodoProvider);
      expect(createPaymentProvider("  STRIPE ")).toBeInstanceOf(StripeProvider);
    });
  });

  describe("getActivePaymentProviderName", () => {
    it("returns 'stripe' when adminSettings has no entry", async () => {
      (db.query.adminSettings.findFirst as any).mockResolvedValue(null);

      const name = await getActivePaymentProviderName();
      expect(name).toBe("stripe");
    });

    it("returns 'dodo' when adminSettings value is 'dodo'", async () => {
      (db.query.adminSettings.findFirst as any).mockResolvedValue({
        key: "payment_provider",
        value: "dodo",
      });

      const name = await getActivePaymentProviderName();
      expect(name).toBe("dodo");
    });

    it("returns 'dodo' when adminSettings value is an object { provider: 'dodo' }", async () => {
      (db.query.adminSettings.findFirst as any).mockResolvedValue({
        key: "payment_provider",
        value: { provider: "dodo" },
      });

      const name = await getActivePaymentProviderName();
      expect(name).toBe("dodo");
    });

    it("returns 'stripe' when adminSettings value is 'stripe'", async () => {
      (db.query.adminSettings.findFirst as any).mockResolvedValue({
        key: "payment_provider",
        value: "stripe",
      });

      const name = await getActivePaymentProviderName();
      expect(name).toBe("stripe");
    });

    it("falls back to 'stripe' on database query error", async () => {
      (db.query.adminSettings.findFirst as any).mockRejectedValue(
        new Error("Connection error")
      );

      const name = await getActivePaymentProviderName();
      expect(name).toBe("stripe");
    });
  });

  describe("getPaymentProvider", () => {
    it("returns explicit provider when preferredName is supplied", async () => {
      const provider = await getPaymentProvider("dodo");
      expect(provider).toBeInstanceOf(DodoProvider);
      expect(db.query.adminSettings.findFirst).not.toHaveBeenCalled();
    });

    it("queries database and returns active provider when preferredName is omitted", async () => {
      (db.query.adminSettings.findFirst as any).mockResolvedValue({
        key: "payment_provider",
        value: "dodo",
      });

      const provider = await getPaymentProvider();
      expect(provider).toBeInstanceOf(DodoProvider);
      expect(db.query.adminSettings.findFirst).toHaveBeenCalled();
    });
  });
});
