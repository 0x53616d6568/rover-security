import { findUserById } from "../repositories/users.mjs";
import { ApiError } from "../lib/http.mjs";
import { readSession } from "../services/session.mjs";

/** Attach the authenticated user row to the request, or reject with 401. */
export async function requireAuth(req, _res, next) {
  try {
    const session = readSession(req);
    if (!session) throw new ApiError(401, "Not authenticated.", "unauthenticated");

    const user = await findUserById(session.userId);
    if (!user) throw new ApiError(401, "Session no longer valid.", "unauthenticated");

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/** Attach the user when a valid cookie is present, but never reject. */
export async function optionalAuth(req, _res, next) {
  try {
    const session = readSession(req);
    if (session) {
      req.user = (await findUserById(session.userId)) ?? undefined;
    }
  } catch {
    req.user = undefined;
  }
  next();
}
