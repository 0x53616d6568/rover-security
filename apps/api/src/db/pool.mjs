import pg from "pg";

import { config } from "../config.mjs";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 5,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 30_000,
});

let databaseReady = false;

pool.on("error", (error) => {
  databaseReady = false;
  console.error("[rover-api] idle database client error:", error.message);
});

export function isDatabaseReady() {
  return databaseReady;
}

export function markDatabaseReady(ready) {
  databaseReady = ready;
}

export async function pingDatabase() {
  await pool.query("SELECT 1");
  databaseReady = true;
  return true;
}

export async function closeDatabase() {
  await pool.end().catch(() => undefined);
}
