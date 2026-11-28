import { config } from "../config.mjs";
import { createSessionSigner } from "../lib/crypto.mjs";
import { parseCookies } from "../lib/http.mjs";

const signer = createSessionSigner(config.encryptionKey, config.sessionTtlMs);

export const cookieOptions = Object.freeze({
  httpOnly: true,
  sameSite: "lax",
  secure: config.cookieSecure,
  path: "/",
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
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    path: "/",
  });
}
