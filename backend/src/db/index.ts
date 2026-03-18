import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";
import { env } from "../lib/config.js";

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err);
  process.exit(1);
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
