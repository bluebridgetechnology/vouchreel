"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth/auth-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/marketing/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notifications/notification-bell";
import type { IconName } from "@/lib/icons.generated";
import { cn } from "@/lib/utils";

interface DashboardUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  isPlatformAdmin?: boolean | null;
}

interface DashboardSidebarProps {
  user: DashboardUser;
}

function isAdminUser(user: DashboardUser) {
  return user.isPlatformAdmin === true;
}

function isItemActive(pathname: string, href: string) {
  if (href === "/spaces") {
    return pathname === "/spaces" || pathname.startsWith("/spaces/");
  }
  if (href === "/agency") {
    return pathname === "/agency" || pathname.startsWith("/agency/");
  }
  if (href === "/settings") {
    return (
      pathname === "/settings" ||
      (pathname.startsWith("/settings/") && !pathname.startsWith("/settings/billing"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getNavItems(isAdmin: boolean): { label: string; href: string; icon: IconName }[] {
  return [
    { label: "Spaces", href: "/spaces", icon: "layers-minimalistic" },
    { label: "Agency", href: "/agency", icon: "buildings-2" },
    { label: "Billing", href: "/settings/billing", icon: "card" },
    { label: "Settings", href: "/settings", icon: "settings" },
    ...(isAdmin ? [{ label: "Admin", href: "/admin", icon: "shield-check" as const }] : []),
  ];
}

async function handleSignOut() {
  await signOut({
    fetchOptions: {
      onSuccess: () => {
        window.location.href = "/login";
      },
    },
  });
}

function NavLinks({ user, onNavigate }: DashboardSidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = getNavItems(isAdminUser(user));
  return (
    <nav aria-label="Dashboard" className="flex-1 space-y-1 px-3 py-4">
      {items.map((item) => {
        const active = isItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-pill px-4 text-sm font-medium transition-colors",
              active
                ? "bg-brand-soft text-brand-soft-foreground"
                : "text-text-muted hover:bg-surface-sunken hover:text-text"
            )}
          >
            <Icon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserPanel({ user }: DashboardSidebarProps) {
  const initial = (user.name?.charAt(0) || user.email.charAt(0)).toUpperCase();
  return (
    <div className="space-y-3 border-t p-4">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name || "User"}</p>
          <p className="truncate text-xs text-text-muted">{user.email}</p>
        </div>
        {user.isPlatformAdmin && <Badge variant="brand">Admin</Badge>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <ThemeToggle />
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <Icon name="logout" size="sm" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-surface lg:flex">
      <div className="flex h-18 items-center justify-between gap-2 px-6">
        <Logo href="/dashboard" />
        <NotificationBell align="start" />
      </div>
      <NavLinks user={user} />
      <UserPanel user={user} />
    </aside>
  );
}

export function DashboardMobileHeader({ user }: DashboardSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-(--z-nav) flex h-14 items-center justify-between gap-3 border-b bg-surface/90 px-4 backdrop-blur-md lg:hidden">
      <Logo href="/dashboard" />
      <div className="flex items-center gap-2">
        <NotificationBell />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label="Open menu">
              <Icon name="hamburger-menu" size="sm" />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex h-14 items-center px-5">
              <Logo href="/dashboard" />
            </div>
            <NavLinks user={user} onNavigate={() => setOpen(false)} />
            <UserPanel user={user} />
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
