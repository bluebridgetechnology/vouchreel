import { NextResponse } from "next/server";
import { StripeProvider } from "@/lib/payments/stripe";
import { badRequest, internalError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const provider = new StripeProvider();
    const result = await provider.handleWebhook(request);

    if (!result.received) {
      return badRequest(result.error || "Failed to process Stripe webhook");
    }

    return NextResponse.json({
      received: true,
      event: result.event,
      actionTaken: result.actionTaken,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return internalError(message);
  }
}
