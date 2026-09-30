import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { collectionForms } from "@/lib/db/schema";
import { badRequest, internalError, notFound } from "@/lib/api/errors";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  if (!slug || slug.length > 100) {
    return badRequest("Invalid collection link");
  }

  try {
    const [form] = await db
      .select({
        title: collectionForms.title,
        promptText: collectionForms.promptText,
        incentiveType: collectionForms.incentiveType,
        incentiveValue: collectionForms.incentiveValue,
        branding: collectionForms.branding,
      })
      .from(collectionForms)
      .where(and(eq(collectionForms.slug, slug), eq(collectionForms.isActive, true)));

    if (!form) return notFound("Collection form not found");
    return NextResponse.json({ collectionForm: form });
  } catch (error) {
    console.error("Failed to load public collection form:", error);
    return internalError("Failed to load collection form");
  }
}
