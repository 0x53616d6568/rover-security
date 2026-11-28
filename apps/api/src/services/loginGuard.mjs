import { config } from "../config.mjs";

const attempts = new Map();

function keyFor(req, name) {
  return `${req.ip ?? "unknown"}:${String(name).toLowerCase()}`;
}

function prune(now) {
  for (const [key, entry] of attempts) {
    if (entry.resetAt <= now) attempts.delete(key);
  }
}

/** Small in-process guard; a multi-instance deployment should use a shared store. */
export function checkLoginAttempt(req, name) {
  const now = Date.now();
  prune(now);

  const key = keyFor(req, name);
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + config.loginWindowMs });
    return { allowed: true };
  }

  entry.count += 1;
  if (entry.count > config.loginMaxAttempts) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return { allowed: true };
}

export function clearLoginAttempts(req, name) {
  attempts.delete(keyFor(req, name));
}
