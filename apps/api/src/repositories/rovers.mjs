import { pool } from "../db/pool.mjs";

export async function findRover(roverId) {
  const { rows } = await pool.query("SELECT * FROM rover_bindings WHERE rover_id = $1", [roverId]);
  return rows[0] ?? null;
}

export async function listRoversForUser(userId) {
  const { rows } = await pool.query(
    "SELECT * FROM rover_bindings WHERE user_id = $1 ORDER BY created_at ASC",
    [userId],
  );
  return rows;
}

export async function upsertRover({ roverId, userId, macCipher }) {
  const { rows } = await pool.query(
    `INSERT INTO rover_bindings(rover_id, user_id, mac_cipher, connection_count, created_at, updated_at)
     VALUES($1, $2, $3, 0, now(), now())
     ON CONFLICT (rover_id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       mac_cipher = EXCLUDED.mac_cipher,
       updated_at = now()
     RETURNING *`,
    [roverId, userId, macCipher],
  );
  return rows[0];
}

export async function deleteRover(roverId) {
  await pool.query("DELETE FROM rover_bindings WHERE rover_id = $1", [roverId]);
}

export async function resetConnection(roverId) {
  await pool.query(
    "UPDATE rover_bindings SET connection_count = 0, updated_at = now() WHERE rover_id = $1",
    [roverId],
  );
}

export async function markConnected(roverId) {
  const { rows } = await pool.query(
    `UPDATE rover_bindings
        SET connection_count = 1, updated_at = now()
      WHERE rover_id = $1
      RETURNING *`,
    [roverId],
  );
  return rows[0];
}

export async function markDisconnected(roverId) {
  const { rows } = await pool.query(
    `UPDATE rover_bindings
        SET connection_count = GREATEST(0, connection_count - 1), updated_at = now()
      WHERE rover_id = $1
      RETURNING *`,
    [roverId],
  );
  return rows[0];
}
