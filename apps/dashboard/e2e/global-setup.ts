import { createHmac } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import pg from "pg";
import { request, type FullConfig } from "@playwright/test";
import { startFakeS3 } from "./fake-s3";
import { ADMIN_STATE, AUDIT_SEED_COUNT, CONSENT_FILE, E2E_AUTH_SECRET, FAILED_JOB_ERROR, FAILED_JOB_TYPE, PASSWORD, PLAN_NAME, QUEUED_JOB_TYPE, STORAGE_BUCKET, STORAGE_ORIGIN, STORAGE_PORT, USERS } from "./seed";

/**
 * Runs after the web server is up. Recreates the rows the tests rely on (users, a plan, jobs,
 * audit entries) and saves the admin's signed-in browser state.
 */
export default async function globalSetup(config: FullConfig) {
  const fakeS3 = await startFakeS3(STORAGE_PORT, STORAGE_BUCKET);
  const dbUrl = process.env.E2E_DATABASE_URL;
  if (!dbUrl) throw new Error("Set E2E_DATABASE_URL to a throwaway Postgres (see playwright.config.ts).");
  const dbName = new URL(dbUrl).pathname.replace(/^\//, "");
  if (!/e2e|test/i.test(dbName)) throw new Error(`Refusing to seed "${dbName}": the database name must contain "e2e" or "test".`);

  const baseURL = config.projects[0].use.baseURL!;
  const pool = new pg.Pool({ connectionString: dbUrl });
  try {
    // Start from a clean slate for everything this suite owns
    // generated_videos keeps its consent (restrict), so remove the videos before the users that own them
    await pool.query(`DELETE FROM generated_videos WHERE space_id IN (SELECT id FROM spaces WHERE embed_key = 'e2e-moderation')`);
    await pool.query(`DELETE FROM "user" WHERE email LIKE 'e2e-%@example.test'`);
    await pool.query(`DELETE FROM plans WHERE name = $1 OR name LIKE $2`, [PLAN_NAME, "E2E Created Plan%"]);
    // The whole queue: the worker alerts depend on what is waiting, so leftovers from earlier runs would change them
    await pool.query(`DELETE FROM jobs`);
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

    // The server runs with email verification required; the seeded people have "confirmed" already
    await pool.query(`UPDATE "user" SET email_verified = true WHERE email = ANY($1)`, [Object.values(USERS).map((u) => u.email)]);
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

    // Videos to moderate, owned by the customer: a healthy AI video, one whose consent was withdrawn, and a review video
    const fileUrl = (key: string) => `${STORAGE_ORIGIN}/${STORAGE_BUCKET}/${key}`;
    const { rows: [owner] } = await pool.query(`SELECT id FROM "user" WHERE email = $1`, [USERS.customer.email]);
    const { rows: [space] } = await pool.query(`INSERT INTO spaces (name, owner_id, embed_key) VALUES ('E2E Moderation Space', $1, 'e2e-moderation') RETURNING id`, [owner.id]);
    // A public collection form, for the direct-upload test
    await pool.query(`INSERT INTO collection_forms (space_id, title, prompt_text, slug) VALUES ($1, 'E2E Collect', 'Tell us how it went', 'e2e-collect')`, [space.id]);
    // An inbox of 25 (the first ten unread) and a Slack-format webhook whose address cannot be reached
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, read_at, created_at)
       SELECT $1, 'submission.received', 'E2E notice ' || g, 'Seeded for the inbox test', CASE WHEN g > 10 THEN now() ELSE NULL END, now() - (g || ' minutes')::interval
       FROM generate_series(1, 25) g`,
      [owner.id]
    );
    await pool.query(
      `INSERT INTO webhook_endpoints (space_id, url, secret, events, format) VALUES ($1, 'https://hooks.slack.invalid/services/T000/B000/e2e', 'whsec_e2e', ARRAY['testimonial.created'], 'slack')`,
      [space.id]
    );
    const { rows: [t1] } = await pool.query(
      `INSERT INTO testimonials (space_id, platform, quote, customer_name, customer_company) VALUES ($1, 'text', 'Great product.', 'Ada Lovelace', 'Analytical Co') RETURNING id`,
      [space.id]
    );
    const { rows: [t2] } = await pool.query(
      `INSERT INTO testimonials (space_id, platform, quote, customer_name) VALUES ($1, 'text', 'Fine product.', 'Grace Hopper') RETURNING id`,
      [space.id]
    );
    const consent = async (t: string, revoked: boolean) =>
      (await pool.query(
        `INSERT INTO testimonial_consents (testimonial_id, space_id, source, text_version, granted_at, revoked_at)
         VALUES ($1, $2, 'collect_form', '2026-10-v1', now() - interval '3 days', ${revoked ? "now() - interval '1 day'" : "NULL"}) RETURNING id`,
        [t, space.id]
      )).rows[0].id as string;
    const c1 = await consent(t1.id, false);
    const c2 = await consent(t2.id, true);
    const ai = async (t: string, c: string, script: string, minutesAgo: number) => {
      const { rows: [row] } = await pool.query(
        `INSERT INTO generated_videos (space_id, testimonial_id, consent_id, status, template, voice, script_original, trim_approved_at, created_at)
         VALUES ($1, $2, $3, 'done', 'bold', 'v', $4, now(), now() - ($5 || ' minutes')::interval) RETURNING id`,
        [space.id, t, c, script, String(minutesAgo)]
      );
      await pool.query(`UPDATE generated_videos SET output_url = $1 WHERE id = $2`, [fileUrl(`ai-videos/${space.id}/${t}/${row.id}.mp4`), row.id]);
    };
    // Two customers who can still withdraw: one will use the link from their email, for the other the owner records it
    const { rows: [t3] } = await pool.query(`INSERT INTO testimonials (space_id, platform, quote, customer_name) VALUES ($1, 'text', 'Wonderful.', 'Katherine Johnson') RETURNING id`, [space.id]);
    const { rows: [t4] } = await pool.query(`INSERT INTO testimonials (space_id, platform, quote, customer_name) VALUES ($1, 'text', 'Splendid.', 'Dorothy Vaughan') RETURNING id`, [space.id]);
    const c3 = await consent(t3.id, false);
    const c4 = await consent(t4.id, false);
    await ai(t3.id, c3, "E2E public withdrawal script.", 40);
    await ai(t4.id, c4, "E2E owner withdrawal script.", 50);
    const token = `${c3}.${createHmac("sha256", E2E_AUTH_SECRET).update(`ai-video-consent:${c3}`).digest("hex")}`;
    mkdirSync("e2e/.auth", { recursive: true });
    writeFileSync(CONSENT_FILE, JSON.stringify({ token, forged: `${c3}.${"0".repeat(64)}`, spaceId: space.id }));
    await ai(t1.id, c1, "E2E healthy narration script.", 10);
    await ai(t2.id, c2, "E2E withdrawn narration script.", 20);
    const { rows: [rv] } = await pool.query(
      `INSERT INTO review_videos (space_id, template, status, props, rights_confirmed_at, created_at)
       VALUES ($1, 'spotlight', 'done', $2, now(), now() - interval '30 minutes') RETURNING id`,
      [space.id, JSON.stringify({ reviews: [{ author: "Maya Okafor", text: "E2E review video text." }] })]
    );
    await pool.query(`UPDATE review_videos SET output_url = $1 WHERE id = $2`, [fileUrl(`review-videos/${space.id}/${rv.id}.mp4`), rv.id]);
  } finally {
    await pool.end();
  }

  // Sign the admin in once and reuse the cookies
  mkdirSync("e2e/.auth", { recursive: true });
  // (An API call: no browser is started, so the job only needs the browser it is testing)
  const api = await request.newContext({ baseURL });
  const res = await api.post("/api/auth/sign-in/email", {
    headers: { origin: baseURL },
    data: { email: USERS.admin.email, password: PASSWORD },
  });
  if (!res.ok()) throw new Error(`Admin sign-in failed: ${res.status()}`);
  await api.storageState({ path: ADMIN_STATE });
  await api.dispose();
  // Keep the fake storage up for the tests; stop it when they finish
  return () => new Promise<void>((resolve) => fakeS3.close(() => resolve()));
}
