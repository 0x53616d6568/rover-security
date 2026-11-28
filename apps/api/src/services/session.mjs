import { config } from "../config.mjs";
import { createSessionSigner } from "../lib/crypto.mjs";
import { parseCookies } from "../lib/http.mjs";

const signer = createSessionSigner(config.encryptionKey, config.sessionTtlMs);

const baseCookieOptions = Object.freeze({
  httpOnly: true,
  sameSite: config.cookieSameSite,
  secure: config.cookieSecure,
  path: "/",
});

export const cookieOptions = Object.freeze({
  ...baseCookieOptions,
  maxAge: config.sessionTtlMs,
});

export function issueSession(userId) {
  return signer.sign(userId);
}

export function readSession(req) {
  const cookies = parseCookies(req.headers.cookie ?? "");
  return signer.verify(cookies.get(config.cookieName));
}

export function clearSessionCookie(res) {
  res.clearCookie(config.cookieName, baseCookieOptions);
}
