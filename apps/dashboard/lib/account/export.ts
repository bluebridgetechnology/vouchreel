import { zipSync, strToU8 } from "fflate";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { dataExports, user } from "@/lib/db/schema";
import { enqueueJob } from "@/lib/jobs/queue";
import { sendEmail } from "@/lib/email/transport";
import { renderEmail } from "@/lib/email/templates";
import { JOB_TYPES } from "@/lib/jobs/handlers";

/**
 * "Download my data": everything the account owns as JSON files in a zip, built by a background job and
 * served only to its owner for a week. Tables are found by what they point at (the account, or one of
 * its spaces or forms) rather than listed by hand, so a table added later is included automatically.
 */

export const EXPORT_DAYS = 7;
export const MAX_EXPORT_BYTES = 50 * 1024 * 1024;
const ROW_LIMIT = 100_000;

/** Tables that are not the person's data: sign-in internals, platform configuration, queues, bulky visitor analytics. */
const SKIPPED = new Set([
  "user", "session", "account", "verification", "two_factor",
  "plans", "admin_settings", "admin_alert_state", "admin_audit_log", "admin_credit_adjustments",
  "jobs", "worker_heartbeats", "webhook_events", "data_exports",
  "events", "experiment_assignments", "webhook_deliveries",
]);

/** Columns that hold a credential or a derived secret: never exported. */
const SECRET_COLUMN = /secret|token|hash|password|credential|encrypted|apikey|api_key|signing/i;

export function stripSecrets(row: Record<string, unknown>, columnNames: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (SECRET_COLUMN.test(key) || SECRET_COLUMN.test(columnNames[key] ?? "")) continue;
    out[key] = value;
  }
  return out;
}

type AnyTable = PgTable & Record<string, unknown>;

function tables(): { name: string; table: AnyTable; columns: Record<string, { name: string }> }[] {
  return (Object.values(schema) as unknown[])
    .filter((v): v is AnyTable => is(v as object, PgTable))
    .map((table) => ({ name: getTableName(table), table, columns: getTableColumns(table) as Record<string, { name: string }> }));
}

const README = (email: string, counts: Record<string, number>) => `Your Vouchreel data
Account: ${email}
Created: ${new Date().toISOString()}

Each file is one kind of record, as JSON. Links in the records (videos, images) point to the files we store for you.
Not included: sign-in credentials and secrets (passwords, API key hashes, webhook signing secrets, stored provider
credentials), platform configuration, and visitor-level analytics events, which describe people who are not you.

Records per file:
${Object.entries(counts).map(([name, n]) => `  ${name}.json: ${n}`).join("\n")}
`;

/** Builds the zip for one account. */
export async function buildExportZip(userId: string): Promise<{ zip: Uint8Array; counts: Record<string, number> }> {
  const [owner] = await db.select().from(user).where(eq(user.id, userId));
  if (!owner) throw new Error("Account not found");

  const owned = await db.select({ id: schema.spaces.id }).from(schema.spaces).where(eq(schema.spaces.ownerId, userId));
  const spaceIds = owned.map((s) => s.id);
  const forms = spaceIds.length
    ? await db.select({ id: schema.collectionForms.id }).from(schema.collectionForms).where(inArray(schema.collectionForms.spaceId, spaceIds))
    : [];
  const formIds = forms.map((f) => f.id);

  const files: Record<string, Uint8Array> = {};
  const counts: Record<string, number> = {};
  const add = (name: string, data: unknown[]) => {
    if (data.length === 0) return;
    counts[name] = data.length;
    files[`${name}.json`] = strToU8(JSON.stringify(data, null, 2));
  };

  files["profile.json"] = strToU8(
    JSON.stringify({ id: owner.id, name: owner.name, email: owner.email, emailVerified: owner.emailVerified, createdAt: owner.createdAt, twoFactorEnabled: owner.twoFactorEnabled }, null, 2)
  );

  for (const { name, table, columns } of tables()) {
    if (SKIPPED.has(name)) continue;
    const names = Object.fromEntries(Object.entries(columns).map(([key, col]) => [key, col.name]));
    const col = (key: string) => columns[key] as unknown as Parameters<typeof eq>[0] | undefined;
    const clauses = [];
    if (col("spaceId") && spaceIds.length) clauses.push(inArray(col("spaceId")!, spaceIds));
    if (col("formId") && formIds.length) clauses.push(inArray(col("formId")!, formIds));
    for (const key of ["userId", "ownerId", "teamOwnerId", "createdBy"]) if (col(key)) clauses.push(eq(col(key)!, userId));
    if (clauses.length === 0) continue;
    const rows: Record<string, unknown>[] = [];
    for (const clause of clauses) {
      const found = (await db.select().from(table as PgTable).where(clause).limit(ROW_LIMIT)) as Record<string, unknown>[];
      for (const row of found) rows.push(stripSecrets(row, names));
    }
    // A row can match more than one clause (a space's owner and creator): keep each once
    const seen = new Set<string>();
    add(
      name,
      rows.filter((r) => {
        const key = JSON.stringify(r.id ?? r);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
    );
  }

  files["README.txt"] = strToU8(README(owner.email, counts));
  return { zip: zipSync(files, { level: 6 }), counts };
}

/** Requests an export; returns null when one was already requested in the last day. */
export async function requestExport(userId: string): Promise<{ id: string } | { tooSoon: true }> {
  await purgeExpiredExports();
  const day = new Date(Date.now() - 24 * 60 * 60_000);
  const [recent] = await db
    .select({ id: dataExports.id })
    .from(dataExports)
    .where(and(eq(dataExports.userId, userId), sql`${dataExports.createdAt} > ${day}`))
    .limit(1);
  if (recent) return { tooSoon: true };
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(dataExports).values({ userId }).returning({ id: dataExports.id });
    await enqueueJob(JOB_TYPES.dataExport, { exportId: row.id }, { maxAttempts: 2 }, tx);
    return { id: row.id };
  });
}

/** The job: builds the zip, stores it, and emails the person. */
export async function runExport(exportId: string): Promise<void> {
  const [row] = await db.select().from(dataExports).where(eq(dataExports.id, exportId));
  if (!row || row.status === "ready") return;
  const { zip } = await buildExportZip(row.userId);
  if (zip.byteLength > MAX_EXPORT_BYTES) {
    await db.update(dataExports).set({ status: "failed", error: "The export is larger than the size limit. Contact support." }).where(eq(dataExports.id, exportId));
    return;
  }
  const now = new Date();
  await db
    .update(dataExports)
    .set({ status: "ready", zip: Buffer.from(zip), sizeBytes: zip.byteLength, readyAt: now, expiresAt: new Date(now.getTime() + EXPORT_DAYS * 24 * 60 * 60_000), error: null })
    .where(eq(dataExports.id, exportId));

  const [owner] = await db.select({ email: user.email }).from(user).where(eq(user.id, row.userId));
  if (owner) {
    const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const { html, text } = renderEmail({
      title: "Your Vouchreel data is ready",
      body: `Sign in and open Settings to download it. The download is available for ${EXPORT_DAYS} days.`,
      cta: { label: "Open settings", url: `${base}/settings` },
      footer: "For your security, the file is only available while you are signed in.",
    });
    await sendEmail({ to: owner.email, subject: "Your Vouchreel data is ready", text, html });
  }
}

/** Settles an export whose job gave up. */
export async function failExport(exportId: string, error: unknown): Promise<void> {
  await db
    .update(dataExports)
    .set({ status: "failed", error: error instanceof Error ? error.message.slice(0, 500) : "The export failed." })
    .where(eq(dataExports.id, exportId));
}

/** Deletes finished exports past their week (done whenever someone asks for or opens one). */
export async function purgeExpiredExports(): Promise<void> {
  await db.delete(dataExports).where(and(eq(dataExports.status, "ready"), lt(dataExports.expiresAt, new Date())));
}

/** The person's latest export without its bytes. */
export async function latestExport(userId: string) {
  await purgeExpiredExports();
  const [row] = await db
    .select({ id: dataExports.id, status: dataExports.status, sizeBytes: dataExports.sizeBytes, error: dataExports.error, createdAt: dataExports.createdAt, expiresAt: dataExports.expiresAt })
    .from(dataExports)
    .where(eq(dataExports.userId, userId))
    .orderBy(sql`${dataExports.createdAt} desc`)
    .limit(1);
  return row ?? null;
}

/** The zip, only for its owner and only while it has not expired. */
export async function exportZipFor(userId: string, exportId: string): Promise<Buffer | null> {
  await purgeExpiredExports();
  const [row] = await db
    .select({ zip: dataExports.zip, status: dataExports.status })
    .from(dataExports)
    .where(and(eq(dataExports.id, exportId), eq(dataExports.userId, userId)));
  return row?.status === "ready" ? (row.zip ?? null) : null;
}
