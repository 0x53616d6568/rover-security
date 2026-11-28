import { config } from "../config.mjs";
import { ApiError, fail } from "../lib/http.mjs";

export function notFound(_req, res) {
  fail(res, 404, "Route not found.", "not_found");
}

export function errorHandler(error, req, res, _next) {
  if (error instanceof ApiError) {
    return fail(res, error.status, error.message, error.code);
  }

  // PostgreSQL unique violations are client errors, not server faults.
  if (error?.code === "23505") {
    return fail(res, 409, "That owner name is already taken.", "conflict");
  }

  console.error("[rover-api] unhandled request error", {
    requestId: req.id,
    method: req.method,
    path: req.path,
    message: error?.message,
  });

  const message = config.isProduction ? "Internal server error." : error?.message ?? "Internal server error.";
  return fail(res, 500, message, "internal_error");
}
