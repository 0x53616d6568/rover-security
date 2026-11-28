import { config } from "../config.mjs";
import { createMacCipher, maskMac } from "../lib/crypto.mjs";

const macCipher = createMacCipher(config.encryptionKey);

export function userView(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    activeRoverId: row.active_rover_id ?? null,
    createdAt: row.created_at,
  };
}

export function roverView(row) {
  if (!row) return null;

  let macMask = "unavailable";
  try {
    macMask = maskMac(macCipher.decrypt(row.mac_cipher));
  } catch {
    // Never fail a read because a legacy row used a different key.
  }

  return {
    roverId: row.rover_id,
    macMask,
    userId: row.user_id,
    connectionCount: row.connection_count,
    activeConnection: row.connection_count > 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const encryptMac = (normalizedMac) => macCipher.encrypt(normalizedMac);
