import { markDatabaseReady, pool } from "./pool.mjs";

const MIGRATIONS = [
  `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    active_rover_id TEXT,
    password_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS active_rover_id TEXT`,
  `
  CREATE TABLE IF NOT EXISTS rover_bindings (
    rover_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mac_cipher TEXT NOT NULL,
    connection_count INTEGER NOT NULL DEFAULT 0 CHECK (connection_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `CREATE INDEX IF NOT EXISTS rover_bindings_user_idx ON rover_bindings (user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_name_lower_idx ON users (lower(name))`,
];

/** Apply the schema in order. Safe to run on every boot. */
export async function migrate() {
  for (const statement of MIGRATIONS) {
    await pool.query(statement);
  }
  markDatabaseReady(true);
}
