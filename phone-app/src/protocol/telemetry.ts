import type { ReadingValidity, RoverTelemetry, SafetyState } from "./types";
import { isSafetyState } from "./command";

const VALIDITY_TOKENS: ReadonlySet<ReadingValidity> = new Set([
  "available",
  "unavailable",
  "invalid",
  "stale",
  "simulated",
]);

function normalizeValidity(token: string | undefined, validFlag: string | undefined): ReadingValidity {
  const lowered = (token ?? "").trim().toLowerCase();
  if (VALIDITY_TOKENS.has(lowered as ReadingValidity)) {
    return lowered as ReadingValidity;
  }
  if (validFlag === "1") return "available";
  return "unavailable";
}

export function parseTelemetry(raw: string, receivedAt = Date.now()): RoverTelemetry | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fields: Record<string, string> = {};
  for (const part of trimmed.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim().toUpperCase();
    const value = part.slice(separator + 1).trim();
    if (key) fields[key] = value;
  }

  const stateToken = (fields.STATE ?? "").toUpperCase();
  const safetyState: SafetyState = isSafetyState(stateToken) ? stateToken : "FAULT";

  const sequenceRaw = fields.SEQ;
  const lastSequence = sequenceRaw && /^\d+$/.test(sequenceRaw) ? Number(sequenceRaw) : undefined;
  const ageRaw = fields.AGE_MS;
  const ageMs = ageRaw && /^\d+$/.test(ageRaw) ? Number(ageRaw) : undefined;

  return {
    safetyState,
    lastEvent: fields.EVENT || undefined,
    lastSequence,
    ageMs,
    sensorData: normalizeValidity(fields.SENSOR_DATA, fields.VALID),
    raw: fields,
    receivedAt,
  };
}

export function formatAge(ageMs: number | undefined, receivedAt: number): string {
  const now = Date.now();
  const age = ageMs ?? now - receivedAt;
  if (!Number.isFinite(age) || age < 0) return "—";
  if (age < 1000) return `${Math.round(age)} ms`;
  return `${(age / 1000).toFixed(1)} s`;
}