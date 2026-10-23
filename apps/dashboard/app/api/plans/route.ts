import { NextResponse } from "next/server";
import { internalError } from "@/lib/api/errors";
import { queryActivePlans } from "@/lib/marketing/plans";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * GET /api/plans
 * The public pricing: every active plan, in the order set in Admin > Plans & pricing, with price in cents. It is the
 * same data the pricing page and the homepage show, and it is never cached, so an admin's change appears at once.
 */
export async function GET() {
  try {
    const plans = await queryActivePlans();
    return NextResponse.json({ plans }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    log.error("Failed to read plans:", err);
    return internalError("Failed to load plans");
  }
}
