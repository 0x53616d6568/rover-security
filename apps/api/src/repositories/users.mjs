import { pool } from "../db/pool.mjs";

export async function findUserById(id) {
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function findUserByName(name) {
  const { rows } = await pool.query(
    "SELECT * FROM users WHERE lower(name) = lower($1) LIMIT 1",
    [name],
  );
  return rows[0] ?? null;
}

export async function listUsers() {
  const { rows } = await pool.query("SELECT * FROM users ORDER BY created_at ASC");
  return rows;
}

export async function createUser({ id, name, passwordHash }) {
  const { rows } = await pool.query(
    "INSERT INTO users(id, name, password_hash, created_at) VALUES($1, $2, $3, now()) RETURNING *",
    [id, name, passwordHash],
  );
  return rows[0];
}

export async function setActiveRover(userId, roverId) {
  await pool.query("UPDATE users SET active_rover_id = $1 WHERE id = $2", [roverId, userId]);
}
