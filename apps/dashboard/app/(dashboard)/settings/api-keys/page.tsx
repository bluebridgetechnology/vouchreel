import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getSpacesWithCounts } from "@/lib/spaces/queries";
import { ApiKeysManager } from "./api-keys-manager";

export const dynamic = "force-dynamic";

export default async function ApiKeysSettingsPage() {
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
        <span className="text-sm font-medium text-primary border-b-2 border-primary pb-4 -mb-4">
          API Keys
        </span>
        <Link
          href="/settings/webhooks"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Webhooks
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-medium tracking-tight">API Keys</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage API keys for programmatic access to the Vouchreel REST API and external integrations.
        </p>
      </div>

      <ApiKeysManager spaces={spaceOptions} />
    </div>
  );
}
