"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DashboardMobileHeader, DashboardSidebar } from "@/components/dashboard-sidebar";
import { isCanvasPath, SIDEBAR_COOKIE } from "@/lib/dashboard-shell";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  user: { id: string; name: string; email: string; image?: string | null; isPlatformAdmin?: boolean | null };
  /** From the cookie, so the first paint already has the sidebar the way the owner left it. */
  initialCollapsed: boolean;
  children: React.ReactNode;
}

/**
 * The dashboard's frame: sidebar and page. The sidebar can be collapsed to an icon rail (remembered in a cookie).
 * On a canvas page (the widget editor) it starts collapsed whatever was chosen, without changing the choice, and
 * the page may use the full width.
 */
export function DashboardShell({ user, initialCollapsed, children }: DashboardShellProps) {
  const pathname = usePathname();
  const canvas = isCanvasPath(pathname);
  const [stored, setStored] = useState(initialCollapsed);
  const [openOnCanvas, setOpenOnCanvas] = useState(false);

  // Leaving the canvas puts the sidebar back as it was chosen
  useEffect(() => setOpenOnCanvas(false), [canvas]);

  const collapsed = canvas ? !openOnCanvas : stored;

  function toggle() {
    if (canvas) {
      setOpenOnCanvas((open) => !open);
      return;
    }
    const next = !stored;
    setStored(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:flex-row">
      <DashboardMobileHeader user={user} />
      <DashboardSidebar user={user} collapsed={collapsed} onToggle={toggle} />
      <main className={cn("min-w-0 flex-1 px-4 py-6 sm:px-6", canvas ? "lg:px-5 lg:py-4" : "lg:px-10 lg:py-10")}>
        <div className={cn("mx-auto w-full", canvas ? "max-w-none" : "max-w-6xl")}>{children}</div>
      </main>
    </div>
  );
}
