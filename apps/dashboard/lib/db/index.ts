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
    const connectionString = process.env.DATABASE_URL;
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
