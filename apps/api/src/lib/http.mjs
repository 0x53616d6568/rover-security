export class ApiError extends Error {
  constructor(status, message, code = "request_failed") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function send(res, status, body) {
  res.status(status).json(body);
}

export function fail(res, status, message, code) {
  send(res, status, { ok: false, error: message, code });
}

/** Wrap an async route so rejected promises reach the Express error handler. */
export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function readText(value, { field, min = 1, max = 120, required = true }) {
  const text = String(value ?? "").trim();
  if (!text) {
    if (!required) return "";
    throw new ApiError(400, `${field} is required.`, "validation_error");
  }
  if (text.length < min || text.length > max) {
    throw new ApiError(
      400,
      `${field} must be between ${min} and ${max} characters.`,
      "validation_error",
    );
  }
  return text;
}

export function readPassword(value, { required = true } = {}) {
  const password = String(value ?? "");
  if (!password && !required) return "";
  if (password.length < 8 || password.length > 128) {
    throw new ApiError(
      400,
      "Password must be between 8 and 128 characters.",
      "validation_error",
    );
  }
  return password;
}

export function parseCookies(header = "") {
  const cookies = new Map();
  for (const entry of String(header).split(";")) {
    const index = entry.indexOf("=");
    if (index <= 0) continue;
    const name = entry.slice(0, index).trim();
    const value = entry.slice(index + 1).trim();
    if (name) cookies.set(name, decodeURIComponent(value));
  }
  return cookies;
}
