import type { SafetyState } from "../protocol/types";

interface SafetyStateBadgeProps {
  state: SafetyState;
  authorized: boolean;
}

const LABEL: Record<SafetyState, string> = {
  BOOT_SAFE: "Boot safe",
  DISARMED: "Disarmed",
  MANUAL: "Manual",
  SAFE_STOP: "Safe stop",
  FAULT: "Fault",
};

export function SafetyStateBadge({ state, authorized }: SafetyStateBadgeProps) {
  const className =
    state === "MANUAL"
      ? "manual"
      : state === "SAFE_STOP"
        ? "safe"
        : state === "FAULT"
          ? "fault"
          : "disarmed";
  return (
    <div className="state-hero">
      <span className={`state-name ${className}`}>{LABEL[state]}</span>
      <span className={`pill ${authorized ? "ok" : "neutral"}`}>
        {authorized ? "Authorized" : "Not authorized"}
      </span>
    </div>
  );
}
