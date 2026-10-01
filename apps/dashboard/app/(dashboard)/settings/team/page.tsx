import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { teamMembers, teamInvites, user } from "@/lib/db/schema";
import { eq, and, isNotNull, gt } from "drizzle-orm";
import { canAccess } from "@/lib/auth/feature-gate";
import { TeamManager } from "./team-manager";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const session = await requireSession();

  // 1. Fetch team owner record
  const [ownerRecord] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, session.user.id));

  // 2. Fetch active members
  const memberRecords = await db
    .select({
      id: teamMembers.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: teamMembers.role,
      joinedAt: teamMembers.acceptedAt,
    })
    .from(teamMembers)
    .innerJoin(user, eq(teamMembers.userId, user.id))
    .where(
      and(
        eq(teamMembers.teamOwnerId, session.user.id),
        isNotNull(teamMembers.acceptedAt)
      )
    );

  const initialMembers = [
    {
      id: "owner",
      userId: ownerRecord ? ownerRecord.id : session.user.id,
      name: ownerRecord?.name || session.user.name || "Account Owner",
      email: ownerRecord?.email || session.user.email || "",
      image: ownerRecord?.image,
      role: "owner" as const,
      joinedAt: ownerRecord ? ownerRecord.createdAt.toISOString() : new Date().toISOString(),
      isOwner: true,
    },
    ...memberRecords.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.name,
      email: m.email,
      image: m.image,
      role: m.role as "owner" | "editor" | "viewer",
      joinedAt: m.joinedAt ? m.joinedAt.toISOString() : new Date().toISOString(),
      isOwner: false,
    })),
  ];

  // 3. Fetch pending unexpired invites
  const inviteRecords = await db
    .select({
      id: teamInvites.id,
      email: teamInvites.email,
      role: teamInvites.role,
      expiresAt: teamInvites.expiresAt,
      createdAt: teamInvites.createdAt,
    })
    .from(teamInvites)
    .where(
      and(
        eq(teamInvites.teamOwnerId, session.user.id),
        gt(teamInvites.expiresAt, new Date())
      )
    );

  const initialInvites = inviteRecords.map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role as "owner" | "editor" | "viewer",
    expiresAt: inv.expiresAt.toISOString(),
    createdAt: inv.createdAt.toISOString(),
  }));

  // 4. Feature entitlement
  const isEntitled = await canAccess(session.user.id, "multi-seat");

  return (
    <div className="max-w-4xl space-y-6">
      {/* Settings Navigation Subheader */}
      <div className="flex items-center gap-4 border-b pb-4 overflow-x-auto">
        <Link
          href="/settings"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          General
        </Link>
        <span className="text-sm font-medium text-primary border-b-2 border-primary pb-4 -mb-4">
          Team Members
        </span>
        <Link
          href="/settings/billing"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Billing & Subscription
        </Link>
        <Link
          href="/settings/api-keys"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          API Keys
        </Link>
        <Link
          href="/settings/webhooks"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Webhooks
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-medium tracking-tight">Team Management</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage account members, configure role permissions, and invite collaborators.
        </p>
      </div>

      <TeamManager
        initialMembers={initialMembers}
        initialInvites={initialInvites}
        currentUserId={session.user.id}
        isEntitled={isEntitled}
      />
    </div>
  );
}
