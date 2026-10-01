/**
 * Grants or revokes platform-admin access (the operator role that can open /admin).
 * Usage:
 *   node scripts/grant-admin.mjs you@company.com          # grant
 *   node scripts/grant-admin.mjs you@company.com --revoke # revoke
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
  throw new Error("DATABASE_URL is not set");
}

const email = process.argv[2];
const revoke = process.argv.includes("--revoke");
if (!email || email.startsWith("--")) {
  console.error("Usage: node scripts/grant-admin.mjs <email> [--revoke]");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: loadEnv() });
try {
  const { rowCount } = await pool.query('UPDATE "user" SET is_platform_admin = $1 WHERE lower(email) = lower($2)', [!revoke, email]);
  if (!rowCount) {
    console.error(`No user found with email ${email}`);
    process.exitCode = 1;
  } else {
    console.log(`${revoke ? "Revoked" : "Granted"} platform admin for ${email}`);
  }
} finally {
  await pool.end();
}
