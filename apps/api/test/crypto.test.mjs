import assert from "node:assert/strict";
import test from "node:test";

import {
  createMacCipher,
  createSessionSigner,
  hashPassword,
  maskMac,
  normalizeMac,
  roverIdForMac,
  verifyPassword,
} from "../src/lib/crypto.mjs";

test("normalizes MAC addresses in common formats", () => {
  assert.equal(normalizeMac("aa:bb:cc:dd:ee:ff"), "AA:BB:CC:DD:EE:FF");
  assert.equal(normalizeMac("AA-BB-CC-DD-EE-FF"), "AA:BB:CC:DD:EE:FF");
  assert.equal(normalizeMac("aabbccddeeff"), "AA:BB:CC:DD:EE:FF");
  assert.equal(normalizeMac("  aa bb cc dd ee ff  "), "AA:BB:CC:DD:EE:FF");
});

test("rejects malformed MAC addresses", () => {
  for (const value of ["", "AA:BB:CC:DD:EE", "GG:BB:CC:DD:EE:FF", "aabbccddeeff00"]) {
    assert.equal(normalizeMac(value), null, value);
  }
});

test("rover ids are deterministic 32-character hex digests", () => {
  const id = roverIdForMac("AA:BB:CC:DD:EE:FF");
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.equal(id, roverIdForMac("AA:BB:CC:DD:EE:FF"));
  assert.notEqual(id, roverIdForMac("AA:BB:CC:DD:EE:FE"));
});

test("masks all but the device suffix", () => {
  assert.equal(maskMac("AA:BB:CC:11:22:33"), "••:••:••:11:22:33");
  assert.equal(maskMac("nope"), "unavailable");
});

test("encrypts MACs with authenticated encryption", () => {
  const cipher = createMacCipher("test-key-material-32-bytes-long");
  const encrypted = cipher.encrypt("AA:BB:CC:DD:EE:FF");
  assert.notEqual(encrypted, "AA:BB:CC:DD:EE:FF");
  assert.equal(cipher.decrypt(encrypted), "AA:BB:CC:DD:EE:FF");

  const tampered = `${encrypted.slice(0, -1)}A`;
  assert.throws(() => cipher.decrypt(tampered));
});

test("hashes and verifies passwords without storing the plaintext", () => {
  const stored = hashPassword("correct horse battery staple");
  assert.match(stored, /^scrypt:/);
  assert.ok(!stored.includes("correct horse"));
  assert.equal(verifyPassword("correct horse battery staple", stored), true);
  assert.equal(verifyPassword("wrong password", stored), false);
  assert.equal(verifyPassword("anything", "not-a-hash"), false);
});

test("signs sessions and rejects tampering or expiry", () => {
  const signer = createSessionSigner("test-key-material-32-bytes-long", 1_000);
  const now = 1_700_000_000_000;
  const token = signer.sign("user_abc", now);

  assert.deepEqual(signer.verify(token, now + 10), { userId: "user_abc", expiresAt: now + 1_000 });
  assert.equal(signer.verify(token, now + 1_001), null);
  assert.equal(signer.verify(`${token}x`, now), null);
  assert.equal(signer.verify("v1.user_abc.9999999999999.bad", now), null);
});
