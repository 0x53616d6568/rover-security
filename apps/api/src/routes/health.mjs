import { Router } from "express";

import { isDatabaseReady, pingDatabase } from "../db/pool.mjs";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  try {
    await pingDatabase();
    res.status(200).json({ ok: true, status: "ok", database: "connected" });
  } catch {
    res.status(503).json({
      ok: false,
      status: "degraded",
      database: isDatabaseReady() ? "error" : "unavailable",
    });
  }
});
