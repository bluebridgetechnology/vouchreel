import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, validationError } from "@/lib/api/errors";
import { consentIdFromToken, withdrawConsent } from "@/lib/ai-video/consent-withdrawal";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/security/client-ip";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ token: z.string().min(10).max(200) });

/**
 * POST /api/consent/withdraw  { token }
 * Public: the customer proves they hold the link from their confirmation email. Withdrawing
 * removes every AI video made under the consent. Repeating it is harmless.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const limit = await rateLimit(`consent_withdraw_${ip}`, { windowMs: 60 * 60 * 1000, max: 20 });
  if (!limit.success) return apiError(429, "RATE_LIMITED", "Too many attempts. Please try again later.");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("Validation failed", parsed.error.flatten().fieldErrors);

  const consentId = consentIdFromToken(parsed.data.token);
  if (!consentId) return apiError(400, "BAD_REQUEST", "This link is not valid.");

  try {
    const result = await withdrawConsent(consentId, "customer");
    if (result.status === "not_found") return apiError(404, "NOT_FOUND", "This agreement no longer exists.");
    return NextResponse.json({ status: result.status, removedVideos: result.removedVideos });
  } catch (error) {
    log.error("Failed to withdraw consent:", error);
    return apiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
}
