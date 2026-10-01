import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { collectionForms, submissions } from "@/lib/db/schema";
import { apiError, badRequest, internalError, notFound, validationError } from "@/lib/api/errors";
import { rateLimit } from "@/lib/rate-limit";
import { getStorage } from "@/lib/storage";
import { queueTranscode } from "@/lib/transcode";
import { submissionMetaSchema } from "@/lib/validations/collection-forms";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";

export const runtime = "nodejs";

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const VIDEO_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
};

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";
  const limit = rateLimit(`collect_${ip}_${slug}`, { windowMs: 60 * 60 * 1000, max: 10 });
  if (!limit.success) {
    return apiError(429, "RATE_LIMITED", "Too many submissions. Please try again later.", {
      details: { reset: limit.reset },
      headers: { "Retry-After": Math.ceil((limit.reset - Date.now()) / 1000).toString() },
    });
  }

  let data: FormData;
  try {
    data = await request.formData();
  } catch {
    return badRequest("Expected multipart form data");
  }

  const parsed = submissionMetaSchema.safeParse({
    customerName: data.get("customerName"),
    customerEmail: data.get("customerEmail"),
    text: data.get("text") || undefined,
    durationSeconds: data.get("durationSeconds")
      ? Number(data.get("durationSeconds"))
      : undefined,
  });
  if (!parsed.success) {
    return validationError("Validation failed", parsed.error.flatten().fieldErrors);
  }

  const file = data.get("video");
  const hasVideo = file instanceof File && file.size > 0;
  const hasText = Boolean(parsed.data.text);
  if (hasVideo === hasText) {
    return badRequest("Submit exactly one video or text testimonial");
  }

  if (hasVideo && (!VIDEO_EXTENSIONS[file.type] || file.size > MAX_VIDEO_BYTES)) {
    return badRequest("Video must be MP4, WebM, MOV, or AVI and no larger than 100 MB");
  }

  try {
    const [form] = await db
      .select({ id: collectionForms.id, spaceId: collectionForms.spaceId })
      .from(collectionForms)
      .where(and(eq(collectionForms.slug, slug), eq(collectionForms.isActive, true)));
    if (!form) return notFound("Collection form not found");

    let videoUrl: string | null = null;
    if (hasVideo) {
      const storage = getStorage();
      const extension = VIDEO_EXTENSIONS[file.type];
      videoUrl = await storage.upload(
        Buffer.from(await file.arrayBuffer()),
        `submissions/${form.id}/${randomUUID()}.${extension}`,
        { contentType: file.type, public: true }
      );
    }

    const [submission] = await db
      .insert(submissions)
      .values({
        formId: form.id,
        type: hasVideo ? "video" : "text",
        videoUrl,
        text: parsed.data.text || null,
        customerName: parsed.data.customerName,
        customerEmail: parsed.data.customerEmail,
        status: "pending",
        durationSeconds: parsed.data.durationSeconds || null,
        processingStatus: hasVideo ? "pending" : "none",
      })
      .returning();

    if (hasVideo) queueTranscode(submission.id);

    // Dispatch webhook event (non-blocking)
    dispatchWebhookEvent({
      event: "submission.received",
      spaceId: form.spaceId,
      payload: { submission },
    }).catch(() => {});

    return NextResponse.json({ submission }, { status: 201 });
  } catch (error) {
    console.error("Failed to create collection submission:", error);
    return internalError("Unable to submit your testimonial. Please try again.");
  }
}
