import { and, count, eq, lt, min, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { getWorkerHealth } from "@/lib/admin/workers";
import { STALE_LOCK_MS } from "@/lib/jobs/queue";

/**
 * Operational numbers in the Prometheus text format, for /api/metrics. Only counts and ages of the
 * job queue and the workers: nothing about customers or their content.
 */

export interface Metric {
  name: string;
  help: string;
  type: "gauge" | "counter";
  samples: { labels?: Record<string, string>; value: number }[];
}

const escapeLabel = (v: string) => v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

/** Pure: renders metrics as Prometheus text. */
export function renderPrometheus(metrics: Metric[]): string {
  const out: string[] = [];
  for (const m of metrics) {
    out.push(`# HELP ${m.name} ${m.help}`, `# TYPE ${m.name} ${m.type}`);
    for (const s of m.samples) {
      const labels = s.labels && Object.keys(s.labels).length ? `{${Object.entries(s.labels).map(([k, v]) => `${k}="${escapeLabel(v)}"`).join(",")}}` : "";
      out.push(`${m.name}${labels} ${Number.isFinite(s.value) ? s.value : 0}`);
    }
  }
  return `${out.join("\n")}\n`;
}

const SEVERITY = { ok: 0, warning: 1, critical: 2 } as const;

export async function collectMetrics(now = new Date()): Promise<Metric[]> {
  const [byTypeStatus, oldest, stale, health] = await Promise.all([
    db.select({ type: jobs.type, status: jobs.status, value: count() }).from(jobs).groupBy(jobs.type, jobs.status),
    db.select({ at: min(jobs.createdAt) }).from(jobs).where(and(eq(jobs.status, "queued"), sql`${jobs.runAt} <= ${now.toISOString()}::timestamptz`)),
    db.select({ value: count() }).from(jobs).where(and(eq(jobs.status, "running"), lt(jobs.lockedAt, new Date(now.getTime() - STALE_LOCK_MS)))),
    getWorkerHealth(now),
  ]);
  const oldestAt = oldest[0]?.at ?? null;

  return [
    { name: "vouchreel_up", help: "1 when the app can reach its database", type: "gauge", samples: [{ value: 1 }] },
    {
      name: "vouchreel_jobs",
      help: "Jobs by type and status",
      type: "gauge",
      samples: byTypeStatus.map((r) => ({ labels: { type: r.type, status: r.status }, value: r.value })),
    },
    {
      name: "vouchreel_jobs_oldest_queued_age_seconds",
      help: "Age of the oldest job that is ready to run and not yet claimed (0 when none)",
      type: "gauge",
      samples: [{ value: oldestAt ? Math.max(0, Math.round((now.getTime() - oldestAt.getTime()) / 1000)) : 0 }],
    },
    { name: "vouchreel_jobs_stale_running", help: "Running jobs whose lock is older than the stale limit", type: "gauge", samples: [{ value: stale[0]?.value ?? 0 }] },
    {
      name: "vouchreel_workers_online",
      help: "Worker processes with a recent heartbeat, by kind",
      type: "gauge",
      samples: health.kinds.map((k) => ({ labels: { kind: k.kind }, value: k.online })),
    },
    {
      name: "vouchreel_worker_queue",
      help: "Jobs waiting for each kind of worker",
      type: "gauge",
      samples: health.kinds.map((k) => ({ labels: { kind: k.kind }, value: k.queued })),
    },
    {
      name: "vouchreel_worker_severity",
      help: "0 ok, 1 warning, 2 critical, as shown in the Admin System tab",
      type: "gauge",
      samples: health.kinds.map((k) => ({ labels: { kind: k.kind }, value: SEVERITY[k.severity] })),
    },
  ];
}
