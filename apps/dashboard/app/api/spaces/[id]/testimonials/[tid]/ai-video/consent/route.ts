import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
import { aiVideoErrorResponse, requireSpaceOwner } from "@/lib/ai-video/access";
import { withdrawConsent } from "@/lib/ai-video/consent-withdrawal";
import { findActiveConsent } from "@/lib/ai-video/generate";
import { db } from "@/lib/db";
import { testimonials } from "@/lib/db/schema";

interface RouteParams {
  params: Promise<{ id: string; tid: string }>;
}

/**
 * DELETE: the owner records that the customer withdrew their AI-video consent (for example by
 * telling them directly). Same effect as the customer using the link in their email.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id: spaceId, tid } = await params;
  const access = await requireSpaceOwner(spaceId);
  if ("response" in access) return access.response;

  try {
    const [testimonial] = await db.select({ id: testimonials.id }).from(testimonials).where(and(eq(testimonials.id, tid), eq(testimonials.spaceId, spaceId)));
    if (!testimonial) return apiError(404, "NOT_FOUND", "Testimonial not found");
    const consent = await findActiveConsent(tid);
    if (!consent) return apiError(400, "BAD_REQUEST", "There is no active AI video consent for this testimonial.");
    const result = await withdrawConsent(consent.id, "owner");
    return NextResponse.json({ status: result.status, removedVideos: result.removedVideos, stoppedVideos: result.stoppedVideos });
  } catch (error) {
    return aiVideoErrorResponse(error, "Failed to record the withdrawal");
  }
}
