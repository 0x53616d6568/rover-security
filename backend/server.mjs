#!/usr/bin/env node
// Rover backend: Express over PostgreSQL.
// Stores product-access bindings in encrypted form; MACs are hashes/masks.
import crypto from "node:crypto";
import express from "express";
import { Pool } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/rover_users";
const ENCRYPTION_KEY_RAW = process.env.ROVER_BACKEND_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY_RAW) throw new Error("ROVER_BACKEND_ENCRYPTION_KEY must be set.");
const ENCRYPTION_KEY = crypto.createHash("sha256").update(ENCRYPTION_KEY_RAW).digest();
const LISTEN_PORT = Number(process.env.ROVER_BACKEND_PORT ?? 8080);
const LISTEN_HOST = process.env.ROVER_BACKEND_HOST ?? "127.0.0.1";

const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
pool.on("error", (error) => console.error("[rover-api] database pool error:", error));

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
  `
  CREATE TABLE IF NOT EXISTS rover_bindings (
    rover_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mac_cipher TEXT NOT NULL,
    connection_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
];

async function initDatabase() {
  for (const migration of MIGRATIONS) {
    await pool.query(migration);
  }
}

function nowIso() {
  return new Date().toISOString();
}

function send(res, status, body) {
  res.status(status).json(body);
}

function normalizeMac(raw) {
  const compact = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "");
  if (/^([0-9A-F]{2}){6}$/.test(compact)) {
    const spaced = compact.replace(/(.{2})(?!$)/g, "$1:");
    return spaced.slice(0, 17);
  }
  const dashed = compact.replace(/-/g, ":");
  return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(dashed) ? dashed : null;
}

function roverIdForMac(normalizedMac) {
  return crypto.createHash("sha256").update(normalizedMac).digest("hex").slice(0, 32);
}

function encryptMac(normalizedMac) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv, { authTagLength: 16 });
  const ciphertext = Buffer.concat([cipher.update(normalizedMac, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64url");
}

function decryptMac(macCipher) {
  const data = Buffer.from(String(macCipher), "base64url");
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv, { authTagLength: 16 });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.scryptSync(password, Buffer.from(salt, "base64url"), 32).toString("base64url");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const parts = String(storedHash ?? "").split(":");
  if (parts[0] !== "scrypt" || parts.length !== 3) return false;
  const expected = crypto.scryptSync(password, Buffer.from(parts[1], "base64url"), 32).toString("base64url");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]));
}

function signUserToken(userId) {
  const signature = crypto
    .createHmac("sha256", ENCRYPTION_KEY)
    .update(userId)
    .digest("base64url");
  return `${userId}.${signature}`;
}

function cookieValue(req, name) {
  const header = req.headers.cookie ?? "";
  const prefix = `${name}=`;
  const match = header.match(/(?:^|;\s*)rover-auth=([^;]*)/);
  return match?.[1] ?? (header.startsWith(prefix) ? header.slice(prefix.length) : null);
}

async function verifyAuthRequest(req) {
  const token = cookieValue(req, "rover-auth");
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [userId, signature] = parts;
  const expected = signUserToken(userId).split(".").slice(1).join(".");
  if (!userId || !signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  return getUser(userId);
}

function bindingRow(row) {
  if (!row) return null;
  return {
    roverId: row.rover_id,
    macMask: row.rover_id,
    userId: row.user_id,
    connectionCount: row.connection_count,
    activeConnection: row.connection_count === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function userRow(row) {
  return {
    id: row.id,
    name: row.name,
    activeRoverId: row.active_rover_id,
    createdAt: row.created_at,
  };
}

async function getUser(id) {
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0] ?? null;
}

async function getUserByName(name) {
  const { rows } = await pool.query("SELECT * FROM users WHERE lower(name) = lower($1)", [name]);
  return rows[0] ?? null;
}

async function getRover(roverId) {
  const { rows } = await pool.query("SELECT * FROM rover_bindings WHERE rover_id = $1", [roverId]);
  return rows[0] ?? null;
}

function requireAuth(req, res, next) {
  (async () => {
    try {
      const user = await verifyAuthRequest(req);
      if (!user) return send(res, 401, { ok: false, error: "Not authenticated." });
      next();
    } catch (error) {
      next(error);
    }
  })();
}

function apiErrorHandler(error, req, res, next) {
  console.error("[rover-api]", error);
  send(res, 500, { ok: false, error: "Internal server error." });
}

const app = express();
app.use(express.json({ limit: "1mb" }));
app.disable("x-powered-by");

app.use("/api/users", requireAuth);
app.use("/api/rover", requireAuth);

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    const password = String(req.body?.password ?? "");
    if (!name || !password) return send(res, 400, { ok: false, error: "Name and password are required." });
    const user = await getUserByName(name);
    if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
      return send(res, 401, { ok: false, error: "Invalid credentials." });
    }
    const token = signUserToken(user.id);
    res.cookie("rover-auth", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000,
    });
    send(res, 200, { ok: true, user: userRow(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", (req, res, next) => {
  try {
    res.clearCookie("rover-auth", { path: "/" });
    send(res, 200, { ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", async (req, res, next) => {
  try {
    const user = await verifyAuthRequest(req);
    if (!user) return send(res, 401, { ok: false, error: "Not authenticated." });
    send(res, 200, { ok: true, user: userRow(user) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/users", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users ORDER BY created_at DESC");
    send(res, 200, { ok: true, users: rows.map(userRow) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/users", async (req, res, next) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    if (!name) return send(res, 400, { ok: false, error: "Name is required." });
    const password = String(req.body?.password ?? "");
    const passwordHash = password ? hashPassword(password) : null;
    const id = `user_${crypto.randomBytes(6).toString("hex")}`;
    const { rows } = await pool.query(
      "INSERT INTO users(id,name,password_hash,created_at) VALUES($1,$2,$3,now()) RETURNING *",
      [id, name, passwordHash],
    );
    send(res, 201, { ok: true, user: userRow(rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/users/:id/rovers", async (req, res, next) => {
  try {
    const user = await getUser(req.params.id);
    if (!user) return send(res, 404, { ok: false, error: "User not found." });
    const { rows } = await pool.query(
      "SELECT * FROM rover_bindings WHERE user_id = $1 ORDER BY created_at ASC",
      [user.id],
    );
    send(res, 200, { ok: true, user: userRow(user), rovers: rows.map(bindingRow) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/users/:id/rovers", async (req, res, next) => {
  try {
    const user = await getUser(req.params.id);
    if (!user) return send(res, 404, { ok: false, error: "User not found." });
    const normalized = normalizeMac(req.body?.mac);
    if (!normalized) return send(res, 400, { ok: false, error: "Enter a valid MAC address." });
    const roverId = roverIdForMac(normalized);
    const { rows } = await pool.query(
      `INSERT INTO rover_bindings(rover_id,user_id,mac_cipher,connection_count,created_at,updated_at)
       VALUES($1,$2,$3,0,now(),now())
       ON CONFLICT(rover_id) DO UPDATE SET
         user_id=excluded.user_id,
         mac_cipher=excluded.mac_cipher,
         updated_at=now()
       RETURNING *`,
      [roverId, user.id, encryptMac(normalized)],
    );
    send(res, 201, { ok: true, rover: bindingRow(rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/users/:id/rovers/:rover_id", async (req, res, next) => {
  try {
    const user = await getUser(req.params.id);
    if (!user) return send(res, 404, { ok: false, error: "User not found." });
    const binding = await getRover(req.params.rover_id);
    if (!binding || binding.user_id !== user.id) {
      return send(res, 404, { ok: false, error: "Rover not found for this user." });
    }
    await pool.query("DELETE FROM rover_bindings WHERE rover_id = $1", [binding.rover_id]);
    send(res, 200, { ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/rover/:rover_id", async (req, res, next) => {
  try {
    const binding = await getRover(req.params.rover_id);
    if (!binding) return send(res, 404, { ok: false, error: "Rover not associated." });
    const user = await getUser(binding.user_id);
    if (!user) return send(res, 404, { ok: false, error: "Owner not found." });
    send(res, 200, { ok: true, rover: bindingRow(binding), owner: userRow(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/rover/connect", async (req, res, next) => {
  try {
    const { roverId, userId } = req.body ?? {};
    const binding = await getRover(roverId);
    if (!binding) return send(res, 404, { ok: false, error: "Rover not associated." });
    if (userId && binding.user_id !== userId) {
      return send(res, 403, { ok: false, error: "This rover belongs to another user." });
    }
    const user = await getUser(binding.user_id);
    if (!user) return send(res, 404, { ok: false, error: "Owner not found." });
    if (user.active_rover_id && user.active_rover_id !== binding.rover_id) {
      const previous = await getRover(user.active_rover_id);
      if (previous) {
        await pool.query("UPDATE rover_bindings SET connection_count=0 WHERE rover_id=$1", [previous.rover_id]);
      }
    }
    const { rows } = await pool.query(
      `UPDATE rover_bindings
         SET connection_count = LEAST(1, COALESCE(connection_count,0) + 1),
             updated_at = now()
        WHERE rover_id = $1
        RETURNING *`,
      [binding.rover_id],
    );
    await pool.query("UPDATE users SET active_rover_id = $1 WHERE id = $2", [binding.rover_id, user.id]);
    const updatedUser = await getUser(binding.user_id);
    send(res, 200, { ok: true, rover: bindingRow(rows[0]), owner: userRow(updatedUser) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/rover/disconnect", async (req, res, next) => {
  try {
    const binding = await getRover(req.body?.roverId);
    if (!binding) return send(res, 404, { ok: false, error: "Rover not associated." });
    const { rows } = await pool.query(
      `UPDATE rover_bindings
         SET connection_count = GREATEST(0, COALESCE(connection_count,0) - 1),
             updated_at = now()
        WHERE rover_id = $1
        RETURNING *`,
      [binding.rover_id],
    );
    const user = await getUser(binding.user_id);
    if (user && user.active_rover_id === binding.rover_id && rows[0]?.connection_count === 0) {
      await pool.query("UPDATE users SET active_rover_id = NULL WHERE id = $1", [user.id]);
    }
    send(res, 200, { ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/debug", async (req, res, next) => {
  try {
    const users = await pool.query("SELECT COUNT(*)::int AS c FROM users");
    const rovers = await pool.query("SELECT COUNT(*)::int AS c FROM rover_bindings");
    send(res, 200, {
      ok: true,
      users: users.rows[0]?.c ?? 0,
      rovers: rovers.rows[0]?.c ?? 0,
      databaseUrl: DATABASE_URL,
    });
  } catch (error) {
    next(error);
  }
});

app.use(apiErrorHandler);

await initDatabase().catch((error) => {
  console.error("[rover-api] PostgreSQL unavailable; starting backend with no database access:", error);
});
const server = app.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`[rover-api] Express listening on http://${LISTEN_HOST}:${LISTEN_PORT}`);
  console.log(`[rover-api] PostgreSQL: ${DATABASE_URL}`);
});

async function shutdown(signal) {
  console.log(`[rover-api] ${signal} — closing database.`);
  server.close(() => undefined);
  await pool.end().catch(() => undefined);
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("beforeExit", () => pool.end().catch(() => undefined));

export { normalizeMac, roverIdForMac, decryptMac, encryptMac };
