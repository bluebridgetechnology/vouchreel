import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { getActivePaymentProviderName } from "@/lib/payments";
import { getFfmpegStatus } from "@/lib/media/ffmpeg";
import { listAdminPlans } from "@/lib/admin/plans";
import { getJobOverview, listAdminVideos } from "@/lib/admin/jobs";
import { capabilityProblem, getWorkerHealth, type KindHealth, type Severity } from "@/lib/admin/workers";
import { formatLimit, formatUsd, getUsageReport, limitState, parseMonth, shiftMonth, type LimitState } from "@/lib/admin/usage";
import { listAdminUsers, listAuditEntityTypes, listAuditLog, type AuditFilter } from "@/lib/admin/queries";
import { timeAgo } from "@/lib/time-ago";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminPanel } from "./admin-panel";
import { AuditTypeSelect } from "./audit-type-select";
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
  { id: "usage", label: "Usage" },
  { id: "audit", label: "Audit log" },
  { id: "system", label: "System" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string; type?: string; from?: string; to?: string; month?: string }>;
}) {
  const session = await requireSession();
  if (!isPlatformAdmin(session.user)) {
    redirect("/dashboard");
  }

  const { tab: rawTab, q, page: rawPage, type, from, to, month } = await searchParams;
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
      {tab === "usage" && <UsageTab month={month} page={Number(rawPage) || 1} />}
      {tab === "audit" && <AuditTab filter={{ q, entityType: type && type !== "all" ? type : undefined, from, to }} page={Number(rawPage) || 1} />}
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
  const [overview, videos, health] = await Promise.all([getJobOverview(), listAdminVideos(), getWorkerHealth()]);
  const alerts = health.kinds.filter((k) => k.severity !== "ok");
  return (
    <div className="space-y-6">
      {alerts.map((k) => (
        <WorkerAlert key={k.kind} health={k} />
      ))}
      <JobsManager overview={overview} videos={videos} />
    </div>
  );
}

const LIMIT_BADGE: Record<LimitState, { label: string; variant: "neutral" | "success" | "warning" | "danger" } | null> = {
  none: null,
  ok: null,
  unlimited: null,
  not_in_plan: null,
  at: { label: "At limit", variant: "warning" },
  over: { label: "Over limit", variant: "danger" },
};

function CreditCell({ used, limit }: { used: number; limit: number }) {
  const badge = LIMIT_BADGE[limitState(used, limit)];
  return (
    <div className="flex flex-wrap items-center gap-2 tabular-nums">
      <span>
        {used} <span className="text-text-muted">/ {limit <= 0 && limit !== Infinity ? "not in plan" : formatLimit(limit)}</span>
      </span>
      {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
    </div>
  );
}

async function UsageTab({ month: rawMonth, page }: { month?: string; page: number }) {
  const report = await getUsageReport(rawMonth, page);
  const { totals } = report;
  const current = parseMonth(undefined).month;
  const href = (m: string, p = 1) => `/admin?tab=usage&month=${m}&page=${p}`;
  const pages = Math.max(1, Math.ceil(report.totalAccounts / report.pageSize));
  const label = new Date(`${report.month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const cards: { title: string; value: string; hint?: string }[] = [
    { title: "Review video credits", value: String(totals.reviewCredits) },
    { title: "AI video credits", value: String(totals.aiCredits) },
    { title: "AI provider cost", value: formatUsd(totals.aiCostCents), hint: "Includes failed attempts" },
    { title: "Failed videos", value: String(totals.failed), hint: "Credit refunded" },
    { title: "Accounts using credits", value: String(totals.accounts) },
    {
      title: "Avg review render",
      value: totals.avgReviewRenderMs ? `${(totals.avgReviewRenderMs / 1000).toFixed(1)}s` : "-",
      hint: "Finished review videos",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-medium">{label}</h2>
          <p className="text-xs text-text-muted">UTC calendar month. Credits are per account; failed videos do not count.</p>
        </div>
        <nav aria-label="Usage month" className="flex items-center gap-2 text-sm">
          <Link href={href(shiftMonth(report.month, -1))} className="rounded-control border px-3 py-1.5 hover:bg-surface-sunken">
            Previous month
          </Link>
          {report.month < current && (
            <Link href={href(shiftMonth(report.month, 1))} className="rounded-control border px-3 py-1.5 hover:bg-surface-sunken">
              Next month
            </Link>
          )}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardContent className="p-4">
              <div className="text-xs text-text-muted">{c.title}</div>
              <div className="mt-1 text-2xl font-medium tabular-nums">{c.value}</div>
              {c.hint && <div className="mt-0.5 text-xs text-text-subtle">{c.hint}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Review videos</TableHead>
            <TableHead>AI videos</TableHead>
            <TableHead>AI cost</TableHead>
            <TableHead>Failed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.accounts.map((a) => (
            <TableRow key={a.ownerId}>
              <TableCell>
                <div className="font-medium">{a.name}</div>
                <div className="text-xs text-text-muted">{a.email}</div>
              </TableCell>
              <TableCell>{a.planName ?? <span className="text-text-muted">Free</span>}</TableCell>
              <TableCell>
                <CreditCell used={a.reviewCredits} limit={a.reviewLimit} />
              </TableCell>
              <TableCell>
                <CreditCell used={a.aiCredits} limit={a.aiLimit} />
              </TableCell>
              <TableCell className="tabular-nums">{formatUsd(a.aiCostCents)}</TableCell>
              <TableCell className="tabular-nums text-text-muted">{a.failed}</TableCell>
            </TableRow>
          ))}
          {report.accounts.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-text-muted">
                No video credits were used in {label}.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-subtle">
        <span>{report.totalAccounts === 0 ? "0 accounts" : `${(report.page - 1) * report.pageSize + 1} to ${Math.min(report.page * report.pageSize, report.totalAccounts)} of ${report.totalAccounts} accounts`}</span>
        <nav aria-label="Usage pages" className="flex items-center gap-2">
          {report.page > 1 && (
            <Link href={href(report.month, report.page - 1)} className="rounded-control border px-3 py-1.5 text-text hover:bg-surface-sunken">
              Previous
            </Link>
          )}
          <span>
            Page {report.page} of {pages}
          </span>
          {report.page < pages && (
            <Link href={href(report.month, report.page + 1)} className="rounded-control border px-3 py-1.5 text-text hover:bg-surface-sunken">
              Next
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
}

async function AuditTab({ filter, page }: { filter: AuditFilter; page: number }) {
  const [result, types] = await Promise.all([listAuditLog(filter, page), listAuditEntityTypes()]);
  const { rows: entries, total, pageSize } = result;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const filtered = !!(filter.q || filter.entityType || filter.from || filter.to);
  const href = (p: number) => {
    const params = new URLSearchParams({ tab: "audit", page: String(p) });
    if (filter.q) params.set("q", filter.q);
    if (filter.entityType) params.set("type", filter.entityType);
    if (filter.from) params.set("from", filter.from);
    if (filter.to) params.set("to", filter.to);
    return `/admin?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <form action="/admin" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value="audit" />
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Search
          <Input name="q" defaultValue={filter.q} placeholder="Summary, action or admin email" className="w-64" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Type
          <AuditTypeSelect types={types} value={filter.entityType} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          From
          <Input type="date" name="from" defaultValue={filter.from} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          To
          <Input type="date" name="to" defaultValue={filter.to} />
        </label>
        <Button type="submit" variant="outline">
          Filter
        </Button>
        {filtered && (
          <Link href="/admin?tab=audit" className="pb-2 text-sm text-text-muted underline">
            Clear
          </Link>
        )}
      </form>

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
              <TableCell className="whitespace-nowrap text-text-muted" title={e.createdAt.toISOString()}>
                {timeAgo(e.createdAt)}
              </TableCell>
              <TableCell className="text-text-muted">{e.actorEmail ?? "Deleted user"}</TableCell>
              <TableCell>
                <div>{e.summary}</div>
                <div className="text-xs text-text-subtle">
                  {e.action}
                  {e.entityId ? ` · ${e.entityType} ${e.entityId}` : ""}
                </div>
                {Object.keys(e.changes).length > 0 && (
                  <details className="mt-1 text-xs text-text-muted">
                    <summary className="cursor-pointer">Details</summary>
                    <pre className="mt-1 max-w-xl overflow-x-auto whitespace-pre-wrap rounded-control bg-surface-sunken p-2 font-mono">
                      {JSON.stringify(e.changes, null, 2)}
                    </pre>
                  </details>
                )}
              </TableCell>
            </TableRow>
          ))}
          {entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="py-10 text-center text-text-muted">
                {filtered
                  ? "No entries match these filters."
                  : "Nothing recorded yet. Plan edits, payment-provider changes, user changes and job retries or cancellations appear here."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-subtle">
        <span>{total === 0 ? "0 entries" : `${(result.page - 1) * pageSize + 1} to ${Math.min(result.page * pageSize, total)} of ${total} entries`}</span>
        <nav aria-label="Audit log pages" className="flex items-center gap-2">
          {result.page > 1 && (
            <Link href={href(result.page - 1)} className="rounded-control border px-3 py-1.5 text-text hover:bg-surface-sunken">
              Newer
            </Link>
          )}
          <span>
            Page {result.page} of {pages}
          </span>
          {result.page < pages && (
            <Link href={href(result.page + 1)} className="rounded-control border px-3 py-1.5 text-text hover:bg-surface-sunken">
              Older
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
}

const SEVERITY_BADGE: Record<Severity, { label: string; variant: "success" | "warning" | "danger" }> = {
  ok: { label: "Healthy", variant: "success" },
  warning: { label: "Attention", variant: "warning" },
  critical: { label: "Not working", variant: "danger" },
};

function WorkerAlert({ health }: { health: KindHealth }) {
  const danger = health.severity === "critical";
  return (
    <div
      role="alert"
      className={cn(
        "rounded-card border px-4 py-3 text-sm",
        danger ? "border-danger/30 bg-danger-soft text-danger-foreground" : "border-warning/30 bg-warning-soft text-warning-foreground",
      )}
    >
      <span className="font-medium">{health.label}: </span>
      {health.message}{" "}
      <Link href="/admin?tab=system" className="underline">
        Details
      </Link>
    </div>
  );
}

async function WorkersCard() {
  const { workers, kinds } = await getWorkerHealth();
  const STATUS = {
    online: { label: "Online", variant: "success" },
    not_responding: { label: "Not responding", variant: "danger" },
    stopped: { label: "Stopped", variant: "neutral" },
  } as const;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Background workers</CardTitle>
        <CardDescription>
          Workers report in every 15 seconds. One that has been silent for 45 seconds is shown as not responding. Only processes
          seen in the last 24 hours are listed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <div className="space-y-3">
          {kinds.map((k) => (
            <div key={k.kind} className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium">{k.label}</div>
                <div className="text-xs text-text-muted">{k.message}</div>
              </div>
              <Badge variant={SEVERITY_BADGE[k.severity].variant}>{SEVERITY_BADGE[k.severity].label}</Badge>
            </div>
          ))}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Process</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Jobs claimed</TableHead>
              <TableHead>Found at start-up</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workers.map((w) => {
              const problem = capabilityProblem(w);
              return (
                <TableRow key={w.workerId}>
                  <TableCell>
                    <div className="font-medium">{w.kind === "video-worker" ? "Video worker" : "Job worker"}</div>
                    <div className="text-xs text-text-muted">
                      {w.hostname ?? "unknown host"} · pid {w.pid ?? "?"} · concurrency {w.concurrency}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS[w.status].variant}>{STATUS[w.status].label}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-text-muted">{timeAgo(w.lastSeenAt)}</TableCell>
                  <TableCell className="whitespace-nowrap text-text-muted">{timeAgo(w.startedAt)}</TableCell>
                  <TableCell className="tabular-nums">{w.jobsProcessed}</TableCell>
                  <TableCell className="text-xs">
                    {Object.entries(w.capabilities).map(([k, v]) => (
                      <div key={k}>
                        {k}: {v.startsWith("error:") ? "error" : v}
                      </div>
                    ))}
                    {problem && <div className="mt-1 text-danger-foreground">{problem}</div>}
                  </TableCell>
                </TableRow>
              );
            })}
            {workers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-text-muted">
                  No worker has reported in the last 24 hours. On a VPS run the <code>worker</code> and <code>video-worker</code> services.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

async function SystemTab() {
  const ffmpeg = await getFfmpegStatus(true);
  return (
    <div className="space-y-6">
    <WorkersCard />
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
    </div>
  );
}
