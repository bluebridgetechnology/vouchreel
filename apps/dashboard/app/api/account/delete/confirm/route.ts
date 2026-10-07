import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, forbidden, internalError, unauthorized, validationError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { deleteAccount, userIdFromDeletionToken } from "@/lib/account/deletion";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ token: z.string().min(10).max(500) });

/**
 * POST /api/account/delete/confirm  { token }
 * Final step: the emailed link's token, from the signed-in owner of that account. Deletes it for good.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) return unauthorized("Unauthorized");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError("Validation failed", parsed.error.flatten().fieldErrors);

  const tokenUser = userIdFromDeletionToken(parsed.data.token);
  if (!tokenUser) return apiError(400, "BAD_REQUEST", "This link has expired or is not valid. Start again from Settings.");
  if (tokenUser !== session.user.id) return forbidden("This link belongs to a different account. Sign in to that account first.");

  try {
    const result = await deleteAccount(tokenUser);
    if (!result.ok) {
      if (result.reason === "blocked") return apiError(409, "BAD_REQUEST", result.blockers!.map((b) => b.message).join(" "), { details: { blockers: result.blockers } });
      return apiError(404, "NOT_FOUND", "Account not found");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error("Failed to delete account:", error);
    return internalError("Could not delete the account. Nothing was lost; try again, or contact support if it keeps failing.");
  }
}
