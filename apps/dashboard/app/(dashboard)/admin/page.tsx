import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getActivePaymentProviderName } from "@/lib/payments";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { AdminPanel } from "./admin-panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireSession();

  if (!isPlatformAdmin(session.user)) {
    redirect("/dashboard");
  }

  const activeProvider = await getActivePaymentProviderName();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Admin Settings</h1>
        <p className="text-text-muted mt-1 text-sm">
          Manage system-wide settings, payment processing gateways, and developer webhooks.
        </p>
      </div>

      <AdminPanel initialProvider={activeProvider} appUrl={appUrl} />
    </div>
  );
}
