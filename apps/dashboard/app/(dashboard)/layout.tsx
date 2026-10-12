import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { DashboardShell } from "@/components/dashboard-shell";
import { SIDEBAR_COOKIE } from "@/lib/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <DashboardShell user={session.user} initialCollapsed={collapsed}>
      {children}
    </DashboardShell>
  );
}
