import { mkdirSync } from "node:fs";
import pg from "pg";
import { chromium, type FullConfig } from "@playwright/test";
import { ADMIN_STATE, AUDIT_SEED_COUNT, FAILED_JOB_ERROR, FAILED_JOB_TYPE, PASSWORD, PLAN_NAME, QUEUED_JOB_TYPE, USERS } from "./seed";

/**
 * Runs after the web server is up. Recreates the rows the tests rely on (users, a plan, jobs,
 * audit entries) and saves the admin's signed-in browser state.
 */
export default async function globalSetup(config: FullConfig) {
  const dbUrl = process.env.E2E_DATABASE_URL;
  if (!dbUrl) throw new Error("Set E2E_DATABASE_URL to a throwaway Postgres (see playwright.config.ts).");
  const dbName = new URL(dbUrl).pathname.replace(/^\//, "");
  if (!/e2e|test/i.test(dbName)) throw new Error(`Refusing to seed "${dbName}": the database name must contain "e2e" or "test".`);

  const baseURL = config.projects[0].use.baseURL!;
  const pool = new pg.Pool({ connectionString: dbUrl });
  try {
    // Start from a clean slate for everything this suite owns
    await pool.query(`DELETE FROM "user" WHERE email LIKE 'e2e-%@example.test'`);
    await pool.query(`DELETE FROM plans WHERE name = $1`, [PLAN_NAME]);
    await pool.query(`DELETE FROM jobs WHERE type IN ($1, $2)`, [FAILED_JOB_TYPE, QUEUED_JOB_TYPE]);
    await pool.query(`DELETE FROM worker_heartbeats WHERE worker_id LIKE 'e2e-%'`);
    await pool.query(`DELETE FROM admin_audit_log WHERE summary ILIKE '%e2e%'`); // seeded rows and entries from earlier runs

    for (const u of Object.values(USERS)) {
      // Better Auth limits sign-ups to a few per 10 seconds; wait and retry instead of loosening the app
      for (let attempt = 1; ; attempt++) {
        const res = await fetch(`${baseURL}/api/auth/sign-up/email`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: baseURL },
          body: JSON.stringify({ email: u.email, password: PASSWORD, name: u.name }),
        });
        if (res.ok) break;
        if (res.status !== 429 || attempt >= 6) throw new Error(`Could not create ${u.email}: ${res.status} ${await res.text()}`);
        await new Promise((r) => setTimeout(r, 4000));
      }
    }

    await pool.query(`UPDATE "user" SET is_platform_admin = true WHERE email = $1`, [USERS.admin.email]);
    const { rows: [plan] } = await pool.query(`INSERT INTO plans (name, price, interval) VALUES ($1, 1900, 'month') RETURNING id`, [PLAN_NAME]);
    await pool.query(
      `INSERT INTO subscriptions (user_id, plan_id, status, provider, provider_subscription_id)
       SELECT id, $1, 'active', 'stripe', 'sub_e2e' FROM "user" WHERE email = $2`,
      [plan.id, USERS.billed.email]
    );
    await pool.query(
      `INSERT INTO jobs (type, payload, status, attempts, max_attempts, last_error, completed_at) VALUES ($1, '{}', 'failed', 3, 3, $2, now())`,
      [FAILED_JOB_TYPE, FAILED_JOB_ERROR]
    );
    await pool.query(`INSERT INTO jobs (type, payload, status) VALUES ($1, '{}', 'queued')`, [QUEUED_JOB_TYPE]);
    // A video worker that is alive (last seen an hour ahead so it stays "online" however long the run takes)
    // and a job worker that went quiet ten minutes ago
    await pool.query(
      `INSERT INTO worker_heartbeats (worker_id, kind, hostname, pid, concurrency, capabilities, started_at, last_seen_at) VALUES
         ('e2e-video-worker', 'video-worker', 'e2e-host', 4242, 1, '{"chromium":"ok"}', now() - interval '2 hours', now() + interval '1 hour'),
         ('e2e-job-worker', 'worker', 'e2e-host', 4343, 2, '{"ffmpeg":"7.1"}', now() - interval '2 hours', now() - interval '10 minutes')`
    );
    await pool.query(
      `INSERT INTO admin_audit_log (action, entity_type, summary, changes, created_at)
       SELECT 'plan.updated', 'plan', 'E2E seeded entry ' || g, '{"price":{"from":900,"to":1900}}', now() - (g || ' minutes')::interval
       FROM generate_series(1, $1::int) g`,
      [AUDIT_SEED_COUNT]
    );
  } finally {
    await pool.end();
  }

  // Sign the admin in once and reuse the cookies
  mkdirSync("e2e/.auth", { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const res = await context.request.post("/api/auth/sign-in/email", {
    headers: { origin: baseURL },
    data: { email: USERS.admin.email, password: PASSWORD },
  });
  if (!res.ok()) throw new Error(`Admin sign-in failed: ${res.status()}`);
  await context.storageState({ path: ADMIN_STATE });
  await browser.close();
}
