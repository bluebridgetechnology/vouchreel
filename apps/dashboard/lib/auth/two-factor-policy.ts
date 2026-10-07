import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

/** Platform admins must have two-factor sign-in on. Set REQUIRE_ADMIN_2FA=false only to switch the rule off. */
export function adminTwoFactorRequired(): boolean {
  return process.env.REQUIRE_ADMIN_2FA !== "false";
}

/**
 * True when this person is a platform admin who still has to set up two-factor sign-in before the
 * admin area opens. Reads the database (the signed-in session is cached for a few minutes).
 */
export async function adminNeedsTwoFactorSetup(sessionUser: { id?: string } | null | undefined): Promise<boolean> {
  if (!adminTwoFactorRequired() || !sessionUser?.id) return false;
  const [row] = await db
    .select({ isPlatformAdmin: user.isPlatformAdmin, twoFactorEnabled: user.twoFactorEnabled })
    .from(user)
    .where(eq(user.id, sessionUser.id));
  return row?.isPlatformAdmin === true && row.twoFactorEnabled !== true;
}

export const TWO_FACTOR_SETUP_PATH = "/settings/security?required=1";
export const TWO_FACTOR_REQUIRED_MESSAGE = "Set up two-factor sign-in (Settings, Security) to use the admin area.";
