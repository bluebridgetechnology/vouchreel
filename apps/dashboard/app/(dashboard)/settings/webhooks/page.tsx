import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getSpacesWithCounts } from "@/lib/spaces/queries";
import { WebhooksManager } from "./webhooks-manager";

export const dynamic = "force-dynamic";

export default async function WebhooksSettingsPage() {
  const session = await requireSession();
  const spaces = await getSpacesWithCounts(session.user.id);

  const spaceOptions = spaces.map((s) => ({
    id: s.id,
    name: s.name,
  }));

  return (
    <div className="max-w-4xl space-y-6">
      {/* Settings Navigation Subheader */}
      <div className="flex items-center gap-4 border-b pb-4">
        <Link
          href="/settings"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          General
        </Link>
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
        <span className="text-sm font-medium text-primary border-b-2 border-primary pb-4 -mb-4">
          Webhooks
        </span>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Outbound Webhooks</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Receive real-time HTTPS notifications when testimonials are submitted, approved, or when conversion goals fire.
        </p>
      </div>

      <WebhooksManager spaces={spaceOptions} />
    </div>
  );
}
