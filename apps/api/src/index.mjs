import { createApp } from "./app.mjs";
import { config } from "./config.mjs";
import { closeDatabase, markDatabaseReady } from "./db/pool.mjs";
import { migrate } from "./db/migrate.mjs";

const app = createApp();
let retryTimer;

async function ensureSchema() {
  try {
    await migrate();
    console.log("[rover-api] database schema ready");
    return true;
  } catch (error) {
    markDatabaseReady(false);
    console.error(
      "[rover-api] PostgreSQL unavailable; API will answer 503 until it reconnects:",
      error.message,
    );
    return false;
  }
}

async function boot() {
  const ready = await ensureSchema();
  if (!ready) {
    // Keep trying so a database started after the API still gets its schema.
    retryTimer = setInterval(() => {
      void ensureSchema().then((ok) => {
        if (ok && retryTimer) clearInterval(retryTimer);
      });
    }, 15_000);
    retryTimer.unref();
  }

  const server = app.listen(config.port, config.host, () => {
    console.log(`[rover-api] listening on http://${config.host}:${config.port}`);
    console.log(`[rover-api] environment: ${config.env}`);
  });

  const shutdown = async (signal) => {
    console.log(`[rover-api] ${signal}; shutting down`);
    if (retryTimer) clearInterval(retryTimer);
    server.close(() => undefined);
    await closeDatabase();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void boot();
