import { requireSession } from "@/lib/auth/session";
import { DashboardSidebar, DashboardMobileHeader } from "@/components/dashboard-sidebar";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <DashboardMobileHeader user={session.user} />
      <DashboardSidebar user={session.user} />
      <main className="min-w-0 flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
