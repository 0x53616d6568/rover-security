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

export const config = Object.freeze({
  env: process.env.NODE_ENV ?? "development",
  isProduction,
  host: process.env.ROVER_BACKEND_HOST ?? "127.0.0.1",
  port: readInt("ROVER_BACKEND_PORT", 8080),
  databaseUrl:
    process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/rover_users",
  encryptionKey: readEncryptionKey(),
  cookieName: "rover-auth",
  cookieSecure: readBoolean("ROVER_COOKIE_SECURE", isProduction),
  sessionTtlMs: readInt("ROVER_SESSION_TTL_MS", 24 * 60 * 60 * 1000),
  corsOrigin: process.env.ROVER_CORS_ORIGIN ?? "",
  loginWindowMs: 5 * 60 * 1000,
  loginMaxAttempts: readInt("ROVER_LOGIN_MAX_ATTEMPTS", 10),
});
