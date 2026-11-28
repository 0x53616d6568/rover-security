import { Router } from "express";

import { config } from "../config.mjs";
import { verifyPassword } from "../lib/crypto.mjs";
import { ApiError, asyncHandler, readText, send } from "../lib/http.mjs";
import { requireAuth } from "../middleware/auth.mjs";
import { findUserByName } from "../repositories/users.mjs";
import { checkLoginAttempt, clearLoginAttempts } from "../services/loginGuard.mjs";
import { userView } from "../services/serializers.mjs";
import {
  clearSessionCookie,
  cookieOptions,
  issueSession,
} from "../services/session.mjs";

export const authRouter = Router();

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const name = readText(req.body?.name, { field: "Owner name", min: 2, max: 40 });
    const password = String(req.body?.password ?? "");
    if (!password) throw new ApiError(400, "Password is required.", "validation_error");

    const guard = checkLoginAttempt(req, name);
    if (!guard.allowed) {
      res.setHeader("Retry-After", String(guard.retryAfterSeconds));
      throw new ApiError(
        429,
        "Too many sign-in attempts. Try again shortly.",
        "rate_limited",
      );
    }

    const user = await findUserByName(name);
    if (!user?.password_hash || !verifyPassword(password, user.password_hash)) {
      throw new ApiError(401, "Invalid credentials.", "invalid_credentials");
    }

    clearLoginAttempts(req, name);
    res.cookie(config.cookieName, issueSession(user.id), cookieOptions);
    send(res, 200, { ok: true, user: userView(user) });
  }),
);

authRouter.post("/logout", (req, res) => {
  clearSessionCookie(res);
  send(res, 200, { ok: true });
});

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    send(res, 200, { ok: true, user: userView(req.user) });
  }),
);
