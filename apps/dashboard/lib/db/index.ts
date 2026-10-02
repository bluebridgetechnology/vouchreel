import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Singleton pattern to reuse the connection pool across hot reloads in dev
const globalForDb = globalThis as unknown as {
  pool: pg.Pool | undefined;
};

function getPool() {
  if (!globalForDb.pool) {
    // `next build` imports route modules to collect their config but never queries; a Pool
    // does not connect until first use, so a placeholder lets the build run without a database.
    const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
    const connectionString =
      process.env.DATABASE_URL ?? (isBuildPhase ? "postgresql://build:build@localhost:5432/build" : undefined);
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL environment variable is required. " +
        "Copy .env.example to .env and update the values."
      );
    }
    globalForDb.pool = new Pool({
      connectionString,
      max: 10,
    });
  }
  return globalForDb.pool;
}

/** Drizzle ORM client with full schema for type-safe queries */
export const db = drizzle(getPool(), { schema });

export type Database = typeof db;
