import type { NextResponse } from "next/server";
import { forbidden, unauthorized } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { isPlatformAdminFresh } from "@/lib/auth/platform-admin-server";
import { TWO_FACTOR_REQUIRED_MESSAGE, adminNeedsTwoFactorSetup } from "@/lib/auth/two-factor-policy";

type AdminSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/**
 * Route-handler guard for platform-admin endpoints.
 *   const guard = await requirePlatformAdminApi();
 *   if (!guard.ok) return guard.response;
 */
export async function requirePlatformAdminApi(): Promise<
  { ok: true; session: AdminSession } | { ok: false; response: NextResponse }
> {
  const session = await getSession();
  if (!session?.user) return { ok: false, response: unauthorized("Unauthorized") };
  if (!(await isPlatformAdminFresh(session.user))) {
    return { ok: false, response: forbidden("Forbidden: Admin access required") };
  }
  if (await adminNeedsTwoFactorSetup(session.user)) {
    return { ok: false, response: forbidden(TWO_FACTOR_REQUIRED_MESSAGE) };
  }
  return { ok: true, session };
}
