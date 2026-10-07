import { NextResponse } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, testimonials, testimonialTranslations } from "@/lib/db/schema";
import { getOrTranslateTestimonial, TranslationNotConfiguredError } from "@/lib/translations";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string; tid: string }>;
}

/**
 * Helper to verify user ownership of the space and testimonial existence.
 */
async function verifySpaceAndTestimonial(
  spaceId: string,
  testimonialId: string,
  userId: string
) {
  const [space] = await db
    .select({ id: spaces.id, ownerId: spaces.ownerId })
    .from(spaces)
    .where(eq(spaces.id, spaceId));

  if (!space) {
    return {
      error: { code: "NOT_FOUND" as const, message: "Space not found" },
      status: 404 as const,
    };
  }

  if (space.ownerId !== userId) {
    return {
      error: {
        code: "FORBIDDEN" as const,
        message: "Forbidden: You do not own this space",
      },
      status: 403 as const,
    };
  }

  const [testimonial] = await db
    .select()
    .from(testimonials)
    .where(
      and(
        eq(testimonials.id, testimonialId),
        eq(testimonials.spaceId, spaceId)
      )
    );

  if (!testimonial) {
    return {
      error: { code: "NOT_FOUND" as const, message: "Testimonial not found" },
      status: 404 as const,
    };
  }

  return { space, testimonial };
}

/**
 * GET /api/spaces/[id]/testimonials/[tid]/translations
 * Lists all cached translations for the specified testimonial.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id, tid } = await params;
  const verified = await verifySpaceAndTestimonial(id, tid, session.user.id);
  if (verified.error) {
    return apiError(
      verified.status,
      verified.error.code,
      verified.error.message
    );
  }

  try {
    const translations = await db
      .select()
      .from(testimonialTranslations)
      .where(eq(testimonialTranslations.testimonialId, tid))
      .orderBy(asc(testimonialTranslations.createdAt));

    return NextResponse.json({ translations }, { status: 200 });
  } catch (error) {
    log.error("Failed to fetch translations:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to fetch translations");
  }
}

/**
 * POST /api/spaces/[id]/testimonials/[tid]/translations
 * Requests or triggers translation of testimonial quote/transcript in the target language.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id, tid } = await params;
  const verified = await verifySpaceAndTestimonial(id, tid, session.user.id);
  if (verified.error) {
    return apiError(
      verified.status,
      verified.error.code,
      verified.error.message
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { language } = body;

    if (!language || typeof language !== "string" || language.trim().length === 0) {
      return apiError(400, "VALIDATION_ERROR", "Language is required");
    }

    const translation = await getOrTranslateTestimonial(tid, language.trim());

    return NextResponse.json({ translation }, { status: 201 });
  } catch (error) {
    if (error instanceof TranslationNotConfiguredError) {
      return apiError(503, "SERVICE_UNAVAILABLE", "Translation is not available on this server yet.");
    }
    log.error("Failed to generate translation:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to generate translation");
  }
}
