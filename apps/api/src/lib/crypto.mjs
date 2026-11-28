import crypto from "node:crypto";

const MAC_COMPACT = /^([0-9A-F]{2}){6}$/;
const MAC_COLON = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
const SESSION_VERSION = "v1";

/** Normalize a user-supplied MAC to AA:BB:CC:DD:EE:FF, or null when invalid. */
export function normalizeMac(raw) {
  const compact = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "");

  if (MAC_COMPACT.test(compact)) {
    return compact.match(/.{2}/g).join(":");
  }

  const colonized = compact.replace(/-/g, ":");
  return MAC_COLON.test(colonized) ? colonized : null;
}

/** Stable lookup key: the first 32 hex characters of SHA-256(normalized MAC). */
export function roverIdForMac(normalizedMac) {
  return crypto.createHash("sha256").update(normalizedMac).digest("hex").slice(0, 32);
}

/** Display mask that keeps the vendor/device suffix without exposing the full MAC. */
export function maskMac(normalizedMac) {
  const parts = String(normalizedMac).split(":");
  if (parts.length !== 6) return "unavailable";
  return ["••", "••", "••", ...parts.slice(3)].join(":");
}

function deriveKey(rawKey) {
  return crypto.createHash("sha256").update(rawKey).digest();
}

export function createMacCipher(rawKey) {
  const key = deriveKey(rawKey);

  return {
    encrypt(normalizedMac) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
      const ciphertext = Buffer.concat([cipher.update(normalizedMac, "utf8"), cipher.final()]);
      const authTag = cipher.getAuthTag();
      return Buffer.concat([iv, authTag, ciphertext]).toString("base64url");
    },

    decrypt(macCipher) {
      const data = Buffer.from(String(macCipher), "base64url");
      if (data.length < 29) throw new Error("MAC cipher is malformed.");
      const iv = data.subarray(0, 12);
      const authTag = data.subarray(12, 28);
      const ciphertext = data.subarray(28);
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    },
  };
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.scryptSync(password, Buffer.from(salt, "base64url"), 32).toString("base64url");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  const parts = String(storedHash ?? "").split(":");
  if (parts[0] !== "scrypt" || parts.length !== 3) return false;

  let expected;
  try {
    expected = crypto.scryptSync(password, Buffer.from(parts[1], "base64url"), 32);
  } catch {
    return false;
  }

  const actual = Buffer.from(parts[2], "base64url");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

export function createSessionSigner(rawKey, ttlMs) {
  const key = deriveKey(rawKey);

  function signatureFor(userId, expiresAt) {
    return crypto
      .createHmac("sha256", key)
      .update(`${SESSION_VERSION}.${userId}.${expiresAt}`)
      .digest("base64url");
  }

  return {
    sign(userId, now = Date.now()) {
      const expiresAt = now + ttlMs;
      return `${SESSION_VERSION}.${userId}.${expiresAt}.${signatureFor(userId, expiresAt)}`;
    },

    verify(token, now = Date.now()) {
      const parts = String(token ?? "").split(".");
      if (parts.length !== 4 || parts[0] !== SESSION_VERSION) return null;

      const [, userId, expiresAtRaw, signature] = parts;
      const expiresAt = Number.parseInt(expiresAtRaw, 10);
      if (!userId || !Number.isFinite(expiresAt) || expiresAt <= now) return null;

      const expected = Buffer.from(signatureFor(userId, expiresAt));
      const actual = Buffer.from(signature);
      if (expected.length !== actual.length) return null;
      if (!crypto.timingSafeEqual(expected, actual)) return null;

      return { userId, expiresAt };
    },
  };
}
