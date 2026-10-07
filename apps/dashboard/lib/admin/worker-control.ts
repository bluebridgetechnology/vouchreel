import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workerHeartbeats } from "@/lib/db/schema";
import { workerStatus } from "@/lib/admin/workers";

export type RestartResult =
  | { ok: true; workerId: string; kind: string; hostname: string | null }
  | { ok: false; reason: "not_found" | "not_running"; message: string };

/**
 * Asks one worker process to finish the jobs it is running and exit. The platform cannot start a
 * process, so this only brings it back where something supervises it (Docker `restart: always`,
 * systemd, a process manager). Without a supervisor the worker simply stops.
 */
export async function requestWorkerRestart(workerId: string, now = new Date()): Promise<RestartResult> {
  const [row] = await db.select().from(workerHeartbeats).where(eq(workerHeartbeats.workerId, workerId));
  if (!row) return { ok: false, reason: "not_found", message: "No such worker." };
  if (workerStatus(row, now.getTime()) !== "online") {
    return { ok: false, reason: "not_running", message: "This worker is not running, so there is nothing to restart. Start it from where it is hosted." };
  }
  await db.update(workerHeartbeats).set({ restartRequestedAt: now }).where(eq(workerHeartbeats.workerId, workerId));
  return { ok: true, workerId, kind: row.kind, hostname: row.hostname };
}
