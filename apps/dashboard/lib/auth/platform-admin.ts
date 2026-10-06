/**
 * Platform admin = operator of the Vouchreel installation (manages payment gateway,
 * plans, all customers). This is NOT the same as a customer's own "owner" role,
 * which every account holds for their own workspace. Never derive platform access
 * from `user.role` or team roles.
 *
 * The flag is stored in `user.is_platform_admin` (default false), exposed on the
 * Better Auth session through `additionalFields`, and granted only with
 * `npm run admin:grant -- <email>` (the first admin) or by an existing platform admin in
 * Admin > Users (no self-service path, no signup bootstrap, never your own flag).
 */
export function isPlatformAdmin(user: unknown): boolean {
  return (user as { isPlatformAdmin?: unknown } | null | undefined)?.isPlatformAdmin === true;
}
