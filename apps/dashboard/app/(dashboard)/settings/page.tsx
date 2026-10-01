import Link from "next/link";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireSession();

  return (
    <div className="max-w-4xl space-y-6">
      {/* Settings Navigation Subheader */}
      <div className="flex items-center gap-4 border-b pb-4">
        <span className="text-sm font-medium text-primary border-b-2 border-primary pb-4 -mb-4">
          General
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
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your personal profile, credentials, and developer platform settings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* User Card */}
        <div className="rounded-lg border bg-card p-6 space-y-3">
          <h2 className="text-base font-semibold">User Profile</h2>
          <div className="text-sm space-y-1">
            <p className="text-muted-foreground">
              Name: <span className="text-foreground font-medium">{session.user.name}</span>
            </p>
            <p className="text-muted-foreground">
              Email: <span className="text-foreground font-medium">{session.user.email}</span>
            </p>
          </div>
        </div>

        {/* Developer Integrations Card */}
        <div className="rounded-lg border bg-card p-6 space-y-3">
          <h2 className="text-base font-semibold">Developer & API</h2>
          <p className="text-sm text-muted-foreground">
            Connect Vouchreel to Shopify, WordPress, Zapier, or your own custom backend services.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <Link
              href="/settings/api-keys"
              className="text-xs font-semibold px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90"
            >
              API Keys
            </Link>
            <Link
              href="/settings/webhooks"
              className="text-xs font-semibold px-3 py-1.5 rounded border hover:bg-accent"
            >
              Webhooks
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
