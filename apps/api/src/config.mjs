const isProduction = process.env.NODE_ENV === "production";

const DEV_ENCRYPTION_KEY = "rover-dev-only-encryption-key-do-not-ship";

function readInt(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) ? value : fallback;
}

function readBoolean(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

function readEncryptionKey() {
  const configured = process.env.ROVER_BACKEND_ENCRYPTION_KEY;
  if (configured && configured.length >= 16) return configured;

  if (isProduction) {
    throw new Error(
      "ROVER_BACKEND_ENCRYPTION_KEY must be set to at least 16 characters in production.",
    );
  }

  console.warn(
    "[rover-api] ROVER_BACKEND_ENCRYPTION_KEY is not set; using an ephemeral development key. " +
      "Sessions and encrypted MACs will not survive a key change.",
  );
  return DEV_ENCRYPTION_KEY;
}

function readCookieSecure() {
  return readBoolean("ROVER_COOKIE_SECURE", isProduction);
}

function readCookieSameSite(secure) {
  const value = (process.env.ROVER_COOKIE_SAMESITE ?? "lax").toLowerCase();
  if (!["lax", "strict", "none"].includes(value)) {
    throw new Error("ROVER_COOKIE_SAMESITE must be one of: lax, strict, none.");
  }
  if (value === "none" && !secure) {
    throw new Error("ROVER_COOKIE_SAMESITE=none requires ROVER_COOKIE_SECURE=1.");
  }
  return value;
}

function readCorsOrigins() {
  return (process.env.ROVER_CORS_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function readDatabaseSsl() {
  const explicit = process.env.ROVER_DATABASE_SSL;
  if (explicit !== undefined) return readBoolean("ROVER_DATABASE_SSL", false);
  // Neon connection strings normally include ?sslmode=require.
  return /[?&]sslmode=require\b/i.test(process.env.DATABASE_URL ?? "");
}

const cookieSecure = readCookieSecure();
const corsOrigins = readCorsOrigins();

export const config = Object.freeze({
  env: process.env.NODE_ENV ?? "development",
  isProduction,
  // Render/Fly/Heroku inject PORT; keep ROVER_BACKEND_PORT as an explicit override.
  host: process.env.ROVER_BACKEND_HOST ?? (isProduction ? "0.0.0.0" : "127.0.0.1"),
  port: readInt("ROVER_BACKEND_PORT", readInt("PORT", 8080)),
  databaseUrl:
    process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/rover_users",
  databaseSsl: readDatabaseSsl(),
  encryptionKey: readEncryptionKey(),
  cookieName: "rover-auth",
  cookieSecure,
  cookieSameSite: readCookieSameSite(cookieSecure),
  sessionTtlMs: readInt("ROVER_SESSION_TTL_MS", 24 * 60 * 60 * 1000),
  corsOrigins,
  corsOrigin: corsOrigins.join(","),
  loginWindowMs: 5 * 60 * 1000,
  loginMaxAttempts: readInt("ROVER_LOGIN_MAX_ATTEMPTS", 10),
});
