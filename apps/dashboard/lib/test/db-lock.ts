import pg from "pg";

/**
 * The DB-backed integration tests share tables (jobs, generated_videos) and wipe them, so test
 * files must not overlap. Each file holds this session-level advisory lock for its duration.
 */
const LOCK_KEY = 727_001;

export async function acquireTestDbLock(connectionString: string): Promise<() => Promise<void>> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  await client.query("select pg_advisory_lock($1)", [LOCK_KEY]);
  return async () => {
    await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
    await client.end().catch(() => {});
  };
}
