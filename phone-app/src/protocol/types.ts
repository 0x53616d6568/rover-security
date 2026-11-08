export type SafetyState =
  | "BOOT_SAFE"
  | "DISARMED"
  | "MANUAL"
  | "SAFE_STOP"
  | "FAULT";

export type ConnectionStatus =
  | "unsupported"
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export type ReadingValidity =
  | "available"
  | "unavailable"
  | "invalid"
  | "stale"
  | "simulated";

export interface Reading<T> {
  value: T | null;
  unit: string;
  validity: ReadingValidity;
  ageMs?: number;
  timestamp?: number;
  note?: string;
}

export interface RoverTelemetry {
  safetyState: SafetyState;
  lastEvent?: string;
  lastSequence?: number;
  ageMs?: number;
  sensorData: ReadingValidity;
  raw: Record<string, string>;
  receivedAt: number;
}

export interface CommandAck {
  sequence: number;
  event: string;
  receivedAt: number;
}

export interface RoverEvent {
  id: string;
  time: number;
  severity: "info" | "warn" | "error";
  message: string;
}