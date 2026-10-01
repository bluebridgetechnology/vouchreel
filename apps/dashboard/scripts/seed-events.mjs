/**
 * Seeds realistic analytics events for local development.
 * Usage: node scripts/seed-events.mjs
 * Requires DATABASE_URL (loaded from apps/dashboard/.env if present).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const envFile = readFileSync(join(__dirname, "..", ".env"), "utf-8");
    const match = envFile.match(/^DATABASE_URL=(.*)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    // ignore
  }
  return null;
}

const connectionString = loadEnv();
if (!connectionString) {
  console.error("DATABASE_URL is not set. Add it to apps/dashboard/.env or export it.");
  process.exit(1);
}

const DAYS = 35;
const SEED_SPACE_NAME = "Seed Analytics Space";

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[rand(0, arr.length - 1)];
}

async function main() {
  const pool = new pg.Pool({ connectionString });

  try {
    // Reuse existing seed space or create one with a fresh user
    let { rows: spaceRows } = await pool.query(
      "SELECT id FROM spaces WHERE name = $1 LIMIT 1",
      [SEED_SPACE_NAME]
    );

    let spaceId;
    if (spaceRows.length > 0) {
      spaceId = spaceRows[0].id;
      await pool.query("DELETE FROM events WHERE space_id = $1", [spaceId]);
      console.log(`Reusing seed space ${spaceId}, cleared old events.`);
    } else {
      const { rows: userRows } = await pool.query(
        `INSERT INTO "user" (id, name, email, email_verified)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        ["seed-analytics-user", "Seed User", "seed-analytics@example.com"]
      );
      const userId = userRows[0].id;

      const { rows } = await pool.query(
        `INSERT INTO spaces (name, owner_id, embed_key)
         VALUES ($1, $2, $3) RETURNING id`,
        [SEED_SPACE_NAME, userId, "seed-analytics-space"]
      );
      spaceId = rows[0].id;
      console.log(`Created seed space ${spaceId}.`);
    }

    // Ensure a widget config exists
    await pool.query(
      `INSERT INTO widget_configs (space_id) VALUES ($1)
       ON CONFLICT (space_id) DO NOTHING`,
      [spaceId]
    );

    // Testimonials
    const testimonials = [
      ["Sarah Chen", "Acme Corp", "youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "Loved the onboarding"],
      ["Marcus Webb", "Globex", "vimeo", "https://vimeo.com/76979871", "Doubled our conversion rate"],
      ["Priya Nair", "Initech", "mp4", "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", "Best support team ever"],
    ];

    const testimonialIds = [];
    const { rows: existing } = await pool.query(
      "SELECT id FROM testimonials WHERE space_id = $1",
      [spaceId]
    );
    if (existing.length >= testimonials.length) {
      for (const row of existing) testimonialIds.push(row.id);
    } else {
      for (let i = 0; i < testimonials.length; i++) {
        const [name, company, platform, url, title] = testimonials[i];
        const { rows } = await pool.query(
          `INSERT INTO testimonials
             (space_id, video_url, platform, title, customer_name, customer_company, sort_order, tags)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [spaceId, url, platform, title, name, company, i, ["seed"]]
        );
        testimonialIds.push(rows[0].id);
      }
    }

    // Conversion goals: one url-match, one pixel
    const { rows: goalRows } = await pool.query(
      `INSERT INTO conversion_goals (space_id, goal_type, goal_value)
       SELECT $1, 'url-match', '/thank-you'
       WHERE NOT EXISTS (
         SELECT 1 FROM conversion_goals WHERE space_id = $1 AND goal_value = '/thank-you'
       )
       RETURNING id`,
      [spaceId]
    );
    const urlGoalId =
      goalRows[0]?.id ||
      (
        await pool.query(
          "SELECT id FROM conversion_goals WHERE space_id = $1 AND goal_type = 'url-match' LIMIT 1",
          [spaceId]
        )
      ).rows[0].id;

    // Generate 35 days of events with weekly seasonality
    const values = [];
    const now = new Date();
    for (let day = DAYS; day >= 0; day--) {
      const date = new Date(now);
      date.setDate(date.getDate() - day);
      const weekendDip = [0, 6].includes(date.getDay()) ? 0.55 : 1;
      const growth = 1 + (DAYS - day) / (DAYS * 2); // gradual upward trend

      for (const tid of testimonialIds) {
        const impressions = Math.round(rand(8, 25) * weekendDip * growth);
        for (let i = 0; i < impressions; i++) {
          const ts = new Date(date);
          ts.setHours(rand(8, 22), rand(0, 59), rand(0, 59));
          const pageUrl = pick(["/", "/pricing", "/features", "/about"]);
          values.push([spaceId, tid, ts, "impression", pageUrl]);

          if (Math.random() < 0.38) {
            values.push([spaceId, tid, new Date(ts.getTime() + rand(2, 20) * 1000), "play", pageUrl]);
          }
          if (Math.random() < 0.12) {
            values.push([spaceId, tid, new Date(ts.getTime() + rand(30, 120) * 1000), "click", pageUrl]);
          }
        }
      }

      // A few conversions on the url-match goal
      if (Math.random() < 0.8) {
        const ts = new Date(date);
        ts.setHours(rand(9, 21), rand(0, 59));
        values.push([spaceId, null, ts, "convert", "/thank-you"]);
      }
      if (Math.random() < 0.3) {
        const ts = new Date(date);
        ts.setHours(rand(9, 21), rand(0, 59));
        values.push([spaceId, null, ts, "convert", "/order-confirmation"]);
      }
    }

    // Batch insert
    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < values.length; i += BATCH) {
      const batch = values.slice(i, i + BATCH);
      const params = [];
      const rowsSql = batch
        .map((row) => {
          const placeholders = row.map((_, j) => `$${params.length + j + 1}`);
          params.push(...row);
          return `($${params.length - 3}, $${params.length - 2}, $${params.length - 1}, $${params.length}, $${params.length + 1})`;
        })
        .join(", ");
      // Placeholders above are positional per row: space, tid, ts, type, page
      params.length = 0;
      let idx = 1;
      const groups = batch.map((row) => {
        const ph = row.map(() => `$${idx++}`);
        params.push(...row);
        return `(${ph.join(", ")})`;
      });
      await pool.query(
        `INSERT INTO events (space_id, testimonial_id, timestamp, event_type, page_url)
         VALUES ${groups.join(", ")}`,
        params
      );
      inserted += batch.length;
    }

    console.log(
      `Seeded ${inserted} events across ${testimonialIds.length} testimonials over ${DAYS} days.`
    );
    console.log(`URL-match conversion goal: ${urlGoalId} (matches /thank-you)`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
