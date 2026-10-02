import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getPreferences } from "@/lib/notifications/queries";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PreferencesForm } from "./preferences-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

const nav = [
  { href: "/settings", label: "General" },
  { href: "/settings/team", label: "Team Members" },
  { href: "/settings/billing", label: "Billing & Subscription" },
  { href: "/settings/api-keys", label: "API Keys" },
  { href: "/settings/webhooks", label: "Webhooks" },
];

export default async function NotificationSettingsPage() {
  const session = await requireSession();
  const preferences = await getPreferences(session.user.id);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4 overflow-x-auto border-b pb-4">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "whitespace-nowrap text-sm")}
          >
            {item.label}
          </Link>
        ))}
        <span className="-mb-4 whitespace-nowrap border-b-2 border-brand pb-4 text-sm font-medium text-brand">
          Notifications
        </span>
      </div>

      <div>
        <h1 className="text-3xl font-medium tracking-tight">Notifications</h1>
        <p className="mt-1 text-sm text-text-muted">
          Choose what shows up in your inbox and what is emailed to {session.user.email}.
        </p>
      </div>

      <PreferencesForm initial={preferences} />
    </div>
  );
}
