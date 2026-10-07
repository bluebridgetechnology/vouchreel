import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSuspension } from "@/lib/auth/suspended";

/**
 * Get the current session on the server side.
 * Returns the session if authenticated, null otherwise.
 */
export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  // A suspended account has no session, even with a valid cookie
  if (session?.user && (await getSuspension(session.user.id)).suspended) return null;
  return session;
}

/**
 * Require authentication — redirects to /login if no session.
 * Use in server components and route handlers that need auth.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}
