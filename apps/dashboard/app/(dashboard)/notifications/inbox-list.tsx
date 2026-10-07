"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export function InboxList({ items, unreadCount, emptyText }: { items: Item[]; unreadCount: number; emptyText: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markRead(body: { all: true } | { ids: string[] }) {
    const res = await fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error("Could not update notifications");
  }

  async function markAll() {
    setBusy(true);
    try {
      await markRead({ all: true });
      router.refresh();
    } catch (err) {
      notify.fromError(err, "Could not mark notifications as read");
    } finally {
      setBusy(false);
    }
  }

  async function open(item: Item) {
    if (!item.readAt) await markRead({ ids: [item.id] }).catch(() => undefined);
    if (item.href) router.push(item.href);
    else router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={markAll} loading={busy} disabled={unreadCount === 0}>
          Mark all read
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-card border border-dashed p-10 text-center text-sm text-text-muted">{emptyText}</p>
      ) : (
        <ul className="overflow-hidden rounded-card border bg-surface">
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
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-pill", item.readAt ? "bg-transparent" : "bg-brand")} aria-hidden="true" />
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
  );
}
