import type { SafetyState } from "./types";

export interface CommandParams {
  version?: number;
  sequence: number;
  arm: boolean;
  forward: number;
  turn: number;
  stop: boolean;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function clampAxis(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return clamp(value, -1, 1);
}

export function encodeCommand(params: CommandParams): string {
  const version = params.version ?? 1;
  const forward = clampAxis(params.forward);
  const turn = clampAxis(params.turn);
  return [
    "CMD",
    String(version),
    String(Math.trunc(params.sequence)),
    params.arm ? "1" : "0",
    forward.toFixed(3),
    turn.toFixed(3),
    params.stop ? "1" : "0",
  ].join(",");
}

export function isSafetyState(value: string): value is SafetyState {
  return (
    value === "BOOT_SAFE" ||
    value === "DISARMED" ||
    value === "MANUAL" ||
    value === "SAFE_STOP" ||
    value === "FAULT"
  );
}