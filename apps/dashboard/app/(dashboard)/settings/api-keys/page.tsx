import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getSpacesWithCounts } from "@/lib/spaces/queries";
import { ApiKeysManager } from "./api-keys-manager";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

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
          className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "text-sm")}
        >
          General
        </Link>
        <Link
          href="/settings/billing"
          className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "text-sm")}
        >
          Billing & Subscription
        </Link>
        <span className="text-sm font-medium text-brand border-b-2 border-brand pb-4 -mb-4">
          API Keys
        </span>
        <Link
          href="/settings/webhooks"
          className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "text-sm")}
        >
          Webhooks
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-medium tracking-tight">API Keys</h1>
        <p className="text-text-muted mt-1 text-sm">
          Manage API keys for programmatic access to the Vouchreel REST API and external integrations.
        </p>
      </div>

      <ApiKeysManager spaces={spaceOptions} />
    </div>
  );
}
