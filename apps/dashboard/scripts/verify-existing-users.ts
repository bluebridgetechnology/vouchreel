/**
 * Marks every account that exists now as email-verified. Run it once, right before turning on
 * REQUIRE_EMAIL_VERIFICATION, so people who signed up earlier are not locked out.
 *
 *   npm run auth:verify-existing -w @vouchreel/dashboard            # shows how many it would change
 *   npm run auth:verify-existing -w @vouchreel/dashboard -- --apply # does it
 */
import { eq } from "drizzle-orm";

async function main() {
  const { db } = await import("../lib/db");
  const { user } = await import("../lib/db/schema");
  const unverified = await db.select({ id: user.id }).from(user).where(eq(user.emailVerified, false));
  if (!process.argv.includes("--apply")) {
    console.log(`${unverified.length} account(s) are not verified. Run again with --apply to mark them verified.`);
    process.exit(0);
  }
  await db.update(user).set({ emailVerified: true }).where(eq(user.emailVerified, false));
  console.log(`Marked ${unverified.length} account(s) as verified.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
