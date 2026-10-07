import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, badRequest, internalError, unauthorized, validationError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { deletionBlockers, hasPassword, sendDeletionEmail, verifyPassword } from "@/lib/account/deletion";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ password: z.string().max(200).optional() });

/**
 * POST /api/account/delete/request  { password? }
 * First step of deleting your own account: checks the password (when the account has one) and that
 * nothing blocks it, then emails a one-hour confirmation link. Nothing is deleted yet.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) return unauthorized("Unauthorized");
  const userId = session.user.id;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError("Validation failed", parsed.error.flatten().fieldErrors);

  try {
    const limit = await rateLimit(`account_delete:${userId}`, { windowMs: 60 * 60 * 1000, max: 5 });
    if (!limit.success) return badRequest("Too many attempts. Try again later.");

    if (await hasPassword(userId)) {
      if (!parsed.data.password || !(await verifyPassword(userId, parsed.data.password))) {
        return badRequest("That password is not right.");
      }
    }
    const blockers = await deletionBlockers(userId);
    if (blockers.length) return apiError(409, "BAD_REQUEST", blockers.map((b) => b.message).join(" "), { details: { blockers } });

    await sendDeletionEmail(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error("Failed to start account deletion:", error);
    return internalError("Could not start account deletion");
  }
}
