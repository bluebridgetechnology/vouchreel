import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { getActivePaymentProviderName } from "@/lib/payments";
import { getFfmpegStatus } from "@/lib/media/ffmpeg";
import { listAdminPlans } from "@/lib/admin/plans";
import { getJobOverview, listAdminVideos } from "@/lib/admin/jobs";
import { listAdminUsers, listAuditLog } from "@/lib/admin/queries";
import { timeAgo } from "@/lib/time-ago";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminPanel } from "./admin-panel";
import { JobsManager } from "./jobs-manager";
import { UsersManager } from "./users-manager";
import { PlansManager } from "./plans-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

const TABS = [
  { id: "plans", label: "Plans & pricing" },
  { id: "payments", label: "Payments" },
  { id: "users", label: "Users" },
  { id: "videos", label: "Video & jobs" },
  { id: "audit", label: "Audit log" },
  { id: "system", label: "System" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}) {
  const session = await requireSession();
  if (!isPlatformAdmin(session.user)) {
    redirect("/dashboard");
  }

  const { tab: rawTab, q, page: rawPage } = await searchParams;
  const tab: TabId = TABS.some((t) => t.id === rawTab) ? (rawTab as TabId) : "plans";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-text-muted">
          Platform settings, plans and pricing, customers and an audit trail of changes made here.
        </p>
      </div>

      <nav aria-label="Admin sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="inline-flex min-w-max items-center gap-1 rounded-pill bg-surface-sunken p-1">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`/admin?tab=${t.id}`}
              aria-current={tab === t.id ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center whitespace-nowrap rounded-pill px-4 text-sm font-medium transition-colors",
                tab === t.id ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </nav>

      {tab === "plans" && <PlansTab />}
      {tab === "payments" && <PaymentsTab />}
      {tab === "users" && <UsersTab q={q} page={Number(rawPage) || 1} currentUserId={session.user.id} />}
      {tab === "videos" && <VideosTab />}
      {tab === "audit" && <AuditTab />}
      {tab === "system" && <SystemTab />}
    </div>
  );
}

async function PlansTab() {
  const plans = await listAdminPlans();
  return <PlansManager plans={plans} />;
}

async function PaymentsTab() {
  const activeProvider = await getActivePaymentProviderName();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return <AdminPanel initialProvider={activeProvider} appUrl={appUrl} />;
}

async function UsersTab({ q, page, currentUserId }: { q?: string; page: number; currentUserId: string }) {
  const [result, plans] = await Promise.all([listAdminUsers(q, page), listAdminPlans()]);
  return (
    <div className="space-y-4">
      <form action="/admin" className="flex max-w-md gap-2">
        <input type="hidden" name="tab" value="users" />
        <Input name="q" defaultValue={q} placeholder="Search by name or email" aria-label="Search users" />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      <UsersManager
        users={result.rows}
        plans={plans.map((p) => ({ id: p.id, name: p.name, price: p.price, interval: p.interval, isActive: p.isActive }))}
        currentUserId={currentUserId}
        q={q}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
      />
    </div>
  );
}

async function VideosTab() {
  const [overview, videos] = await Promise.all([getJobOverview(), listAdminVideos()]);
  return <JobsManager overview={overview} videos={videos} />;
}

async function AuditTab() {
  const entries = await listAuditLog();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Who</TableHead>
          <TableHead>What</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e) => (
          <TableRow key={e.id}>
            <TableCell className="whitespace-nowrap text-text-muted">{timeAgo(e.createdAt)}</TableCell>
            <TableCell className="text-text-muted">{e.actorEmail ?? "Deleted user"}</TableCell>
            <TableCell>
              <div>{e.summary}</div>
              <div className="text-xs text-text-subtle">{e.action}</div>
            </TableCell>
          </TableRow>
        ))}
        {entries.length === 0 && (
          <TableRow>
            <TableCell colSpan={3} className="py-10 text-center text-text-muted">
              Nothing recorded yet. Plan edits, payment-provider changes and job retries or cancellations appear here.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

async function SystemTab() {
  const ffmpeg = await getFfmpegStatus(true);
  return (
    <Card>
      <CardHeader>
        <CardTitle>System health</CardTitle>
        <CardDescription>
          Video transcoding and social exports need FFmpeg on the server. Serverless hosts cannot run it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span>FFmpeg</span>
          {ffmpeg.available ? (
            <Badge variant="success">Installed{ffmpeg.version ? ` · ${ffmpeg.version}` : ""}</Badge>
          ) : (
            <Badge variant="danger">Not installed</Badge>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Burned-in captions (drawtext)</span>
          {ffmpeg.available ? (
            <Badge variant={ffmpeg.drawtext ? "success" : "warning"}>{ffmpeg.drawtext ? "Available" : "Missing filter"}</Badge>
          ) : (
            <Badge>Unknown</Badge>
          )}
        </div>
        {!ffmpeg.available && (
          <p className="rounded-control bg-danger-soft px-3 py-2 text-xs text-danger-foreground">
            {ffmpeg.error} Install it (winget install Gyan.FFmpeg, brew install ffmpeg, apt install ffmpeg) or set FFMPEG_PATH,
            then restart the server.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
