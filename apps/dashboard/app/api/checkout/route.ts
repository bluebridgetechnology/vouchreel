import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { plans, subscriptions } from "@/lib/db/schema";
import { getPaymentProvider } from "@/lib/payments";
import { unauthorized, badRequest, notFound, internalError } from "@/lib/api/errors";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session?.user) {
      return unauthorized("Authentication required to checkout");
    }

    const body = await request.json();
    const { planId } = body;

    if (!planId || typeof planId !== "string") {
      return badRequest("Invalid or missing planId");
    }

    const plan = await db.query.plans.findFirst({
      where: eq(plans.id, planId),
    });

    if (!plan) {
      return notFound(`Plan not found: ${planId}`);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // If free plan ($0), activate immediately without third-party checkout
    if (plan.price === 0) {
      const existing = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, session.user.id),
      });

      if (existing) {
        await db
          .update(subscriptions)
          .set({
            planId: plan.id,
            status: "active",
            provider: null,
            providerCustomerId: null,
            providerSubscriptionId: null,
            currentPeriodEnd: null,
          })
          .where(eq(subscriptions.id, existing.id));
      } else {
        await db.insert(subscriptions).values({
          userId: session.user.id,
          planId: plan.id,
          status: "active",
          provider: null,
        });
      }

      return NextResponse.json({ url: "/checkout/success?plan=free" });
    }

    // Get active provider from DB (Stripe or Dodo)
    const provider = await getPaymentProvider();

    const checkoutSession = await provider.createCheckoutSession({
      planId: plan.id,
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      successUrl: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&provider=${provider.name}`,
      cancelUrl: `${appUrl}/checkout/cancel?provider=${provider.name}`,
    });

    return NextResponse.json({
      id: checkoutSession.id,
      url: checkoutSession.url,
      provider: provider.name,
    });
  } catch (err) {
    log.error("Checkout creation error:", err);
    const message = err instanceof Error ? err.message : "Failed to create checkout session";
    return internalError(message);
  }
}
