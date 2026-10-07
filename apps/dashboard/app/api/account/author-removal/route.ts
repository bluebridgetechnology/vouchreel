import { NextResponse } from "next/server";
import { z } from "zod";
import { internalError, unauthorized, validationError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { previewRemoval, removeByEmail } from "@/lib/account/author-removal";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ email: z.string().trim().email().max(254), confirm: z.boolean().default(false) });

/**
 * POST /api/account/author-removal  { email, confirm? }
 * For a person who wrote a testimonial and asks to be forgotten. Without `confirm` it only counts what
 * would go; with it, the submissions, testimonials, consents and videos for that email in the signed-in
 * owner's spaces are deleted and their files queued for removal.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) return unauthorized("Unauthorized");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("Validation failed", parsed.error.flatten().fieldErrors);
  try {
    if (!parsed.data.confirm) return NextResponse.json({ preview: await previewRemoval(session.user.id, parsed.data.email) });
    const result = await removeByEmail(session.user.id, parsed.data.email);
    log.info("[account] removed a testimonial author's data", { ownerId: session.user.id, ...result });
    return NextResponse.json({ removed: result });
  } catch (error) {
    log.error("Failed author removal:", error);
    return internalError("Could not remove that person's data");
  }
}
