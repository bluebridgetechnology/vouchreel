import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listInbox } from "@/lib/notifications/queries";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InboxList } from "./inbox-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string; filter?: string }> }) {
  const session = await requireSession();
  const { page: rawPage, filter } = await searchParams;
  const unreadOnly = filter === "unread";
  const inbox = await listInbox(session.user.id, { page: Number(rawPage), unreadOnly });
  const query = (page: number) => `/notifications?${new URLSearchParams({ ...(unreadOnly ? { filter: "unread" } : {}), page: String(page) })}`;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-text-muted">
            {inbox.unreadCount > 0 ? `${inbox.unreadCount} unread` : "You are all caught up"}.{" "}
            <Link href="/settings/notifications" className="underline-offset-4 hover:underline">
              Choose what you get
            </Link>
          </p>
        </div>
        <div className="flex gap-1 rounded-control border bg-surface-sunken/40 p-0.5 text-xs" role="group" aria-label="Filter">
          <Link href="/notifications" aria-current={!unreadOnly ? "page" : undefined} className={cn(buttonVariants({ variant: !unreadOnly ? "outline" : "ghost", size: "sm" }), "h-7")}>
            All
          </Link>
          <Link href="/notifications?filter=unread" aria-current={unreadOnly ? "page" : undefined} className={cn(buttonVariants({ variant: unreadOnly ? "outline" : "ghost", size: "sm" }), "h-7")}>
            Unread
          </Link>
        </div>
      </div>

      <InboxList
        items={inbox.items.map((n) => ({ ...n, createdAt: n.createdAt.toISOString(), readAt: n.readAt?.toISOString() ?? null }))}
        unreadCount={inbox.unreadCount}
        emptyText={unreadOnly ? "Nothing unread." : "Submissions, exports and alerts will appear here."}
      />

      {inbox.pages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pages">
          {inbox.page > 1 ? (
            <Link href={query(inbox.page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-text-muted">
            Page {inbox.page} of {inbox.pages}
          </span>
          {inbox.page < inbox.pages ? (
            <Link href={query(inbox.page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Older
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
