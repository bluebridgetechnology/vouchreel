import { eq } from "drizzle-orm";
import { db } from "../db";
import { adminSettings } from "../db/schema";
import type { PaymentProvider, PaymentProviderName } from "./types";
import { StripeProvider } from "./stripe";
import { DodoProvider } from "./dodo";
import { log } from "@/lib/log";

export * from "./types";
export { StripeProvider, mapStripeSubscriptionStatus } from "./stripe";
export { DodoProvider, mapDodoSubscriptionStatus } from "./dodo";

/**
 * Creates a payment provider instance directly by name.
 * Default is 'stripe'.
 */
export function createPaymentProvider(name?: string | null): PaymentProvider {
  const normalized = (name || "stripe").toLowerCase().trim();

  switch (normalized) {
    case "dodo":
      return new DodoProvider();
    case "stripe":
    default:
      return new StripeProvider();
  }
}

/**
 * Reads the active payment provider name from the admin_settings table.
 * Defaults to 'stripe' if not configured or if an error occurs.
 */
export async function getActivePaymentProviderName(): Promise<PaymentProviderName> {
  try {
    const setting = await db.query.adminSettings.findFirst({
      where: eq(adminSettings.key, "payment_provider"),
    });

    if (setting && typeof setting.value === "string") {
      const val = setting.value.toLowerCase().trim();
      if (val === "dodo") return "dodo";
      if (val === "stripe") return "stripe";
    }

    if (
      setting &&
      typeof setting.value === "object" &&
      setting.value !== null &&
      "provider" in (setting.value as Record<string, unknown>)
    ) {
      const val = String((setting.value as Record<string, unknown>).provider)
        .toLowerCase()
        .trim();
      if (val === "dodo") return "dodo";
      if (val === "stripe") return "stripe";
    }

    return "stripe";
  } catch (err) {
    log.warn("Failed to read active payment provider from admin_settings, defaulting to stripe:", err);
    return "stripe";
  }
}

/**
 * Returns the active payment provider instance.
 * If preferredName is provided, returns that specific provider;
 * otherwise queries the active provider from admin_settings.
 */
export async function getPaymentProvider(
  preferredName?: PaymentProviderName
): Promise<PaymentProvider> {
  if (preferredName) {
    return createPaymentProvider(preferredName);
  }

  const activeName = await getActivePaymentProviderName();
  return createPaymentProvider(activeName);
}
