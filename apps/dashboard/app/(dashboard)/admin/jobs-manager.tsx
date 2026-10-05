"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notify } from "@/lib/notify";
import { timeAgo } from "@/lib/time-ago";
import type { AdminJobRow, AdminVideoRow, JobOverview, JobStatus } from "@/lib/admin/jobs";

const STATUS_VARIANT: Record<string, "neutral" | "info" | "success" | "danger" | "warning"> = {
  queued: "neutral",
  running: "info",
  done: "success",
  rendering: "info",
  failed: "danger",
  draft: "neutral",
};

const TYPE_LABEL: Record<string, string> = {
  review_video: "Review video",
  ai_video: "AI video",
  social_export: "Social export",
};

export function JobsManager({ overview, videos }: { overview: JobOverview; videos: AdminVideoRow[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(job: AdminJobRow, action: "retry" | "cancel") {
    const retry = action === "retry";
    const ok = await confirm({
      title: retry ? "Retry this job?" : "Cancel this job?",
      description: retry
        ? "The job goes back in the queue and its video holds a credit again, even if that takes the owner past their allowance."
        : "The job is stopped and its video is marked failed. The owner is told and the credit is refunded.",
      confirmLabel: retry ? "Retry job" : "Cancel job",
      tone: retry ? "default" : "danger",
    });
    if (!ok) return;

    setBusy(job.id);
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not update the job");
      notify.success(retry ? "Job queued again." : "Job cancelled.");
      router.refresh();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Could not update the job");
    } finally {
      setBusy(null);
    }
  }

  const statuses: JobStatus[] = ["queued", "running", "failed", "done"];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statuses.map((s) => (
          <Card key={s}>
            <CardContent className="p-4">
              <div className="text-xs capitalize text-text-muted">{s}</div>
              <div className="mt-1 text-2xl font-medium tabular-nums">{overview.byStatus[s]}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="-mt-4 text-xs text-text-muted">
        {overview.oldestQueuedAt ? `Oldest queued job was created ${timeAgo(overview.oldestQueuedAt)}. ` : "Nothing is waiting in the queue. "}
        {overview.staleRunning > 0
          ? `${overview.staleRunning} running job${overview.staleRunning === 1 ? "" : "s"} look stuck (worker lost). Cancel them or let the worker reclaim them.`
          : "No stuck jobs."}
        {" "}Review videos only run when the video worker is up; with no worker they wait here.
      </p>

      <JobTable
        title="Failed jobs"
        description="Out of retries. Retry puts the job back in the queue with a fresh attempt count."
        empty="No failed jobs."
        jobs={overview.failed}
        busy={busy}
        onAction={act}
      />
      <JobTable
        title="Queued and running"
        description="Oldest first, stuck jobs on top."
        empty="Nothing queued or running."
        jobs={overview.active}
        busy={busy}
        onAction={act}
      />

      <Card>
        <CardHeader>
          <CardTitle>Recent videos</CardTitle>
          <CardDescription>Review videos and AI videos across all accounts, newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Video</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Render</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {videos.map((v) => (
                <TableRow key={`${v.kind}-${v.id}`}>
                  <TableCell>
                    <div className="font-medium">{v.kind === "review" ? "Review video" : "AI video"} · {v.template}</div>
                    <div className="text-xs text-text-muted">{v.spaceName}</div>
                  </TableCell>
                  <TableCell className="text-text-muted">{v.ownerEmail ?? "Deleted user"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[v.status] ?? "neutral"}>{v.status}</Badge>
                    {v.error && <div className="mt-1 max-w-xs truncate text-xs text-danger-foreground" title={v.error}>{v.error}</div>}
                  </TableCell>
                  <TableCell className="tabular-nums text-text-muted">{v.renderMs ? `${(v.renderMs / 1000).toFixed(1)}s` : "-"}</TableCell>
                  <TableCell className="whitespace-nowrap text-text-muted">{timeAgo(v.createdAt)}</TableCell>
                </TableRow>
              ))}
              {videos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-text-muted">
                    No videos yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function JobTable({
  title,
  description,
  empty,
  jobs,
  busy,
  onAction,
}: {
  title: string;
  description: string;
  empty: string;
  jobs: AdminJobRow[];
  busy: string | null;
  onAction: (job: AdminJobRow, action: "retry" | "cancel") => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Error</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((j) => {
              const canRetry = j.status === "failed";
              const canCancel = j.status === "queued" || j.stale;
              return (
                <TableRow key={j.id}>
                  <TableCell>
                    <div className="font-medium">{TYPE_LABEL[j.type] ?? j.type}</div>
                    <div className="text-xs text-text-muted">created {timeAgo(j.createdAt)}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[j.status]}>{j.status}</Badge>
                    {j.stale && <Badge variant="warning" className="ml-1">stuck</Badge>}
                  </TableCell>
                  <TableCell className="tabular-nums text-text-muted">
                    {j.attempts}/{j.maxAttempts}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-text-muted" title={j.lastError ?? undefined}>
                    {j.lastError ?? "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {canRetry && (
                      <Button size="sm" variant="outline" loading={busy === j.id} onClick={() => onAction(j, "retry")}>
                        Retry
                      </Button>
                    )}
                    {canCancel && (
                      <Button size="sm" variant="outline" loading={busy === j.id} onClick={() => onAction(j, "cancel")}>
                        Cancel
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {jobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-text-muted">
                  {empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
