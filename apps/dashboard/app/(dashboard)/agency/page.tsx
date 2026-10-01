import { requireSession } from "@/lib/auth/session";
import { getAgencyOverview } from "@/lib/agency/queries";
import { canAccess } from "@/lib/auth/feature-gate";
import { canCreateSpace } from "@/lib/payments/subscription";
import { db } from "@/lib/db";
import { spaces } from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";
import { AgencyView } from "./agency-view";

export const dynamic = "force-dynamic";

export default async function AgencyDashboardPage() {
  const session = await requireSession();

  // 1. Fetch initial overview metrics
  const initialData = await getAgencyOverview(session.user.id);

  // 2. Check agency tier entitlement
  const isEntitled = await canAccess(session.user.id, "agency-dashboard");

  // 3. Check space limit
  const [spaceCountResult] = await db
    .select({ value: count() })
    .from(spaces)
    .where(eq(spaces.ownerId, session.user.id));

  const currentCount = spaceCountResult?.value ?? 0;
  const canCreateMoreSpaces = await canCreateSpace(session.user.id, currentCount);

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Agency Cockpit</h1>
        <p className="text-text-muted mt-1 text-sm">
          Multi-space overview, aggregate conversion tracking, and 1-click executive reporting for all your clients.
        </p>
      </div>

      <AgencyView
        initialData={initialData}
        isEntitled={isEntitled}
        canCreateMoreSpaces={canCreateMoreSpaces}
      />
    </div>
  );
}
