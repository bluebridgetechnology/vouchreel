import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getSpacesWithCounts } from "@/lib/spaces/queries";
import { WebhooksManager } from "./webhooks-manager";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

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
        <Link
          href="/settings/api-keys"
          className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "text-sm")}
        >
          API Keys
        </Link>
        <span className="text-sm font-medium text-brand border-b-2 border-brand pb-4 -mb-4">
          Webhooks
        </span>
      </div>

      <div>
        <h1 className="text-3xl font-medium tracking-tight">Outbound Webhooks</h1>
        <p className="text-text-muted mt-1 text-sm">
          Receive real-time HTTPS notifications when testimonials are submitted, approved, or when conversion goals fire.
        </p>
      </div>

      <WebhooksManager spaces={spaceOptions} />
    </div>
  );
}
