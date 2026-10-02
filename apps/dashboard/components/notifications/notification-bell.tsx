"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { notify } from "@/lib/notify";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

const POLL_MS = 60_000;

/** Bell with unread badge and inbox dropdown. Polls while visible and refreshes on focus. */
export function NotificationBell({ className }: { className?: string }) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=15", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items);
      setUnread(data.unreadCount);
    } catch {
      // Silent: the bell is passive, a failed poll should not interrupt the user
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  async function markRead(body: { all: true } | { ids: string[] }) {
    const res = await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Could not update notifications");
  }

  async function markAllRead() {
    const previous = { items, unread };
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnread(0);
    try {
      await markRead({ all: true });
    } catch (err) {
      setItems(previous.items);
      setUnread(previous.unread);
      notify.fromError(err, "Could not mark notifications as read");
    }
  }

  async function open(item: NotificationItem) {
    if (!item.readAt) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
      setUnread((u) => Math.max(0, u - 1));
      markRead({ ids: [item.id] }).catch(() => undefined);
    }
    if (item.href) router.push(item.href);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          className={cn("relative", className)}
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Icon name="bell" size="sm" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-brand px-1 text-2xs font-medium text-text-on-accent">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">Notifications</p>
          <Button variant="link" size="bare" className="text-xs" onClick={markAllRead} disabled={unread === 0}>
            Mark all read
          </Button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {!loaded ? (
            <p className="px-4 py-8 text-center text-sm text-text-muted">Loading…</p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <span className="flex size-10 items-center justify-center rounded-pill bg-brand-soft text-brand-soft-foreground">
                <Icon name="bell" />
              </span>
              <p className="text-sm font-medium">You are all caught up</p>
              <p className="text-xs text-text-muted">New submissions, exports and alerts will appear here.</p>
            </div>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => open(item)}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "bare" }),
                      "w-full items-start justify-start gap-3 whitespace-normal rounded-none border-b px-4 py-3 text-left font-normal last:border-b-0",
                      !item.readAt && "bg-brand-soft/40",
                    )}
                  >
                    <span
                      className={cn("mt-1.5 size-2 shrink-0 rounded-pill", item.readAt ? "bg-transparent" : "bg-brand")}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{item.title}</span>
                      {item.body && <span className="mt-0.5 block text-xs text-text-muted">{item.body}</span>}
                      <span className="mt-1 block text-2xs text-text-subtle">{timeAgo(item.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t px-4 py-2.5">
          <Link href="/settings/notifications" className="text-xs text-text-muted hover:text-text">
            Notification settings
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
