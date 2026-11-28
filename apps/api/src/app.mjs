import crypto from "node:crypto";
import express from "express";

import { config } from "./config.mjs";
import { isDatabaseReady, pool } from "./db/pool.mjs";
import { asyncHandler, send } from "./lib/http.mjs";
import { requireAuth } from "./middleware/auth.mjs";
import { errorHandler, notFound } from "./middleware/errors.mjs";
import { securityHeaders } from "./middleware/security.mjs";
import { authRouter } from "./routes/auth.mjs";
import { healthRouter } from "./routes/health.mjs";
import { roversRouter } from "./routes/rovers.mjs";
import { usersRouter } from "./routes/users.mjs";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    res.setHeader("X-Request-Id", req.id);
    next();
  });
  app.use(securityHeaders);
  app.use(express.json({ limit: "64kb" }));

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/rover", roversRouter);

  // Kept for the original smoke checks, but never public and never leaks credentials.
  app.get(
    "/api/debug",
    requireAuth,
    asyncHandler(async (_req, res) => {
      const [users, rovers] = await Promise.all([
        pool.query("SELECT COUNT(*)::int AS count FROM users"),
        pool.query("SELECT COUNT(*)::int AS count FROM rover_bindings"),
      ]);
      send(res, 200, {
        ok: true,
        users: users.rows[0]?.count ?? 0,
        rovers: rovers.rows[0]?.count ?? 0,
        database: isDatabaseReady() ? "connected" : "unavailable",
        env: config.env,
      });
    }),
  );

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
