import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces } from "@/lib/db/schema";
import { SpaceNavTabs } from "@/components/space-nav-tabs";

export const dynamic = "force-dynamic";

interface SpaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function SpaceDetailLayout({
  children,
  params,
}: SpaceLayoutProps) {
  const session = await requireSession();
  const { id } = await params;

  const [space] = await db
    .select({
      id: spaces.id,
      name: spaces.name,
      ownerId: spaces.ownerId,
      embedKey: spaces.embedKey,
    })
    .from(spaces)
    .where(eq(spaces.id, id));

  if (!space) {
    notFound();
  }

  if (space.ownerId !== session.user.id) {
    redirect("/spaces");
  }

  return (
    <div className="space-y-6">
      <SpaceNavTabs
        spaceId={space.id}
        spaceName={space.name}
        embedKey={space.embedKey}
      />
      <div>{children}</div>
    </div>
  );
}
