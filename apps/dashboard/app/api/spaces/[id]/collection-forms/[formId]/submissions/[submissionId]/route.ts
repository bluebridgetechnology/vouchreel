import { NextResponse } from "next/server";
import { and, eq, max } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { collectionForms, spaces, submissions, testimonials } from "@/lib/db/schema";
import { updateSubmissionStatusSchema } from "@/lib/validations/collection-forms";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";
import { enforceTestimonialLimit } from "@/lib/payments/enforce";

interface RouteParams { params: Promise<{ id: string; formId: string; submissionId: string }> }
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getSession(); if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Unauthorized");
  const { id, formId, submissionId } = await params;
  const [space] = await db.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, id));
  if (!space) return apiError(404, "NOT_FOUND", "Space not found");
  if (space.ownerId !== session.user.id) return apiError(403, "FORBIDDEN", "Forbidden: You do not own this space");
  const [form] = await db.select().from(collectionForms).where(and(eq(collectionForms.id, formId), eq(collectionForms.spaceId, id)));
  if (!form) return apiError(404, "NOT_FOUND", "Collection form not found");
  try {
    const parsed = updateSubmissionStatusSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(400, "VALIDATION_ERROR", "Validation failed", { details: parsed.error.flatten().fieldErrors });
    // Approving creates a testimonial, so it counts against the owner's plan limit
    if (parsed.data.status === "approved") {
      const blocked = await enforceTestimonialLimit(id);
      if (blocked) return blocked;
    }
    const result = await db.transaction(async (tx) => {
      const [submission] = await tx.update(submissions).set({ status: parsed.data.status })
        .where(and(eq(submissions.id, submissionId), eq(submissions.formId, formId), eq(submissions.status, "pending"))).returning();
      if (!submission) return null;
      if (parsed.data.status === "rejected") return { submission };
      const [order] = await tx.select({ maxOrder: max(testimonials.sortOrder) }).from(testimonials).where(eq(testimonials.spaceId, id));
      const [testimonial] = await tx.insert(testimonials).values({
        spaceId: id, videoUrl: submission.type === "video" ? submission.videoUrl : null,
        platform: submission.type === "video" ? "mp4" : "text", thumbnailUrl: submission.type === "video" ? submission.thumbnailUrl : null,
        durationSeconds: submission.type === "video" ? submission.durationSeconds : null, title: form.title,
        quote: submission.type === "text" ? submission.text : null, customerName: submission.customerName,
        tags: [], matchRules: { mode: "all", urlPatterns: [], tags: [] }, sortOrder: (order?.maxOrder ?? -1) + 1,
        isActive: true, clipStatus: "none",
      }).returning();
      return { submission, testimonial };
    });
    if (!result) return apiError(400, "BAD_REQUEST", "Submission has already been reviewed or was not found");
    if (parsed.data.status === "approved" && result.submission) {
      dispatchWebhookEvent({
        event: "submission.approved",
        spaceId: id,
        payload: { submission: result.submission },
      }).catch(() => {});
      if (result.testimonial) {
        dispatchWebhookEvent({
          event: "testimonial.created",
          spaceId: id,
          payload: { testimonial: result.testimonial },
        }).catch(() => {});
      }
    }
    return NextResponse.json(result);
  } catch (err) { console.error("Failed to review submission:", err); return apiError(500, "INTERNAL_ERROR", "Failed to review submission"); }
}
