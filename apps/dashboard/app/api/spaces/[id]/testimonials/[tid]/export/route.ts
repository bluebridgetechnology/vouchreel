import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  socialExports,
  socialExportSettings,
  spaces,
  testimonials,
} from "@/lib/db/schema";
import { queueSocialExport } from "@/lib/social/pipeline";
import { createSocialExportSchema } from "@/lib/validations/social-export";

import type { ApiErrorCode } from "@/lib/api/errors";

interface RouteParams {
  params: Promise<{ id: string; tid: string }>;
}

type VerifyResult =
  | { error: { code: ApiErrorCode; message: string }; status: number }
  | {
      space: { id: string; ownerId: string };
      testimonial: typeof testimonials.$inferSelect;
      error?: never;
      status?: never;
    };

async function verifySpaceAndTestimonial(
  spaceId: string,
  testimonialId: string,
  userId: string
): Promise<VerifyResult> {
  const [space] = await db
    .select({ id: spaces.id, ownerId: spaces.ownerId })
    .from(spaces)
    .where(eq(spaces.id, spaceId));

  if (!space) {
    return {
      error: { code: "NOT_FOUND", message: "Space not found" },
      status: 404,
    };
  }

  if (space.ownerId !== userId) {
    return {
      error: {
        code: "FORBIDDEN",
        message: "Forbidden: You do not own this space",
      },
      status: 403,
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
      error: {
        code: "NOT_FOUND",
        message: "Testimonial not found",
      },
      status: 404,
    };
  }

  return { space, testimonial };
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id: spaceId, tid: testimonialId } = await params;
  const verified = await verifySpaceAndTestimonial(
    spaceId,
    testimonialId,
    session.user.id
  );

  if (verified.error) {
    return apiError(verified.status, verified.error.code, verified.error.message);
  }

  const { testimonial } = verified;
  if (!testimonial.videoUrl && !testimonial.clipUrl) {
    return apiError(
      400,
      "BAD_REQUEST",
      "This testimonial has no video file and cannot be exported for social media."
    );
  }

  try {
    const body = await request.json();
    const parsed = createSocialExportSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(400, "VALIDATION_ERROR", "Validation failed", {
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const [createdExport] = await db
      .insert(socialExports)
      .values({
        spaceId,
        testimonialId,
        format: parsed.data.format,
        status: "pending",
        metadata: {
          framing: parsed.data.framing || "blur",
          includeCaptions: parsed.data.includeCaptions,
          includeBranding: parsed.data.includeBranding,
          watermarkPosition: parsed.data.watermarkPosition,
        },
      })
      .returning();

    // Trigger asynchronous rendering
    queueSocialExport(createdExport.id);

    return NextResponse.json({ export: createdExport }, { status: 201 });
  } catch (error) {
    console.error("Failed to trigger social export:", error);
    return apiError(
      500,
      "INTERNAL_ERROR",
      "Failed to initiate social video export"
    );
  }
}
