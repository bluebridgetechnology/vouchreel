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
    <div className="flex min-h-screen flex-col bg-canvas lg:flex-row">
      <DashboardMobileHeader user={session.user} />
      <DashboardSidebar user={session.user} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
