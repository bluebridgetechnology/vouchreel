import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireSession();

  return (
    <div className="max-w-4xl space-y-6">
      {/* Settings Navigation Subheader */}
      <div className="flex items-center gap-4 border-b pb-4 overflow-x-auto">
        <span className="text-sm font-medium text-brand border-b-2 border-brand pb-4 -mb-4">
          General
        </span>
        <Link
          href="/settings/team"
          className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "text-sm")}
        >
          Team Members
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
        <Link
          href="/settings/webhooks"
          className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "text-sm")}
        >
          Webhooks
        </Link>
        <Link
          href="/settings/notifications"
          className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "text-sm")}
        >
          Notifications
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-medium tracking-tight">Account Settings</h1>
        <p className="text-text-muted mt-1 text-sm">
          Manage your personal profile, team members, credentials, and developer platform settings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* User Card */}
        <div className="rounded-card border bg-surface p-4 sm:p-6 space-y-3">
          <h2 className="text-base font-medium">User Profile</h2>
          <div className="text-sm space-y-1">
            <p className="text-text-muted">
              Name: <span className="text-text font-medium">{session.user.name}</span>
            </p>
            <p className="text-text-muted">
              Email: <span className="text-text font-medium">{session.user.email}</span>
            </p>
          </div>
        </div>

        {/* Team Collaboration Card */}
        <div className="rounded-card border bg-surface p-4 sm:p-6 space-y-3">
          <h2 className="text-base font-medium">Team Collaboration</h2>
          <p className="text-sm text-text-muted">
            Invite editors and viewers to collaborate on spaces, testimonials, and widgets.
          </p>
          <div className="pt-2">
            <Link
              href="/settings/team"
              className={buttonVariants({ variant: "primary", size: "sm" })}
            >
              Manage Team Members
            </Link>
          </div>
        </div>

        {/* Notifications Card */}
        <div className="rounded-card border bg-surface p-4 sm:p-6 space-y-3 md:col-span-2">
          <h2 className="text-base font-medium">Notifications</h2>
          <p className="text-sm text-text-muted">
            Choose which events appear in your inbox and which are emailed to you.
          </p>
          <div className="pt-2">
            <Link href="/settings/notifications" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Notification settings
            </Link>
          </div>
        </div>

                {/* Developer Integrations Card */}
        <div className="rounded-card border bg-surface p-4 sm:p-6 space-y-3 md:col-span-2">
          <h2 className="text-base font-medium">Developer & API</h2>
          <p className="text-sm text-text-muted">
            Connect Vouchreel to Shopify, WordPress, Zapier, or your own custom backend services.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <Link
              href="/settings/api-keys"
              className={buttonVariants({ variant: "primary", size: "sm" })}
            >
              API Keys
            </Link>
            <Link
              href="/settings/webhooks"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Webhooks
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
