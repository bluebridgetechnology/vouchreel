import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { collectionForms, spaces, submissions } from "@/lib/db/schema";
import { log } from "@/lib/log";

interface RouteParams { params: Promise<{ id: string; formId: string }> }
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession(); if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Unauthorized");
  const { id, formId } = await params;
  const [space] = await db.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, id));
  if (!space) return apiError(404, "NOT_FOUND", "Space not found");
  if (space.ownerId !== session.user.id) return apiError(403, "FORBIDDEN", "Forbidden: You do not own this space");
  const [collectionForm] = await db.select().from(collectionForms).where(and(eq(collectionForms.id, formId), eq(collectionForms.spaceId, id)));
  if (!collectionForm) return apiError(404, "NOT_FOUND", "Collection form not found");
  const status = new URL(request.url).searchParams.get("status");
  if (status && !["pending", "approved", "rejected"].includes(status)) return apiError(400, "BAD_REQUEST", "Invalid submission status");
  try {
    const conditions = [eq(submissions.formId, formId)];
    if (status) conditions.push(eq(submissions.status, status as "pending" | "approved" | "rejected"));
    const items = await db.select().from(submissions).where(and(...conditions)).orderBy(desc(submissions.createdAt));
    return NextResponse.json({ collectionForm, submissions: items });
  } catch (err) { log.error("Failed to fetch submissions:", err); return apiError(500, "INTERNAL_ERROR", "Failed to fetch submissions"); }
}
