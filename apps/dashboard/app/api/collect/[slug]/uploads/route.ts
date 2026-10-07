import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { collectionForms } from "@/lib/db/schema";
import { apiError, badRequest, internalError, notFound, validationError } from "@/lib/api/errors";
import { rateLimit } from "@/lib/rate-limit";
import { getStorage } from "@/lib/storage";
import { allowsVideo } from "@/lib/collect/modes";
import { MAX_VIDEO_BYTES, VIDEO_EXTENSIONS, pendingKey } from "@/lib/collect/direct-upload";
import { baseMimeType } from "@/lib/security/video-sniff";
import { getClientIp } from "@/lib/security/client-ip";
import { log } from "@/lib/log";

export const runtime = "nodejs";

const bodySchema = z.object({ contentType: z.string().max(100), size: z.number().int().positive() });

/**
 * POST /api/collect/[slug]/uploads  { contentType, size }
 * Returns a presigned POST so the browser can send the video straight to storage, or { direct: false }
 * when this deployment's storage cannot do that (the form then uploads through the server as before).
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ip = getClientIp(request.headers);
  const limit = await rateLimit(`collect_upload_${ip}_${slug}`, { windowMs: 60 * 60 * 1000, max: 20 });
  if (!limit.success) {
    return apiError(429, "RATE_LIMITED", "Too many uploads. Please try again later.", {
      details: { reset: limit.reset },
      headers: { "Retry-After": Math.ceil((limit.reset - Date.now()) / 1000).toString() },
    });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("Validation failed", parsed.error.flatten().fieldErrors);
  const contentType = baseMimeType(parsed.data.contentType);
  const extension = VIDEO_EXTENSIONS[contentType];
  if (!extension || parsed.data.size > MAX_VIDEO_BYTES) {
    return badRequest("Video must be MP4, WebM, MOV, or AVI and no larger than 100 MB");
  }

  try {
    const [form] = await db
      .select({ id: collectionForms.id, collectModes: collectionForms.collectModes })
      .from(collectionForms)
      .where(and(eq(collectionForms.slug, slug), eq(collectionForms.isActive, true)));
    if (!form) return notFound("Collection form not found");
    if (!allowsVideo(form.collectModes)) return badRequest("This form only accepts written testimonials");

    const storage = getStorage();
    if (!storage.createPresignedUpload) return NextResponse.json({ direct: false });

    const upload = await storage.createPresignedUpload(pendingKey(form.id, extension), { contentType, maxBytes: MAX_VIDEO_BYTES });
    return NextResponse.json({ direct: true, ...upload });
  } catch (error) {
    log.error("Failed to prepare a direct upload:", error);
    return internalError("Unable to start the upload. Please try again.");
  }
}
