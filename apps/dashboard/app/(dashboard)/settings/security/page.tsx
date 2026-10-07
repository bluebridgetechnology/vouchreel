import Link from "next/link";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { adminNeedsTwoFactorSetup } from "@/lib/auth/two-factor-policy";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SecurityForm } from "./security-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Security" };

const nav = [
  { href: "/settings", label: "General" },
  { href: "/settings/team", label: "Team Members" },
  { href: "/settings/billing", label: "Billing & Subscription" },
  { href: "/settings/api-keys", label: "API Keys" },
  { href: "/settings/webhooks", label: "Webhooks" },
  { href: "/settings/notifications", label: "Notifications" },
];

export default async function SecuritySettingsPage({ searchParams }: { searchParams: Promise<{ required?: string }> }) {
  const session = await requireSession();
  const { required } = await searchParams;
  const [row] = await db.select({ twoFactorEnabled: user.twoFactorEnabled, email: user.email }).from(user).where(eq(user.id, session.user.id));
  const mustSetUp = await adminNeedsTwoFactorSetup(session.user);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4 overflow-x-auto border-b pb-4">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "whitespace-nowrap text-sm")}>
            {item.label}
          </Link>
        ))}
        <span className="-mb-4 whitespace-nowrap border-b-2 border-brand pb-4 text-sm font-medium text-brand">Security</span>
      </div>

      <div>
        <h1 className="text-3xl font-medium tracking-tight">Security</h1>
        <p className="mt-1 text-sm text-text-muted">Protect your account with a code from an authenticator app each time you sign in.</p>
      </div>

      {(required || mustSetUp) && mustSetUp && (
        <div role="alert" className="rounded-card border border-warning/40 bg-warning-soft p-4 text-sm text-warning-foreground">
          Platform admins need two-factor sign-in. Set it up below to open the admin area.
        </div>
      )}

      <SecurityForm enabled={row?.twoFactorEnabled === true} email={row?.email ?? ""} />
    </div>
  );
}
