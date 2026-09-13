import { redirect } from "next/navigation";
import { eq, count } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function DashboardRootPage() {
  const session = await requireSession();

  const [result] = await db
    .select({ value: count() })
    .from(spaces)
    .where(eq(spaces.ownerId, session.user.id));

  const spaceCount = result?.value ?? 0;

  if (spaceCount === 0) {
    redirect("/onboarding");
  }

  redirect("/spaces");
}
